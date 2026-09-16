import { CONFIG } from '../config.js';
import { normalizeEmployees } from '../models/employee.js';
import { buildModel, extractSchedule } from './model.js';
import { preflight } from './diagnostics.js';
import { validateSchedule } from './validator.js';
import { scoreSchedule } from './scoring.js';
import { optimizeSchedule } from './optimization.js';

export function generateSchedule(input, highs, progress = () => {}) {
  const start = performance.now(), config = input.config ?? CONFIG;
  normalizeEmployees(input.employees);
  if (!input.employees.length || !input.days.length) throw new Error('Add employees and choose a month first.');
  if (input.boundary?.mode === 'continuous') {
    for (const e of input.employees.filter(e => !e.radiationBenefit)) {
      const h = input.boundary.history?.[e.id];
      if (!Array.isArray(h) || h.length !== config.maxOffDays || h.some(r => !Array.isArray(r))) throw new Error(`Previous-month history is missing for ${e.name}.`);
    }
  }
  const check = preflight(input);
  if (check.errors.length) return { type: 'INFEASIBLE', diagnostics: check.errors, statistics: { elapsedMs: performance.now() - start } };
  progress('Searching for a schedule that satisfies all hard rules…');
  const options = { output_flag: false, time_limit: config.search.feasibilitySeconds, random_seed: config.search.randomSeed, mip_rel_gap: 0 };
  const result = highs.solve(buildModel(input), options);
  if (result.Status === 'Infeasible') return { type: 'INFEASIBLE', diagnostics: [{ ruleId: 'MODEL_INFEASIBLE', message: 'The complete constraint model is proven infeasible. No specific conflicting rule subset was identified.' }], statistics: { elapsedMs: performance.now() - start, solverStatus: result.Status } };
  let candidate;
  try { candidate = extractSchedule(result, input); } catch { candidate = null; }
  if (!candidate || !validateSchedule(input, candidate).valid) return { type: 'ERROR', code: 'SEARCH_LIMIT', message: `Search ended (${result.Status}) without a validated solution. This is not proof of infeasibility. Try a longer search.`, statistics: { elapsedMs: performance.now() - start } };
  let bestScore = scoreSchedule(input, candidate), optimizationStatus = 'Not run';
  if (config.search.optimizationSeconds > 0) {
    progress('A valid schedule was found. Improving shift balance and overtime…');
    let optimized;
    try { optimized = optimizeSchedule(input, highs, candidate, { ...options, time_limit: config.search.optimizationSeconds }); }
    catch (error) { optimized = { Status: `Optimization stopped: ${error.message}` }; }
    optimizationStatus = optimized.Status;
    let next;
    try { next = extractSchedule(optimized, input); } catch { next = null; }
    if (next && validateSchedule(input, next).valid) {
      const score = scoreSchedule(input, next);
      if (score.total < bestScore.total) { candidate = next; bestScore = score; }
    }
  }
  return { type: 'SUCCESS', schedule: candidate, statistics: { elapsedMs: performance.now() - start, solverStatus: result.Status, optimizationStatus, score: bestScore, optimal: optimizationStatus === 'Optimal' } };
}
