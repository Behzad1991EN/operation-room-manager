import { CONFIG } from '../config.js';
const safeId = /^[a-zA-Z0-9_-]{1,80}$/;
export function normalizeEmployees(records) {
  if (!Array.isArray(records)) throw new Error('Employees must be an array of records.');
  if (records.length > 200) throw new Error('Import supports up to 200 employees per file.');
  const errors = [], employees = [], ids = new Set();
  records.forEach((row, index) => {
    const prefix = `Record ${index + 1}`;
    if (!row || typeof row !== 'object' || Array.isArray(row)) { errors.push(`${prefix}: expected an employee object.`); return; }
    const name = String(row.name ?? '').trim();
    const years = row.yearsOfService === '' || row.yearsOfService == null ? NaN : Number(row.yearsOfService);
    let radiation = row.radiationBenefit;
    if (typeof radiation === 'string') radiation = ({ true: true, false: false, yes: true, no: false, '1': true, '0': false })[radiation.trim().toLowerCase()];
    let category = String(row.productivityCategory ?? '').trim().replace(/-/g, '–');
    if (category === '' && radiation === true) category = null;
    const id = row.id == null || row.id === '' ? crypto.randomUUID() : String(row.id).trim();
    const before = errors.length;
    if (!name || name.length > 100) errors.push(`${prefix}: name is required (maximum 100 characters).`);
    if (!Number.isFinite(years) || years < 0 || years > 80) errors.push(`${prefix}: yearsOfService must be a number from 0 to 80.`);
    if (typeof radiation !== 'boolean') errors.push(`${prefix}: radiationBenefit must be true or false.`);
    if ((radiation !== true || category !== null) && !Object.hasOwn(CONFIG.deductions, category)) errors.push(`${prefix}: productivityCategory must be 0–4, 4–8, 8–12, 12–16, or 16+.`);
    if (!safeId.test(id) || ['__proto__', 'constructor', 'prototype'].includes(id)) errors.push(`${prefix}: id must be a safe, unique identifier.`);
    if (ids.has(id)) errors.push(`${prefix}: duplicate employee id ${id}.`);
    ids.add(id);
    if (before === errors.length) employees.push({ id, name, yearsOfService: years, radiationBenefit: radiation, productivityCategory: category });
  });
  if (errors.length) { const error = new Error(errors.join('\n')); error.records = errors; throw error; }
  return employees;
}
