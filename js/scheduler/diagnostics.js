import { CONFIG, FIXED, ON_CALL, coverage } from '../config.js';
import { requiredHours } from '../services/hours.js';
import { onLeave, patternShift, supervisorMorning } from '../services/availability.js';
import { stagePolicy } from './policy.js';
export function preflight(input, stage = 'junior-doubles') {
  const { employees, days, config = CONFIG } = input, policy = stagePolicy(stage);
  const errors = [];
  const add = (ruleId,message,employeeId=null,date=null) => errors.push({ruleId,message,employeeId,date});
  const availableHours = days.reduce((t,d) => t + FIXED.reduce((s,k) => s + coverage(d,config)[k]*config.hours[k],0),0);
  const minimumHours = employees.reduce((s,e) => s + Math.max(0,Math.ceil(requiredHours(e,days,config)-1e-7)),0);
  if (minimumHours > availableHours) add('H15_REQUIRED_HOURS','Employees require at least ' + minimumHours + ' whole fixed hours, but exact staffing supplies only ' + availableHours + ' hours.');
  const eligible = (e,day) => !onLeave(input,e.id,day.date) && (policy.seniorHolidays || !day.isHoliday || e.yearsOfService <= config.seniorThreshold);
  const cap = e => policy.doubles && e.yearsOfService <= config.doubleShiftMaxYears ? 2 : 1;
  let nightCapacity = 0;
  for (const e of employees) {
    const available = days.filter(day => eligible(e,day)).length;
    const nights = Math.min(available,e.yearsOfService > config.seniorThreshold ? config.seniorNightCap : available);
    nightCapacity += nights;
    const optimisticHours = cap(e) === 2 ? available*(config.hours.M+config.hours.N) : available*config.hours.M + nights*(config.hours.N-config.hours.M);
    if (optimisticHours + 1e-7 < requiredHours(e,days,config)) add('H15_REQUIRED_HOURS',e.name + ': available days cannot provide the required hours in this stage.',e.id);
    for (const day of days) if (!onLeave(input,e.id,day.date) && supervisorMorning(e,day) && patternShift(e,day) && patternShift(e,day)!=='M' && cap(e)===1) add('H19_SUPERVISOR_MORNING',e.name + ': weekly pattern conflicts with required supervisor morning duty in this stage.',e.id,day.date);
    const fixedNights = days.filter(day => !onLeave(input,e.id,day.date) && patternShift(e,day)==='N').length;
    if (e.yearsOfService > config.seniorThreshold && fixedNights > config.seniorNightCap) add('H18_WEEKLY_PATTERN',e.name + ': weekly pattern requires ' + fixedNights + ' nights, exceeding the four-night limit.',e.id);
    if (!e.radiationBenefit) for (let d=1;d<days.length;d++) {
      if (!onLeave(input,e.id,days[d-1].date) && !onLeave(input,e.id,days[d].date) && patternShift(e,days[d-1])==='N' && (patternShift(e,days[d])==='M' || supervisorMorning(e,days[d]))) add('H13_NON_RADIATION_N_TO_NEXT_M',e.name + ': weekly pattern requires night followed by morning without radiation benefit.',e.id,days[d].date);
    }
  }
  const nightsNeeded = days.reduce((s,d) => s+coverage(d,config).N,0);
  if (nightCapacity < nightsNeeded) add('H16_OVER_8_MAX_FOUR_NIGHTS','Night capacity is ' + nightCapacity + ' assignments; ' + nightsNeeded + ' are required.');
  for (const day of days) {
    const available = employees.filter(e => !onLeave(input,e.id,day.date));
    const counts = coverage(day,config), calls = ON_CALL.reduce((s,k) => s+counts[k],0), fixed = FIXED.reduce((s,k) => s+counts[k],0);
    const capacities = available.map(e => eligible(e,day) ? cap(e) : 0).sort((a,b)=>a-b);
    const fixedCapacity = capacities.slice(calls).reduce((s,c)=>s+c,0);
    if (available.length < calls || available.filter(e=>eligible(e,day)).length < Math.max(...FIXED.map(s=>counts[s])) || fixedCapacity < fixed) add('COVERAGE_CAPACITY','Insufficient available employees for fixed and on-call coverage in this stage (' + available.length + ' available).',null,day.date);
    for (const s of FIXED) {
      const patterned = available.filter(e=>patternShift(e,day)===s || (s==='M' && supervisorMorning(e,day)));
      if (patterned.length > counts[s]) add('H18_WEEKLY_PATTERN','Weekly patterns and supervisor duty require ' + patterned.length + ' employees on ' + s + '; coverage allows exactly ' + counts[s] + '.',null,day.date);
      for (const e of patterned.filter(e=>!eligible(e,day))) add('STAGE_SENIOR_HOLIDAY',e.name + ': weekly pattern needs the senior-holiday exception.',e.id,day.date);
    }
  }
  return { errors, availableHours, minimumHours };
}
