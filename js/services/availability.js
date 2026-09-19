import { FIXED, SHIFTS } from '../config.js';
export const onLeave = (input, employeeId, date) => (input.leaveRequests?.[employeeId] ?? []).includes(date);
export const supervisorMorning = (employee, day) => employee.sectionSupervisor === true && !day.isHoliday && !day.isFriday && day.dayOfWeek !== 5;
export const patternShift = (employee, day) => employee.weeklyPattern?.[day.dayOfWeek] ?? '';
export function validateLeaveRequests(requests, employees, days) {
  if (!requests || typeof requests !== 'object' || Array.isArray(requests)) throw new Error('Invalid requested-leave data.');
  const ids = new Set(employees.map(e => e.id)), dates = new Set(days.map(d => d.date));
  for (const [id, selected] of Object.entries(requests)) {
    if (!ids.has(id) || !Array.isArray(selected) || selected.some(d => !dates.has(d)) || new Set(selected).size !== selected.length) throw new Error('Requested leave must use known employees and unique dates in the selected Persian month.');
  }
  return requests;
}
export function parseLeaveDays(text, days) {
  const digits = String(text).replace(/[۰-۹]/g, c => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).replace(/[٠-٩]/g, c => String('٠١٢٣٤٥٦٧٨٩'.indexOf(c))).trim();
  if (!digits) return [];
  const numbers = digits.split(/[,،\s]+/).map(s => /^\d+$/.test(s) ? Number(s) : NaN);
  if (numbers.some(n => !Number.isInteger(n) || n < 1 || n > days.length)) throw new Error('Enter valid day numbers for this month, separated by commas.');
  return [...new Set(numbers)].sort((a,b) => a-b).map(n => days[n-1].date);
}
export function validHistoryRow(row) {
  if (!Array.isArray(row)) return false;
  if (row.length === 1 && row[0] === 'LEAVE') return true;
  if (row.some(s => !SHIFTS.includes(s)) || new Set(row).size !== row.length) return false;
  return row.length <= 1 || (row.length === 2 && row.every(s => FIXED.includes(s)));
}
export function parseHistoryRow(value) {
  const row = value === 'OFF' ? [] : String(value).split('+');
  if (!validHistoryRow(row)) throw new Error('Choose a valid previous assignment.');
  return row;
}
