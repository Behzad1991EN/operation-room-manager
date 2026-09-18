import { CONFIG, SHIFTS, FIXED } from '../config.js';
import { employeeReport } from '../services/hours.js';
export function scoreSchedule(input, schedule) {
  const { employees, days, config = CONFIG } = input;
  const rows = employees.map(e => employeeReport(e, days, schedule.assignments[e.id], config));
  const parts = { S01: 0, S02: 0, S03: 0, S04: 0, S05: 0, S06: 0 };
  const maxYears = Math.max(1, ...employees.map(e => e.yearsOfService));
  const pairCount = Math.max(1, employees.length * (employees.length - 1) / 2);
  rows.forEach((r, i) => {
    days.forEach((day,d) => {
      const fixed = schedule.assignments[r.employee.id][d].filter(s => FIXED.includes(s)).length;
      if (day.isHoliday && r.employee.yearsOfService > config.seniorThreshold) parts.S05 += fixed;
      parts.S06 += Math.max(0,fixed-1);
    });
    if (r.employee.yearsOfService > config.seniorThreshold) parts.S01 += Math.abs(config.seniorNightCap - r.counts.N);
    parts.S02 += Math.abs(config.targetA - r.counts.a);
    parts.S04 += r.overtimeHours * (1 + r.employee.yearsOfService / maxYears);
    for (let j = 0; j < i; j++) {
      const similarity = 1 / (1 + Math.abs(r.employee.yearsOfService - rows[j].employee.yearsOfService));
      parts.S03 += SHIFTS.reduce((s, shift) => s + Math.abs(r.counts[shift] - rows[j].counts[shift]), 0) * similarity / pairCount;
    }
  });
  return { parts, weighted: Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, v * config.weights[k]])), total: Object.entries(parts).reduce((s, [k, v]) => s + v * config.weights[k], 0) };
}
