import { CONFIG } from '../config.js';
import { normalizeEmployees } from '../models/employee.js';
import { validateLeaveRequests, validHistoryRow } from '../services/availability.js';
import { buildModel, extractSchedule } from './model.js';
import { preflight } from './diagnostics.js';
import { validateSchedule } from './validator.js';
import { scoreSchedule } from './scoring.js';
import { optimizeSchedule } from './optimization.js';
import { SEARCH_STAGES } from './policy.js';

export function generateSchedule(input, highs, progress = () => {}) {
  const start = performance.now(), config = input.config ?? CONFIG, attempts = [];
  normalizeEmployees(input.employees);
  if (!input.employees.length || !input.days.length) throw new Error('Add employees and choose a month first.');
  validateLeaveRequests(input.leaveRequests ?? {},input.employees,input.days);
  if (input.boundary?.mode === 'continuous') for (const e of input.employees.filter(e=>!e.radiationBenefit)) {
    const h=input.boundary.history?.[e.id];
    if (!Array.isArray(h) || h.length !== config.maxOffDays || h.some(r=>!validHistoryRow(r))) throw new Error('Previous-month history is missing or invalid for ' + e.name + '.');
  }
  const statistics = extra => ({elapsedMs:performance.now()-start,attempts,...extra});
  const check=preflight(input);
  if(check.errors.length) return {type:'INFEASIBLE',diagnostics:check.errors,statistics:statistics({})};
  const deadline=performance.now()+config.search.feasibilitySeconds*1000;
  let candidate, solverStatus, selectedStage;
  for(const stage of SEARCH_STAGES) {
    progress('Searching: ' + stage.label + '…');
    const capacity=preflight(input,stage.id);
    if(capacity.errors.length) { attempts.push({stage:stage.id,status:'Proven infeasible',diagnostics:capacity.errors}); continue; }
    const remaining=(deadline-performance.now())/1000;
    if(remaining<=0) return {type:'ERROR',code:'SEARCH_LIMIT',message:'The search time limit was reached. Later shortage exceptions were not enabled without proof that earlier stages are infeasible. Try a longer search.',statistics:statistics({})};
    const result=highs.solve(buildModel(input,false,stage.id),{output_flag:false,time_limit:remaining,random_seed:config.search.randomSeed,mip_rel_gap:0});
    if(result.Status==='Infeasible') { attempts.push({stage:stage.id,status:'Proven infeasible'}); continue; }
    try { candidate=extractSchedule(result,input,stage.id); } catch { candidate=null; }
    if(!candidate || !validateSchedule(input,candidate).valid) return {type:'ERROR',code:'SEARCH_LIMIT',message:'Search ended ('+result.Status+') without a validated solution. This is not proof of infeasibility; later shortage exceptions were not enabled. Try a longer search.',statistics:statistics({})};
    attempts.push({stage:stage.id,status:'Feasible'}); selectedStage=stage.id; solverStatus=result.Status; break;
  }
  if(!candidate) return {type:'INFEASIBLE',diagnostics:[{ruleId:'MODEL_INFEASIBLE',message:'All three coverage stages are proven infeasible, including senior holiday shifts and eligible junior double shifts. No specific conflicting rule subset was identified.'}],statistics:statistics({})};
  let bestScore=scoreSchedule(input,candidate), optimizationStatus='Not run';
  if(config.search.optimizationSeconds>0) {
    progress('A valid schedule was found. Reducing exceptions and improving shift balance…');
    let optimized;
    try { optimized=optimizeSchedule(input,highs,candidate,{output_flag:false,time_limit:config.search.optimizationSeconds,random_seed:config.search.randomSeed,mip_rel_gap:0}); }
    catch(error) { optimized={Status:'Optimization stopped: '+error.message}; }
    optimizationStatus=optimized.Status;
    let next;
    try { next=extractSchedule(optimized,input,selectedStage); } catch { next=null; }
    if(next && validateSchedule(input,next).valid) {const score=scoreSchedule(input,next); if(score.total<bestScore.total) {candidate=next;bestScore=score;}}
  }
  return {type:'SUCCESS',schedule:candidate,statistics:statistics({stage:selectedStage,solverStatus,optimizationStatus,score:bestScore,optimal:optimizationStatus==='Optimal'})};
}
