import { CONFIG, SHIFTS } from '../config.js';
export function baseRequiredHours(days, config = CONFIG) {
  return (days.length - new Set(days.filter(d => d.isHoliday).map(d => d.date)).size) * config.dailyBaseHours;
}
export function requiredHours(employee, days, config = CONFIG) {
  const base = baseRequiredHours(days, config);
  if (employee.radiationBenefit) return base * config.radiationFactor;
  const deduction = config.deductions[employee.productivityCategory];
  if (deduction === undefined) throw new Error(`Missing productivity category for ${employee.name}.`);
  return base - deduction;
}
export function shiftCounts(assignments = []) {
  const counts = Object.fromEntries(SHIFTS.map(s => [s, 0]));
  assignments.flat().forEach(s => { if (s in counts) counts[s]++; });
  return counts;
}
export function workedHours(assignments, config = CONFIG) {
  const counts = shiftCounts(assignments);
  return SHIFTS.reduce((sum, s) => sum + counts[s] * config.hours[s], 0);
}
export function employeeReport(employee, days, assignments, config = CONFIG) {
  const required = requiredHours(employee, days, config);
  const worked = workedHours(assignments, config);
  return { employee, counts: shiftCounts(assignments), requiredHours: required, workedHours: worked, overtimeHours: Math.max(0, worked - required), shortfallHours: Math.max(0, required - worked) };
}
export const hoursText = n => Number(n).toLocaleString('en', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
