import test from 'node:test';
import assert from 'node:assert/strict';
import loadHighs from 'highs';
import { generateSchedule } from '../js/scheduler/engine.js';
import { validateSchedule } from '../js/scheduler/validator.js';
import { scoreSchedule } from '../js/scheduler/scoring.js';
import { createCalendar } from '../js/services/calendar.js';
import { demoEmployees } from '../data/demo.js';
import { CONFIG } from '../js/config.js';
const highs = await loadHighs();
const input = (employees = demoEmployees, year = 1405, month = 6, holidays = []) => ({ employees: structuredClone(employees), days: createCalendar(year, month, holidays), config: { ...CONFIG, search: { ...CONFIG.search, optimizationSeconds: 0 } }, boundary: { mode: 'independent' } });
test('full Persian month generates a valid schedule; deliberate corruption is detected', () => {
  const data = input(), result = generateSchedule(data, highs);
  assert.equal(result.type, 'SUCCESS', JSON.stringify(result)); assert.equal(validateSchedule(data, result.schedule).valid, true);
  const corrupt = structuredClone(result.schedule); corrupt.assignments[demoEmployees[0].id][0] = [];
  assert.equal(validateSchedule(data, corrupt).valid, false);
});
test('30-day month with selected official holidays stays feasible and valid', () => {
  const data = input(demoEmployees, 1405, 7, ['1405-07-01', '1405-07-10']); const result = generateSchedule(data, highs);
  assert.equal(result.type, 'SUCCESS', JSON.stringify(result)); assert.equal(validateSchedule(data, result.schedule).valid, true);
});
test('29-day Esfand with boundary history is solved and validated', () => {
  const data = input(demoEmployees, 1404, 12);
  data.boundary = { mode: 'continuous', history: Object.fromEntries(demoEmployees.filter(e => !e.radiationBenefit).map(e => [e.id, [[], [], []]])) };
  // Esfand starts on Friday: nine assignment slots cannot cover twelve required returns.
  const result = generateSchedule(data, highs); assert.equal(result.type, 'INFEASIBLE');
  for (const history of Object.values(data.boundary.history)) history[2] = ['N'];
  const feasible = generateSchedule(data, highs); assert.equal(feasible.type, 'SUCCESS', JSON.stringify(feasible)); assert.equal(validateSchedule(data, feasible.schedule).valid, true);
});
test('provable hour and night shortages return INFEASIBLE with reliable diagnostics', () => {
  const tooMany = input(Array.from({ length: 35 }, (_, i) => ({ ...demoEmployees[0], id: `e${i}` })));
  assert.ok(generateSchedule(tooMany, highs).diagnostics.some(d => d.ruleId === 'H15_REQUIRED_HOURS'));
  const senior = input(Array.from({ length: 14 }, (_, i) => ({ ...demoEmployees[0], id: `e${i}`, yearsOfService: 9, radiationBenefit: true })));
  assert.ok(generateSchedule(senior, highs).diagnostics.some(d => d.ruleId === 'H16_OVER_8_MAX_FOUR_NIGHTS'));
});
test('optimization preserves validity and never worsens retained soft score', () => {
  const data = input(), baseline = generateSchedule(data, highs);
  data.config.search = { ...data.config.search, optimizationSeconds: 3 };
  const optimized = generateSchedule(data, highs);
  assert.equal(optimized.type, 'SUCCESS'); assert.equal(validateSchedule(data, optimized.schedule).valid, true);
  assert.ok(scoreSchedule(data, optimized.schedule).total <= baseline.statistics.score.total + 1e-7);
});
test('a time limit without a candidate is not mislabeled INFEASIBLE', () => {
  const data = input(), fakeSolver = { solve: () => ({ Status: 'Time limit reached' }) };
  const result = generateSchedule(data, fakeSolver); assert.equal(result.type, 'ERROR'); assert.equal(result.code, 'SEARCH_LIMIT');
});
