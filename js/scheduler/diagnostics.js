import { CONFIG, FIXED, ON_CALL, coverage } from '../config.js';
import { requiredHours } from '../services/hours.js';
export function preflight(input) {
  const { employees, days, config = CONFIG } = input;
  const errors = [];
  const availableHours = days.reduce((t, d) => t + FIXED.reduce((s, k) => s + coverage(d, config)[k] * config.hours[k], 0), 0);
  const minimumHours = employees.reduce((s, e) => s + Math.max(0, Math.ceil(requiredHours(e, days, config) - 1e-7)), 0);
  if (minimumHours > availableHours) errors.push({ ruleId: 'H15_REQUIRED_HOURS', message: `Employees require at least ${minimumHours} whole fixed hours, but exact staffing supplies only ${availableHours} hours.` });
  const nightCapacity = employees.reduce((s, e) => s + (e.yearsOfService > config.seniorThreshold ? config.seniorNightCap : days.length), 0);
  const nightsNeeded = days.reduce((s, d) => s + coverage(d, config).N, 0);
  if (nightCapacity < nightsNeeded) errors.push({ ruleId: 'H16_OVER_8_MAX_FOUR_NIGHTS', message: `Night capacity is ${nightCapacity} assignments; ${nightsNeeded} are required.` });
  const rad = employees.filter(e => e.radiationBenefit).length, nonRad = employees.length - rad;
  for (const day of days) {
    const counts = coverage(day, config), calls = ON_CALL.reduce((s, k) => s + counts[k], 0), fixed = FIXED.reduce((s, k) => s + counts[k], 0);
    const fixedCapacity = 2 * rad + nonRad - calls - Math.max(0, calls - nonRad);
    if (employees.length < Math.max(...Object.values(counts)) || employees.length < calls || fixedCapacity < fixed) {
      errors.push({ ruleId: 'H09_FIXED_ONCALL_CONFLICT', date: day.date, message: `Insufficient distinct employees for this day’s fixed and on-call coverage (${employees.length} employees available).` }); break;
    }
  }
  return { errors, availableHours, minimumHours };
}
