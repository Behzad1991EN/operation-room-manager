import { SHIFTS, SHIFT_NAMES } from '../config.js';
import { employeeReport, hoursText } from '../services/hours.js';
import { PERSIAN_WEEKDAYS } from '../services/calendar.js';
import { onLeave } from '../services/availability.js';
import { stagePolicy } from '../scheduler/policy.js';
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export function csvCell(value) {
  let text = String(value ?? '');
  if (/^[\s]*[=+@\-\t\r]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}
export function scheduleCSV(input, schedule) {
  const header = ['Employee', 'Years of service', 'Radiation benefit', ...input.days.map(d => `${d.date} (${PERSIAN_WEEKDAYS[d.dayOfWeek]})`), 'Worked hours', 'Required hours', 'Overtime hours', ...SHIFTS];
  const rows = input.employees.map(e => {
    const assignments = schedule.assignments[e.id], r = employeeReport(e, input.days, assignments, input.config);
    return [e.name, e.yearsOfService, e.radiationBenefit, ...assignments.map((r,i) => r.join('+') || (onLeave(input,e.id,input.days[i].date) ? 'LEAVE' : 'OFF')), r.workedHours, r.requiredHours.toFixed(2), r.overtimeHours.toFixed(2), ...SHIFTS.map(s => r.counts[s])];
  });
  return '\uFEFF' + [header, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n');
}
export function printableHTML(input, schedule, title) {
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHTML(title)} | Operation Room Manager</title><style>body{font:14px system-ui;color:#132d2a;max-width:1000px;margin:32px auto;padding:20px}h1{font-size:24px}h2{font-size:19px}section{break-inside:avoid;margin:25px 0;padding:20px;border:1px solid #aaa}.days{display:grid;grid-template-columns:repeat(7,1fr);gap:6px}.day{padding:8px;border:1px solid #ddd}.holiday{background:#f3eee2}small{display:block;font-size:10px}b{display:block;padding-top:7px}@media print{@page{size:A4;margin:12mm}body{margin:0;padding:0;font-size:11px}section{padding:12px}.day{padding:5px}}</style><body><h1>Operation Room Manager</h1><p>${escapeHTML(title)} · Solar Hijri calendar · ${input.boundary.mode === 'continuous' ? 'Includes previous-month boundary checks' : 'Within-month validation only'}</p><p>${escapeHTML(stagePolicy(schedule.stage)?.label ?? '')}</p><p>${SHIFTS.map(s => `${s}: ${SHIFT_NAMES[s]}`).join(' · ')} · OFF: no assignment · LEAVE: requested day off</p>${input.employees.map(e => {
    const r = employeeReport(e, input.days, schedule.assignments[e.id], input.config);
    return `<section><h2>${escapeHTML(e.name)}</h2><p>${e.yearsOfService} years · Radiation benefit: ${e.radiationBenefit ? 'Yes' : 'No'} · Worked ${hoursText(r.workedHours)} h · Required ${hoursText(r.requiredHours)} h · Overtime ${hoursText(r.overtimeHours)} h</p><div class="days">${input.days.map((d, i) => `<div class="day ${d.isHoliday ? 'holiday' : ''}"><small>${d.date} (${PERSIAN_WEEKDAYS[d.dayOfWeek]})${d.isHoliday ? ' · Holiday' : ''}</small><b>${schedule.assignments[e.id][i].join(' + ') || (onLeave(input,e.id,d.date) ? 'LEAVE' : 'OFF')}</b></div>`).join('')}</div></section>`;
  }).join('')}</body></html>`;
}
export function download(content, filename, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
