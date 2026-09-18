import test from 'node:test';
import assert from 'node:assert/strict';
import loadHighs from 'highs';
import { CONFIG, FIXED } from '../js/config.js';
import { createCalendar } from '../js/services/calendar.js';
import { normalizeEmployees } from '../js/models/employee.js';
import { parseLeaveDays, onLeave } from '../js/services/availability.js';
import { initialState, context, currentRecord, fingerprint, validateStoredState } from '../js/state.js';
import { validateSchedule } from '../js/scheduler/validator.js';
import { generateSchedule } from '../js/scheduler/engine.js';
import { preflight } from '../js/scheduler/diagnostics.js';
import { scoreSchedule } from '../js/scheduler/scoring.js';
import { scheduleCSV, printableHTML } from '../js/export/schedule.js';
import { demoEmployees } from '../data/demo.js';
const highs=await loadHighs();
const employee=(id='e1',extra={})=>({id,name:id,yearsOfService:4,radiationBenefit:false,productivityCategory:'0–4',weeklyPattern:{},...extra});
function fixture(length=7,extra={}) {
 const days=createCalendar(1405,6).slice(0,length), employees=[employee('e1',extra)];
 return {input:{employees,days,config:CONFIG,boundary:{mode:'independent'},leaveRequests:{}},schedule:{dates:days.map(d=>d.date),assignments:{e1:days.map(()=>[])},stage:'preferred'}};
}
const errors=f=>validateSchedule(f.input,f.schedule).errors.map(e=>e.ruleId);
function smallInput(employees,holiday=false) {
 return {employees,days:createCalendar(1405,6).filter(d=>d.isHoliday===holiday).slice(0,1),config:{...CONFIG,dailyBaseHours:0,search:{...CONFIG.search,optimizationSeconds:0}},boundary:{mode:'independent'},leaveRequests:{}};
}
test('double-shift eligibility is independent of radiation and inclusive at four years',()=>{
 for(const radiationBenefit of [false,true]) for(const yearsOfService of [0,4,4.1,8,9]) {
  const f=fixture(1,{radiationBenefit,yearsOfService});f.schedule.assignments.e1[0]=['M','E'];
  assert.ok(errors(f).includes('H11_DAILY_FIXED_LIMIT'));
  f.schedule.stage='senior-holidays';assert.ok(errors(f).includes('H11_DAILY_FIXED_LIMIT'));
  f.schedule.stage='junior-doubles';assert.equal(errors(f).includes('H11_DAILY_FIXED_LIMIT'),yearsOfService>4);
  f.schedule.assignments.e1[0]=['M','E','N'];assert.ok(errors(f).includes('H12_NO_TRIPLE_FIXED'));
 }
});
test('requested leave blocks fixed and on-call assignments and overrides weekly pattern',()=>{
 const f=fixture(1,{weeklyPattern:{0:'N'}}); f.input.leaveRequests.e1=[f.input.days[0].date];
 assert.ok(!errors(f).includes('H18_WEEKLY_PATTERN'));
 for(const s of ['M','E','N','m','e','a']) {f.schedule.assignments.e1[0]=[s];assert.ok(errors(f).includes('H17_REQUESTED_LEAVE'));}
 f.input.leaveRequests={};f.schedule.assignments.e1[0]=[];assert.ok(errors(f).includes('H18_WEEKLY_PATTERN'));
});
test('requested leave is exempt from OFF runs but unrequested days remain constrained',()=>{
 const f=fixture(8);f.input.leaveRequests.e1=f.input.days.slice(0,4).map(d=>d.date);
 const issues=validateSchedule(f.input,f.schedule).errors.filter(e=>e.ruleId==='H14_NON_RADIATION_MAX_THREE_OFF');
 assert.deepEqual(issues.map(e=>e.date),[f.input.days[7].date]);
});
test('leave and actual double shifts are valid boundary history; night rule still applies',()=>{
 const f=fixture(1);f.input.boundary={mode:'continuous',history:{e1:[[],[],['LEAVE']]}};
 assert.ok(!errors(f).includes('INPUT_BOUNDARY'));assert.ok(!errors(f).includes('H14_NON_RADIATION_MAX_THREE_OFF'));
 f.input.boundary.history.e1=[[],[],['M','N']];f.schedule.assignments.e1[0]=['M'];
 assert.ok(!errors(f).includes('INPUT_BOUNDARY'));assert.ok(errors(f).includes('H13_NON_RADIATION_N_TO_NEXT_M'));
 f.input.boundary.history.e1=[[],[],['LEAVE','M']];assert.ok(errors(f).includes('INPUT_BOUNDARY'));
});
test('senior holiday restriction is stage-specific and uses strictly more than eight years',()=>{
 const f=fixture(6,{yearsOfService:9});f.schedule.assignments.e1[5]=['M'];
 assert.ok(errors(f).includes('STAGE_SENIOR_HOLIDAY'));
 f.schedule.stage='senior-holidays';assert.ok(!errors(f).includes('STAGE_SENIOR_HOLIDAY'));
 assert.equal(scoreSchedule(f.input,f.schedule).parts.S05,1);
 f.input.employees[0].yearsOfService=8;f.schedule.stage='preferred';assert.ok(!errors(f).includes('STAGE_SENIOR_HOLIDAY'));
});
test('unknown scheduling stage and invalid leave dates cannot pass validation',()=>{
 const f=fixture(1);f.schedule.stage='anything';assert.ok(errors(f).includes('INPUT_STAGE'));
 f.schedule.stage='preferred';f.input.leaveRequests.e1=['1405-06-32'];assert.ok(errors(f).includes('INPUT_EMPLOYEES'));
});
test('Persian leave day input is normalized; wrong month days are rejected',()=>{
 const days=createCalendar(1404,12);
 assert.deepEqual(parseLeaveDays('۱، 5 ۵, ٢٩',days),[days[0].date,days[4].date,days[28].date]);
 for(const value of ['30','0','1.5','5-10','bad']) assert.throws(()=>parseLeaveDays(value,days));
 assert.deepEqual(parseLeaveDays('',days),[]);
});
test('weekly patterns survive employee normalization and malformed patterns are rejected',()=>{
 assert.deepEqual(normalizeEmployees([employee('e1',{weeklyPattern:{3:'N',4:'M'}})])[0].weeklyPattern,{3:'N',4:'M'});
 for(const weeklyPattern of [{7:'N'},{3:'a'},['N'],'N']) assert.throws(()=>normalizeEmployees([employee('e1',{weeklyPattern})]));
});
test('version-one workspaces retain data but require a schedule under the new rules',()=>{
 const state=initialState();state.schemaVersion=1;state.config={...CONFIG,version:1};state.employees=[employee()];delete state.leaveRequests;delete state.leaveReviews;
 const oldInput={employees:state.employees,days:createCalendar(state.year,state.month),config:state.config,boundary:{mode:'independent',history:{}}};
 const key=oldInput.days[0].date.slice(0,7);state.schedules[key]={input:oldInput,fingerprint:fingerprint(oldInput),marker:'legacy'};
 const next=validateStoredState(state);assert.equal(next.config.version,2);assert.equal(next.employees.length,1);assert.equal(next.schedules[key].marker,'legacy');assert.equal(currentRecord(next),null);assert.deepEqual(next.leaveRequests,{});
});
test('leave and weekly pattern edits invalidate an existing current schedule',()=>{
 const state=initialState();state.employees=[employee()];const input=context(state),key=input.days[0].date.slice(0,7);
 state.schedules[key]={fingerprint:fingerprint(input)};assert.ok(currentRecord(state));
 state.leaveRequests[key]={e1:[input.days[0].date]};assert.equal(currentRecord(state),null);
 state.leaveRequests={};state.employees[0].weeklyPattern={3:'N'};assert.equal(currentRecord(state),null);
});
test('solver uses preferred single-shift stage when it is feasible, including radiation staff',()=>{
 const input=smallInput(Array.from({length:14},(_,i)=>employee('e'+i,{radiationBenefit:true})));
 const result=generateSchedule(input,highs);assert.equal(result.type,'SUCCESS',JSON.stringify(result));assert.equal(result.schedule.stage,'preferred');
 for(const rows of Object.values(result.schedule.assignments)) assert.ok(rows.every(row=>row.length<=1));
});
test('solver tries senior holiday singles before junior doubles',()=>{
 const input=smallInput(Array.from({length:9},(_,i)=>employee('e'+i,{yearsOfService:i<5?4:9})),true);
 const result=generateSchedule(input,highs);assert.equal(result.type,'SUCCESS',JSON.stringify(result));assert.equal(result.schedule.stage,'senior-holidays');
 assert.deepEqual(result.statistics.attempts.map(a=>a.stage),['preferred','senior-holidays']);
 assert.ok(Object.values(result.schedule.assignments).every(rows=>rows[0].length<=1));
 assert.ok(input.employees.filter(e=>e.yearsOfService>8).some(e=>result.schedule.assignments[e.id][0].some(s=>FIXED.includes(s))));
});
test('solver enables eligible doubles only after both single-shift stages fail',()=>{
 const input=smallInput(Array.from({length:12},(_,i)=>employee('e'+i,{yearsOfService:i<3?4:5})));
 const result=generateSchedule(input,highs);assert.equal(result.type,'SUCCESS',JSON.stringify(result));assert.equal(result.schedule.stage,'junior-doubles');
 assert.deepEqual(result.statistics.attempts.slice(0,2).map(a=>a.status),['Proven infeasible','Proven infeasible']);
 assert.ok(input.employees.some(e=>result.schedule.assignments[e.id][0].length===2));
 for(const e of input.employees) if(e.yearsOfService>4) assert.ok(result.schedule.assignments[e.id][0].length<=1);
 assert.ok(validateSchedule(input,result.schedule).valid);
});
test('no solver timeout can silently enable the next shortage stage',()=>{
 let calls=0;const input=smallInput(Array.from({length:14},(_,i)=>employee('e'+i)));
 const result=generateSchedule(input,{solve(){calls++;return {Status:'Time limit reached'};}});
 assert.equal(result.type,'ERROR');assert.equal(result.code,'SEARCH_LIMIT');assert.equal(calls,1);
});
test('fixed-pattern conflicts report night/morning, night-cap and coverage diagnostics',()=>{
 const days=createCalendar(1405,6), config={...CONFIG,search:{...CONFIG.search,optimizationSeconds:0}};
 const input={employees:structuredClone(demoEmployees),days,config,boundary:{mode:'independent'},leaveRequests:{}};
 input.employees[0].weeklyPattern={3:'N',4:'M'};
 assert.ok(preflight(input).errors.some(e=>e.ruleId==='H13_NON_RADIATION_N_TO_NEXT_M'));
 input.employees[0].radiationBenefit=true;input.employees[0].yearsOfService=9;input.employees[0].weeklyPattern={2:'N'};
 assert.ok(preflight(input).errors.some(e=>e.ruleId==='H18_WEEKLY_PATTERN'&&e.message.includes('five')===false&&e.message.includes('5 nights')));
 for(const e of input.employees.slice(0,3)) e.weeklyPattern={5:'E'};
 assert.ok(preflight(input).errors.some(e=>e.ruleId==='H18_WEEKLY_PATTERN'&&e.message.includes('exactly 2')));
});
test('real monthly solve honors weekly patterns, leave overrides and four-day leave',()=>{
 const input={employees:structuredClone(demoEmployees),days:createCalendar(1405,6),config:{...CONFIG,search:{...CONFIG.search,optimizationSeconds:0}},boundary:{mode:'independent'},leaveRequests:{}};
 input.employees[12].weeklyPattern={3:'N',4:'M'};
 input.employees[14].weeklyPattern={2:'N',3:'M'};
 input.leaveRequests[input.employees[12].id]=[input.days[3].date];
 input.leaveRequests[input.employees[0].id]=input.days.slice(0,4).map(d=>d.date);
 const result=generateSchedule(input,highs);assert.equal(result.type,'SUCCESS',JSON.stringify(result));assert.ok(validateSchedule(input,result.schedule).valid);
 for(const e of input.employees) input.days.forEach((day,d)=>{
  const row=result.schedule.assignments[e.id][d];
  if(onLeave(input,e.id,day.date)) assert.deepEqual(row,[]);
  else if(e.weeklyPattern?.[day.dayOfWeek]) assert.ok(row.includes(e.weeklyPattern[day.dayOfWeek]));
 });
 const csv=scheduleCSV(input,result.schedule), html=printableHTML(input,result.schedule,'Shahrivar');
 assert.ok(csv.includes('1405-06-06 (جمعه)'));assert.ok(csv.includes('"LEAVE"'));assert.ok(html.includes('LEAVE'));
 const corrupted=structuredClone(result.schedule);corrupted.assignments[input.employees[0].id][0]=['a'];
 assert.ok(validateSchedule(input,corrupted).errors.some(e=>e.ruleId==='H17_REQUESTED_LEAVE'));
});
