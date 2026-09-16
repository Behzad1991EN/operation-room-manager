import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, SHIFTS } from '../js/config.js';
import { createCalendar, persianParts } from '../js/services/calendar.js';
import { baseRequiredHours, requiredHours, workedHours } from '../js/services/hours.js';
import { validateSchedule } from '../js/scheduler/validator.js';
import { scoreSchedule } from '../js/scheduler/scoring.js';

const employee = (extra = {}) => ({ id: 'e1', name: 'Test employee', yearsOfService: 5, radiationBenefit: false, productivityCategory: '4–8', ...extra });
function fixture(length = 7, extra = {}) {
  const employees = [employee(extra)], days = createCalendar(1405, 6).slice(0, length);
  return { input: { employees, days, config: CONFIG, boundary: { mode: 'independent' } }, schedule: { dates: days.map(d => d.date), assignments: { e1: days.map(() => []) } } };
}
const ids = f => validateSchedule(f.input, f.schedule).errors.map(e => e.ruleId);
const includes = (f, id) => assert.ok(ids(f).includes(id), id);
const excludes = (f, id) => assert.ok(!ids(f).includes(id), id);

test('01 Friday plus official holiday is counted once', () => {
  const calendar = createCalendar(1405, 6), friday = calendar.find(d => d.isFriday);
  const overlap = createCalendar(1405, 6, [friday.date, friday.date]);
  assert.equal(overlap.filter(d => d.isHoliday).length, calendar.filter(d => d.isFriday).length);
  assert.equal(baseRequiredHours(overlap), baseRequiredHours(calendar));
});
test('02 base required hours use unique normal dates', () => {
  const days = createCalendar(1405, 6, ['1405-06-01']);
  assert.ok(Math.abs(baseRequiredHours(days) - 26 * 7.33) < 1e-9);
});
test('03 radiation required hours ignore service and productivity', () => {
  const days = createCalendar(1405, 6);
  for (const yearsOfService of [0, 8, 20]) assert.equal(requiredHours(employee({ radiationBenefit: true, yearsOfService, productivityCategory: null }), days), baseRequiredHours(days) * .75);
});
test('04 non-radiation uses supplied category, not years', () => {
  const days = createCalendar(1405, 6);
  for (const [category, deduction] of Object.entries(CONFIG.deductions)) assert.equal(requiredHours(employee({ yearsOfService: 1, productivityCategory: category }), days), baseRequiredHours(days) - deduction);
});
test('05 M contributes seven hours', () => assert.equal(workedHours([['M']]), 7));
test('06 E contributes seven hours', () => assert.equal(workedHours([['E']]), 7));
test('07 N contributes thirteen hours', () => assert.equal(workedHours([['N']]), 13));
test('08 all on-call types contribute zero worked hours', () => assert.equal(workedHours([['m'], ['e'], ['a']]), 0));

for (const [number, code, holiday, expected, ruleId] of [
  ['09', 'M', false, 8, 'H01_NORMAL_MORNING_COVERAGE'], ['10', 'M', true, 2, 'H02_HOLIDAY_MORNING_COVERAGE'],
  ['11', 'E', false, 2, 'H03_EVENING_COVERAGE'], ['12', 'N', false, 2, 'H04_NIGHT_COVERAGE'],
  ['13', 'm', true, 1, 'H05_HOLIDAY_M_ONCALL'], ['14', 'm', false, 0, 'H06_NORMAL_NO_M_ONCALL'],
  ['15', 'e', false, 1, 'H07_E_ONCALL'], ['16', 'a', false, 1, 'H08_A_ONCALL'],
]) test(`${number} exact ${code} coverage on ${holiday ? 'holiday' : 'normal day'} is ${expected}`, () => {
  const f = fixture(1); f.input.days[0].isHoliday = holiday;
  f.input.employees = Array.from({ length: 10 }, (_, i) => employee({ id: `e${i}` }));
  f.schedule.assignments = Object.fromEntries(f.input.employees.map((e, i) => [e.id, [i < expected ? [code] : []]]));
  excludes(f, ruleId);
  f.schedule.assignments.e9[0] = [code]; includes(f, ruleId);
  if (expected > 0) { f.schedule.assignments.e9[0] = []; f.schedule.assignments.e0[0] = []; includes(f, ruleId); }
});
test('17 any fixed / on-call pair conflicts, including radiation staff', () => {
  for (const radiationBenefit of [true, false]) for (const fixed of ['M', 'E', 'N']) for (const call of ['m', 'e', 'a']) {
    const f = fixture(1, { radiationBenefit }); f.schedule.assignments.e1[0] = [fixed, call]; includes(f, 'H09_FIXED_ONCALL_CONFLICT');
  }
});
test('18 multiple on-call types on one day fail', () => { const f = fixture(); f.schedule.assignments.e1[0] = ['e', 'a']; includes(f, 'H10_SINGLE_ONCALL_PER_DAY'); });
test('19 all multiple fixed combinations fail for non-radiation staff', () => {
  for (const row of [['M', 'E'], ['M', 'N'], ['E', 'N'], ['M', 'E', 'N']]) { const f = fixture(); f.schedule.assignments.e1[0] = row; includes(f, 'H11_NON_RADIATION_SINGLE_FIXED'); }
});
test('20 radiation triples fail and all pairs are allowed', () => {
  const f = fixture(1, { radiationBenefit: true }); f.schedule.assignments.e1[0] = ['M', 'E', 'N']; includes(f, 'H12_RADIATION_NO_TRIPLE_FIXED');
  for (const row of [['M', 'E'], ['M', 'N'], ['E', 'N']]) { f.schedule.assignments.e1[0] = row; excludes(f, 'H12_RADIATION_NO_TRIPLE_FIXED'); excludes(f, 'H11_NON_RADIATION_SINGLE_FIXED'); }
});
test('21 N followed by M fails only without radiation benefit', () => { const f = fixture(2); f.schedule.assignments.e1 = [['N'], ['M']]; includes(f, 'H13_NON_RADIATION_N_TO_NEXT_M'); f.input.employees[0].radiationBenefit = true; excludes(f, 'H13_NON_RADIATION_N_TO_NEXT_M'); });
test('22 N followed by E is allowed', () => { const f = fixture(2); f.schedule.assignments.e1 = [['N'], ['E']]; excludes(f, 'H13_NON_RADIATION_N_TO_NEXT_M'); });
test('23 N E M and E to next M are allowed', () => { const f = fixture(3); f.schedule.assignments.e1 = [['N'], ['E'], ['M']]; excludes(f, 'H13_NON_RADIATION_N_TO_NEXT_M'); });
test('24 three consecutive OFF days are allowed', () => { const f = fixture(3); excludes(f, 'H14_NON_RADIATION_MAX_THREE_OFF'); });
test('25 four consecutive OFF days fail; every assignment interrupts the run', () => {
  const f = fixture(4); includes(f, 'H14_NON_RADIATION_MAX_THREE_OFF');
  for (const s of SHIFTS) { f.schedule.assignments.e1[2] = [s]; excludes(f, 'H14_NON_RADIATION_MAX_THREE_OFF'); }
  f.schedule.assignments.e1[2] = []; f.input.employees[0].radiationBenefit = true; excludes(f, 'H14_NON_RADIATION_MAX_THREE_OFF');
});
test('26 over eight years permits at most four nights; exactly eight has no cap', () => {
  const f = fixture(5, { yearsOfService: 8.1 }); f.schedule.assignments.e1 = Array.from({ length: 5 }, () => ['N']); includes(f, 'H16_OVER_8_MAX_FOUR_NIGHTS'); f.input.employees[0].yearsOfService = 8; excludes(f, 'H16_OVER_8_MAX_FOUR_NIGHTS');
});
test('27 four nights is a soft target; fewer remains valid under H16', () => {
  const f = fixture(4, { yearsOfService: 9 });
  f.schedule.assignments.e1 = [['N'], ['N'], ['N'], []]; excludes(f, 'H16_OVER_8_MAX_FOUR_NIGHTS'); assert.equal(scoreSchedule(f.input, f.schedule).parts.S01, 1);
  f.schedule.assignments.e1[3] = ['N']; assert.equal(scoreSchedule(f.input, f.schedule).parts.S01, 0);
});
test('28 three a assignments is a soft target only', () => {
  const f = fixture(4); f.schedule.assignments.e1 = [['a'], ['a'], ['a'], []]; assert.equal(scoreSchedule(f.input, f.schedule).parts.S02, 0);
  f.schedule.assignments.e1[3] = ['a']; assert.equal(scoreSchedule(f.input, f.schedule).parts.S02, 1); assert.ok(ids(f).every(id => !id.startsWith('S')));
});
test('29 e a e a on consecutive days is allowed', () => { const f = fixture(4); f.schedule.assignments.e1 = [['e'], ['a'], ['e'], ['a']]; excludes(f, 'H10_SINGLE_ONCALL_PER_DAY'); excludes(f, 'H14_NON_RADIATION_MAX_THREE_OFF'); });
test('30 independent validator catches corrupted assignment structure', () => {
  const f = fixture(1); f.schedule.assignments.e1[0] = ['M', 'M', 'INVALID']; includes(f, 'STRUCTURE');
  f.schedule.dates = ['wrong']; includes(f, 'STRUCTURE');
});
test('31 required-hours shortfall is hard even with good soft targets', () => { const f = fixture(31); includes(f, 'H15_REQUIRED_HOURS'); });
test('32 Persian leap year and conversion are correct', () => {
  assert.equal(createCalendar(1403, 12).length, 30); assert.equal(createCalendar(1404, 12).length, 29);
  assert.equal(createCalendar(1405, 1)[0].isoDate, '2026-03-21');
  assert.deepEqual(persianParts(new Date('2026-03-21T00:00:00Z')), { year: 1405, month: 1, day: 1 });
});
test('33 continuous boundary catches previous-month night and OFF history', () => {
  const f = fixture(1); f.input.boundary = { mode: 'continuous', history: { e1: [[], [], ['N']] } }; f.schedule.assignments.e1 = [['M']]; includes(f, 'H13_NON_RADIATION_N_TO_NEXT_M');
  f.input.boundary.history.e1 = [[], [], []]; f.schedule.assignments.e1 = [[]]; includes(f, 'H14_NON_RADIATION_MAX_THREE_OFF');
  f.input.boundary.history = {}; includes(f, 'INPUT_BOUNDARY');
});
test('34 similarity score compares shift types rather than total assignments', () => {
  const f = fixture(2); f.input.employees.push(employee({ id: 'e2' })); f.schedule.assignments = { e1: [['M'], ['M']], e2: [['E'], ['E']] };
  assert.equal(scoreSchedule(f.input, f.schedule).parts.S03, 4);
  f.schedule.assignments.e2 = [['M'], ['M']]; assert.equal(scoreSchedule(f.input, f.schedule).parts.S03, 0);
});
test('35 calendar validation rejects out-of-range selection', () => { assert.throws(() => createCalendar(1299, 1)); assert.throws(() => createCalendar(1405, 13)); });
