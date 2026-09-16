import { normalizeEmployees } from '../models/employee.js';
export function parseCSV(text) {
  const rows = []; let row = [], cell = '', quoted = false, afterQuote = false;
  const input = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (quoted) {
      if (c === '"' && input[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') { quoted = false; afterQuote = true; }
      else cell += c;
    } else if (c === '"') {
      if (cell || afterQuote) throw new Error(`Invalid CSV quote near row ${rows.length + 1}.`);
      quoted = true;
    } else if (c === ',' || c === '\n' || c === '\r') {
      row.push(cell); cell = ''; afterQuote = false;
      if (c !== ',') { rows.push(row); row = []; if (c === '\r' && input[i + 1] === '\n') i++; }
    } else {
      if (afterQuote) throw new Error(`Unexpected character after CSV quote near row ${rows.length + 1}.`);
      cell += c;
    }
  }
  if (quoted) throw new Error('CSV has an unclosed quoted field.');
  if (cell || row.length || afterQuote) { row.push(cell); rows.push(row); }
  if (rows.length < 2) throw new Error('CSV needs a header and at least one employee.');
  const headers = rows.shift().map(h => h.trim());
  if (new Set(headers).size !== headers.length) throw new Error('CSV has duplicate column names.');
  for (const key of ['name', 'yearsOfService', 'radiationBenefit', 'productivityCategory']) if (!headers.includes(key)) throw new Error(`Missing CSV column: ${key}.`);
  return rows.map((values, i) => {
    if (values.length !== headers.length) throw new Error(`CSV row ${i + 2}: expected ${headers.length} columns, found ${values.length}.`);
    return Object.fromEntries(headers.map((key, j) => [key, values[j]]));
  });
}
export function importEmployees(text, filename) {
  const extension = filename.split('.').pop().toLowerCase();
  if (extension === 'csv') return normalizeEmployees(parseCSV(text));
  if (extension === 'json') { const parsed = JSON.parse(text); return normalizeEmployees(Array.isArray(parsed) ? parsed : parsed.employees); }
  throw new Error('Choose a CSV or JSON file. Excel import is planned for a later version.');
}
