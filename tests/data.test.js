import test from 'node:test';
import assert from 'node:assert/strict';
import { importEmployees, parseCSV } from '../js/import/employees.js';
import { normalizeEmployees } from '../js/models/employee.js';
import { csvCell, printableHTML } from '../js/export/schedule.js';
import { initialState, context, currentRecord, fingerprint, validateStoredState } from '../js/state.js';
import { demoEmployees } from '../data/demo.js';
test('CSV imports quoted commas, escaped quotes, BOM and CRLF', () => {
  const employees = importEmployees('\uFEFFname,yearsOfService,radiationBenefit,productivityCategory\r\n"Name, ""Example""",5,false,4-8\r\n', 'team.csv');
  assert.equal(employees[0].name, 'Name, "Example"'); assert.equal(employees[0].productivityCategory, '4–8'); assert.equal(employees[0].radiationBenefit, false);
});
test('CSV does not silently drop invalid rows', () => {
  assert.throws(() => parseCSV('name,yearsOfService,radiationBenefit,productivityCategory\nA,5,false,4-8\n\n'), /row 3/);
  assert.throws(() => parseCSV('name,yearsOfService,radiationBenefit,productivityCategory\n"abc'), /unclosed/);
  assert.throws(() => parseCSV('name,name\nA,B'), /duplicate/);
});
test('JSON normalization is atomic, preserves Unicode, requires supplied category', () => {
  assert.equal(importEmployees('[{"name":"علی رضایی","yearsOfService":2,"radiationBenefit":true}]', 'employees.json')[0].name, 'علی رضایی');
  assert.throws(() => normalizeEmployees([{ name: 'A', yearsOfService: 2, radiationBenefit: false }]), /productivityCategory/);
  assert.throws(() => normalizeEmployees([{ name: 'A', yearsOfService: '', radiationBenefit: true }]), /yearsOfService/);
  assert.throws(() => normalizeEmployees([{ name: 'A', yearsOfService: 2, radiationBenefit: 'unknown' }]), /radiationBenefit/);
});
test('duplicates and prototype names are rejected', () => {
  assert.throws(() => normalizeEmployees([demoEmployees[0], demoEmployees[0]]), /duplicate/);
  assert.throws(() => normalizeEmployees([{ ...demoEmployees[0], id: '__proto__' }]), /identifier/);
});
test('unsupported file types produce useful errors', () => assert.throws(() => importEmployees('', 'team.xlsx'), /Excel import is planned/));
test('CSV formulas are neutralized and quotes escaped', () => { assert.equal(csvCell('=CMD()'), '"\'=CMD()"'); assert.equal(csvCell('Name "A"'), '"Name ""A"""'); });
test('employee or calendar changes invalidate the current schedule', () => {
  const state = initialState(); state.employees = structuredClone(demoEmployees); const key = `${state.year}-${String(state.month).padStart(2, '0')}`;
  state.schedules[key] = { fingerprint: fingerprint(context(state)), marker: true }; assert.ok(currentRecord(state));
  state.employees[0].yearsOfService++; assert.equal(currentRecord(state), null);
});
test('invalid stored calendar is rejected', () => { const s = initialState(); s.month = 15; assert.throws(() => validateStoredState(s)); });
test('print export escapes names and remains standalone', () => {
  const state = initialState(); state.employees = [{ ...demoEmployees[0], name: '<script>bad</script>' }]; const input = context(state), schedule = { assignments: { [state.employees[0].id]: input.days.map(() => []) } };
  const html = printableHTML(input, schedule, 'Month'); assert.ok(html.includes('&lt;script&gt;bad&lt;/script&gt;')); assert.ok(!html.includes('<script>'));
});
