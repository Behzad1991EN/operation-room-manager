import { CONFIG } from './config.js';
import { createCalendar, persianParts, monthKey } from './services/calendar.js';
import { normalizeEmployees } from './models/employee.js';
import { validateLeaveRequests } from './services/availability.js';
export function initialState() {
  const { year, month } = persianParts();
  return { schemaVersion: 2, leaveRequests: {}, leaveReviews: {}, employees: [], year, month, holidays: {}, holidayReviews: {}, schedules: {}, histories: {}, boundaryMode: 'independent', config: structuredClone(CONFIG), demo: false };
}
export function validateStoredState(raw) {
  if (!raw || ![1, 2].includes(raw.schemaVersion)) throw new Error('Unrecognized backup or storage version.');
  const employees = normalizeEmployees(raw.employees);
  createCalendar(raw.year, raw.month);
  if (!['independent', 'continuous'].includes(raw.boundaryMode)) throw new Error('Invalid month-boundary mode.');
  for (const key of ['holidays', 'holidayReviews', 'schedules', 'histories']) if (!raw[key] || typeof raw[key] !== 'object' || Array.isArray(raw[key])) throw new Error(`Invalid ${key} data.`);
  for (const [key, dates] of Object.entries(raw.holidays)) {
    const [year, month] = key.split('-').map(Number), valid = new Set(createCalendar(year, month).map(d => d.date));
    if (!Array.isArray(dates) || dates.some(d => !valid.has(d))) throw new Error(`Invalid holiday dates for ${key}.`);
  }
  const leaveRequests = raw.leaveRequests ?? {}, leaveReviews = raw.leaveReviews ?? {};
  for (const data of [leaveRequests, leaveReviews]) if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid leave data.');
  for (const [key, requests] of Object.entries(leaveRequests)) {
    const [year, month] = key.split('-').map(Number);
    validateLeaveRequests(requests, employees, createCalendar(year, month));
  }
  // Retain legacy schedule records for backups, but the new context invalidates them.
  if (![1, CONFIG.version].includes(raw.config?.version)) throw new Error('Unsupported rules version.');
  return { ...raw, schemaVersion: 2, employees, leaveRequests, leaveReviews, config: structuredClone(CONFIG) };
}
export function context(state) {
  const key = monthKey(state.year, state.month);
  return { employees: state.employees, leaveRequests: state.leaveRequests?.[key] ?? {}, days: createCalendar(state.year, state.month, state.holidays[key] ?? []), config: state.config, boundary: { mode: state.boundaryMode, history: state.histories[key] ?? {} } };
}
export function fingerprint(input) { return JSON.stringify(input); }
export function currentRecord(state) {
  const record = state.schedules[monthKey(state.year, state.month)];
  return record?.fingerprint === fingerprint(context(state)) ? record : null;
}
