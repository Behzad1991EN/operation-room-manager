import { CONFIG } from './config.js';
import { createCalendar, persianParts, monthKey } from './services/calendar.js';
import { normalizeEmployees } from './models/employee.js';
export function initialState() {
  const { year, month } = persianParts();
  return { schemaVersion: 1, employees: [], year, month, holidays: {}, holidayReviews: {}, schedules: {}, histories: {}, boundaryMode: 'independent', config: structuredClone(CONFIG), demo: false };
}
export function validateStoredState(raw) {
  if (!raw || raw.schemaVersion !== 1) throw new Error('Unrecognized backup or storage version.');
  const employees = normalizeEmployees(raw.employees);
  createCalendar(raw.year, raw.month);
  if (!['independent', 'continuous'].includes(raw.boundaryMode)) throw new Error('Invalid month-boundary mode.');
  for (const key of ['holidays', 'holidayReviews', 'schedules', 'histories']) if (!raw[key] || typeof raw[key] !== 'object' || Array.isArray(raw[key])) throw new Error(`Invalid ${key} data.`);
  for (const [key, dates] of Object.entries(raw.holidays)) {
    const [year, month] = key.split('-').map(Number), valid = new Set(createCalendar(year, month).map(d => d.date));
    if (!Array.isArray(dates) || dates.some(d => !valid.has(d))) throw new Error(`Invalid holiday dates for ${key}.`);
  }
  // First-version rules are immutable. Persisted configuration records the rules version.
  if (raw.config?.version !== CONFIG.version) throw new Error('Unsupported rules version.');
  return { ...raw, employees, config: structuredClone(CONFIG) };
}
export function context(state) {
  const key = monthKey(state.year, state.month);
  return { employees: state.employees, days: createCalendar(state.year, state.month, state.holidays[key] ?? []), config: state.config, boundary: { mode: state.boundaryMode, history: state.histories[key] ?? {} } };
}
export function fingerprint(input) { return JSON.stringify(input); }
export function currentRecord(state) {
  const record = state.schedules[monthKey(state.year, state.month)];
  return record?.fingerprint === fingerprint(context(state)) ? record : null;
}
