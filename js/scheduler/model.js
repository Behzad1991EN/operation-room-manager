import { CONFIG, SHIFTS, FIXED, ON_CALL, coverage } from '../config.js';
import { requiredHours } from '../services/hours.js';
export const variable = (i, d, s) => `x_${i}_${d}_${s}`;
// LP is built once per phase. Search/backtracking lives in HiGHS branch-and-cut.
export function buildModel(input, optimize = false) {
  const { employees, days, config = CONFIG, boundary = { mode: 'independent' } } = input;
  const rows = [], binaries = [], objective = [];
  let counter = 0;
  const term = (coef, name) => `${coef >= 0 ? '+' : '-'} ${Math.abs(coef)} ${name}`;
  const expression = terms => terms.map(([c, v]) => term(c, v)).join(' ');
  const constrain = (name, terms, comparison, rhs) => rows.push(` ${name}_${counter++}: ${expression(terms)} ${comparison} ${rhs}`);
  const count = (i, shift) => days.map((_, d) => [1, variable(i, d, shift)]);
  const dayTerms = (i, d, shifts = SHIFTS) => shifts.map(s => [1, variable(i, d, s)]);
  const negate = terms => terms.map(([c, v]) => [-c, v]);
  function absolute(name, terms, target, weight) {
    constrain(name, [...terms, [-1, name]], '<=', target);
    constrain(name, [...negate(terms), [-1, name]], '<=', -target);
    objective.push([weight, name]);
  }
  days.forEach((day, d) => {
    for (const s of SHIFTS) constrain(`coverage_${d}_${s}`, employees.map((_, i) => [1, variable(i, d, s)]), '=', coverage(day, config)[s]);
  });
  employees.forEach((e, i) => {
    days.forEach((_, d) => {
      for (const s of SHIFTS) binaries.push(variable(i, d, s));
      if (!e.radiationBenefit) constrain('single', dayTerms(i, d), '<=', 1);
      else {
        constrain('fixed_call', [...dayTerms(i, d, FIXED), ...ON_CALL.map(s => [2, variable(i, d, s)])], '<=', 2);
        constrain('one_call', dayTerms(i, d, ON_CALL), '<=', 1);
      }
      if (!e.radiationBenefit && d > 0) constrain('night_morning', [[1, variable(i, d - 1, 'N')], [1, variable(i, d, 'M')]], '<=', 1);
      if (!e.radiationBenefit && d >= config.maxOffDays) constrain('off_window', Array.from({ length: config.maxOffDays + 1 }, (_, k) => dayTerms(i, d - k)).flat(), '>=', 1);
    });
    if (!e.radiationBenefit && boundary.mode === 'continuous') {
      const history = boundary.history[e.id];
      if (history.at(-1).includes('N')) constrain('boundary_night', [[1, variable(i, 0, 'M')]], '=', 0);
      for (let d = 0; d < config.maxOffDays; d++) {
        const assignedBefore = history.slice(d).reduce((s, row) => s + Number(row.length > 0), 0);
        if (!assignedBefore) constrain('boundary_off', Array.from({ length: d + 1 }, (_, k) => dayTerms(i, k)).flat(), '>=', 1);
      }
    }
    const worked = FIXED.flatMap(s => days.map((_, d) => [config.hours[s], variable(i, d, s)]));
    constrain('required_hours', worked, '>=', requiredHours(e, days, config));
    if (e.yearsOfService > config.seniorThreshold) constrain('senior_nights', count(i, 'N'), '<=', config.seniorNightCap);
    if (optimize) {
      if (e.yearsOfService > config.seniorThreshold) absolute(`senior_${i}`, count(i, 'N'), config.seniorNightCap, config.weights.S01);
      absolute(`oncall_${i}`, count(i, 'a'), config.targetA, config.weights.S02);
      const maxYears = Math.max(1, ...employees.map(p => p.yearsOfService));
      // Required-hour constants can be omitted without changing the optimum.
      objective.push(...worked.map(([c, v]) => [c * config.weights.S04 * (1 + e.yearsOfService / maxYears), v]));
      for (let j = 0; j < i; j++) {
        const pairCount = Math.max(1, employees.length * (employees.length - 1) / 2);
        const weight = config.weights.S03 / ((1 + Math.abs(e.yearsOfService - employees[j].yearsOfService)) * pairCount);
        for (const s of SHIFTS) absolute(`balance_${i}_${j}_${s}`, [...count(i, s), ...negate(count(j, s))], 0, weight);
      }
    }
  });
  return `Minimize\n objective: ${objective.length ? expression(objective) : '0 ' + binaries[0]}\nSubject To\n${rows.join('\n')}\nBinary\n ${binaries.join('\n ')}\nEnd`;
}
export function extractSchedule(result, input) {
  if (!result.Columns) return null;
  const assignments = {};
  for (let i = 0; i < input.employees.length; i++) {
    assignments[input.employees[i].id] = input.days.map((_, d) => SHIFTS.filter(s => {
      const value = result.Columns[variable(i, d, s)]?.Primal;
      if (!Number.isFinite(value) || Math.abs(value - Math.round(value)) > 1e-5) throw new Error('Solver did not return an integral candidate.');
      return value > 0.5;
    }));
  }
  return { dates: input.days.map(d => d.date), assignments, createdAt: new Date().toISOString() };
}
