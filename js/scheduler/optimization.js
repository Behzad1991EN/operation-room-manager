import { SHIFTS } from '../config.js';
import { buildModel, variable } from './model.js';

export function optimizeSchedule(input, highs, candidate, options) {
  const model = highs.createModel({ format: 'lp', data: buildModel(input, true, candidate.stage) });
  try {
    model.options.set(options);
    const indices = [], values = [], names = [];
    input.employees.forEach((e, i) => input.days.forEach((_, d) => SHIFTS.forEach(s => {
      const name = variable(i, d, s);
      names.push(name); indices.push(model.getColByName(name));
      values.push(candidate.assignments[e.id][d].includes(s) ? 1 : 0);
    })));
    // Seed all assignment binaries; HiGHS fills the continuous deviation variables.
    model.setSolution({ indices, values });
    model.run();
    const status = model.getModelStatus();
    const statusName = Object.entries(highs.constants.modelStatus).find(([, value]) => value === status)?.[0] ?? String(status);
    const solution = model.getSolution().colValue;
    return { Status: status === highs.constants.modelStatus.optimal ? 'Optimal' : statusName, Columns: Object.fromEntries(names.map((name, i) => [name, { Primal: solution[indices[i]] }])) };
  } finally { model.dispose(); }
}
