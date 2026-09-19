import { CONFIG, SHIFTS, FIXED, ON_CALL, coverage } from '../config.js';
import { requiredHours, workedHours, shiftCounts } from '../services/hours.js';
import { normalizeEmployees } from '../models/employee.js';
import { onLeave, patternShift, supervisorMorning, validHistoryRow, validateLeaveRequests } from '../services/availability.js';
import { stagePolicy } from './policy.js';

// Deliberately separate from the mathematical model: inspect plain assignments.
export function validateSchedule(input, schedule) {
  const { employees, days, config = CONFIG, boundary = { mode: 'independent' } } = input;
  const errors = [], warnings = [];
  const add = (ruleId, message, employeeId = null, date = null) => errors.push({ ruleId, employeeId, date, message });
  const policy = stagePolicy(schedule?.stage);
  if (!policy) add('INPUT_STAGE', 'Unknown scheduling stage.');
  if (config.version !== CONFIG.version) add('RULES_VERSION', 'This schedule uses older rules. Regenerate it.');
  try { normalizeEmployees(employees); validateLeaveRequests(input.leaveRequests ?? {}, employees, days); } catch (error) { add('INPUT_EMPLOYEES', error.message); }
  if (!Array.isArray(days) || !days.length || !employees?.length) add('INPUT_EMPTY', 'A calendar and at least one employee are required.');
  if (errors.length) return { valid: false, errors, warnings };
  if (!schedule?.assignments || typeof schedule.assignments !== 'object') return { valid: false, errors: [{ ruleId: 'STRUCTURE', employeeId: null, date: null, message: 'Schedule assignments are missing.' }], warnings };
  if (schedule.dates?.join('|') !== days.map(d => d.date).join('|')) add('STRUCTURE', 'Schedule dates do not match the selected Persian month.');
  const ids = new Set(employees.map(e => e.id));
  for (const id of Object.keys(schedule.assignments)) if (!ids.has(id)) add('STRUCTURE', 'Schedule includes an unknown employee.', id);
  const normalized = {};
  for (const employee of employees) {
    const rows = schedule.assignments[employee.id];
    if (!Array.isArray(rows) || rows.length !== days.length) add('STRUCTURE', 'Employee must have one assignment array for every date.', employee.id);
    normalized[employee.id] = days.map((day, i) => {
      const shifts = rows?.[i];
      if (!Array.isArray(shifts) || shifts.some(s => !SHIFTS.includes(s)) || new Set(shifts).size !== shifts.length) { add('STRUCTURE', 'Unknown, duplicate, or malformed shift codes.', employee.id, day.date); return []; }
      return shifts;
    });
  }
  for (let d = 0; d < days.length; d++) {
    const day = days[d], expected = coverage(day, config);
    const ruleIds = { M: day.isHoliday ? 'H02_HOLIDAY_MORNING_COVERAGE' : 'H01_NORMAL_MORNING_COVERAGE', E: 'H03_EVENING_COVERAGE', N: 'H04_NIGHT_COVERAGE', m: day.isHoliday ? 'H05_HOLIDAY_M_ONCALL' : 'H06_NORMAL_NO_M_ONCALL', e: 'H07_E_ONCALL', a: 'H08_A_ONCALL' };
    for (const s of SHIFTS) {
      const found = employees.filter(e => normalized[e.id][d].includes(s)).length;
      if (found !== expected[s]) add(ruleIds[s], `Expected ${expected[s]} employees on ${s}; found ${found}.`, null, day.date);
    }
  }
  for (const employee of employees) {
    const rows = normalized[employee.id];
    let history = [];
    if (boundary.mode === 'continuous' && !employee.radiationBenefit) {
      history = boundary.history?.[employee.id];
      if (!Array.isArray(history) || history.length !== config.maxOffDays || history.some(r => !validHistoryRow(r))) {
        add('INPUT_BOUNDARY', 'Provide the previous month’s final three daily assignments for this employee.', employee.id); history = [];
      }
    }
    let off = 0;
    for (const row of history) off = row.length ? 0 : off + 1;
    for (let d = 0; d < days.length; d++) {
      const row = rows[d], date = days[d].date;
      const fixed = row.filter(s => FIXED.includes(s)).length;
      const onCall = row.filter(s => ON_CALL.includes(s)).length;
      if (fixed && onCall) add('H09_FIXED_ONCALL_CONFLICT', 'Fixed and on-call assignments conflict on the same day.', employee.id, date);
      if (onCall > 1) add('H10_SINGLE_ONCALL_PER_DAY', 'More than one on-call type on the same day.', employee.id, date);
      const maximumFixed = policy.doubles && employee.yearsOfService <= config.doubleShiftMaxYears ? 2 : 1;
      if (fixed > maximumFixed) add('H11_DAILY_FIXED_LIMIT', 'Daily fixed-shift limit exceeded for this employee and search stage.', employee.id, date);
      if (!policy.seniorHolidays && days[d].isHoliday && employee.yearsOfService > config.seniorThreshold && fixed) add('STAGE_SENIOR_HOLIDAY', 'Senior fixed holiday shifts require the senior-holiday exception stage.', employee.id, date);
      const leave = onLeave(input,employee.id,date), pattern = patternShift(employee,days[d]);
      if (leave && row.length) add('H17_REQUESTED_LEAVE', 'An assignment falls on requested leave.', employee.id, date);
      if (!leave && supervisorMorning(employee,days[d]) && !row.includes('M')) add('H19_SUPERVISOR_MORNING', 'Section supervisor requires morning duty on regular workdays.', employee.id, date);
      if (!leave && pattern && !row.includes(pattern)) add('H18_WEEKLY_PATTERN', 'Missing required weekly ' + pattern + ' shift.', employee.id, date);
      if (fixed === FIXED.length) add('H12_NO_TRIPLE_FIXED', 'M + E + N is forbidden.', employee.id, date);
      if (!employee.radiationBenefit) {
        const previous = d > 0 ? rows[d - 1] : history.at(-1) ?? [];
        if (previous.includes('N') && row.includes('M')) add('H13_NON_RADIATION_N_TO_NEXT_M', 'Fixed night is followed by next-day morning.', employee.id, date);
        off = row.length || leave ? 0 : off + 1;
        if (off > config.maxOffDays) add('H14_NON_RADIATION_MAX_THREE_OFF', 'More than three consecutive days without any assignment.', employee.id, date);
      }
    }
    const worked = workedHours(rows, config), required = requiredHours(employee, days, config);
    if (worked + 1e-7 < required) add('H15_REQUIRED_HOURS', `Worked ${worked} h is below required ${required.toFixed(2)} h.`, employee.id);
    if (employee.yearsOfService > config.seniorThreshold && shiftCounts(rows).N > config.seniorNightCap) add('H16_OVER_8_MAX_FOUR_NIGHTS', 'More than four nights for an employee with over eight years of service.', employee.id);
  }
  if (boundary.mode !== 'continuous') warnings.push({ ruleId: 'BOUNDARY_SCOPE', message: 'Validation covers this month only; previous-month assignments were not checked.' });
  return { valid: errors.length === 0, errors, warnings };
}
