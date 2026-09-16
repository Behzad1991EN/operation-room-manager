export const CONFIG = Object.freeze({
  version: 1,
  hours: { M: 7, E: 7, N: 13, m: 0, e: 0, a: 0 },
  staffing: { normal: { M: 8, E: 2, N: 2, m: 0, e: 1, a: 1 }, holiday: { M: 2, E: 2, N: 2, m: 1, e: 1, a: 1 } },
  dailyBaseHours: 7.33,
  radiationFactor: 0.75,
  deductions: { '0–4': 16, '4–8': 20, '8–12': 24, '12–16': 28, '16+': 32 },
  seniorThreshold: 8,
  seniorNightCap: 4,
  targetA: 3,
  maxOffDays: 3,
  weights: { S01: 8, S02: 3, S03: 1, S04: 0.05 },
  search: { feasibilitySeconds: 35, optimizationSeconds: 15, randomSeed: 42 },
});
export const SHIFTS = Object.keys(CONFIG.hours);
export const FIXED = ['M', 'E', 'N'];
export const ON_CALL = ['m', 'e', 'a'];
export const SHIFT_NAMES = { M: 'Morning', E: 'Evening', N: 'Night', m: 'Morning on-call', e: 'Evening on-call', a: 'Evening + night on-call' };
export const coverage = (day, config = CONFIG) => config.staffing[day.isHoliday ? 'holiday' : 'normal'];
export const RULES = [
  ['H01_NORMAL_MORNING_COVERAGE', 'Normal-day mornings', 'Exactly 8 employees on M.'],
  ['H02_HOLIDAY_MORNING_COVERAGE', 'Holiday mornings', 'Exactly 2 employees on M.'],
  ['H03_EVENING_COVERAGE', 'Evening coverage', 'Exactly 2 employees on E every day.'],
  ['H04_NIGHT_COVERAGE', 'Night coverage', 'Exactly 2 employees on N every day.'],
  ['H05_HOLIDAY_M_ONCALL', 'Holiday morning on-call', 'Exactly 1 employee on m.'],
  ['H06_NORMAL_NO_M_ONCALL', 'Normal morning on-call', 'No m assignments on normal days.'],
  ['H07_E_ONCALL', 'Evening on-call', 'Exactly 1 employee on e every day.'],
  ['H08_A_ONCALL', 'Evening + night on-call', 'Exactly 1 employee on a every day.'],
  ['H09_FIXED_ONCALL_CONFLICT', 'Separate fixed and on-call', 'An employee cannot have both on the same day.'],
  ['H10_SINGLE_ONCALL_PER_DAY', 'One on-call type', 'At most one on-call type per employee per day.'],
  ['H11_NON_RADIATION_SINGLE_FIXED', 'Single fixed shift', 'Without radiation benefit: at most one fixed shift per day.'],
  ['H12_RADIATION_NO_TRIPLE_FIXED', 'No triple fixed shifts', 'With radiation benefit: M + E + N is forbidden; pairs are allowed.'],
  ['H13_NON_RADIATION_N_TO_NEXT_M', 'Night → morning', 'Without radiation benefit: N followed by next-day M is forbidden. N → E and E → M are allowed.'],
  ['H14_NON_RADIATION_MAX_THREE_OFF', 'Maximum three OFF days', 'Without radiation benefit: no four consecutive days without any assignment. On-call counts as an assignment.'],
  ['H15_REQUIRED_HOURS', 'Meet required hours', 'Each employee’s fixed worked hours must meet or exceed required hours.'],
  ['H16_OVER_8_MAX_FOUR_NIGHTS', 'Experienced staff night limit', 'More than 8 years of service: at most 4 fixed nights per month.'],
  ['S01_OVER_8_TARGET_FOUR_NIGHTS', 'Four-night preference', 'For employees with more than 8 years of service, prefer 4 nights. Fewer is valid.'],
  ['S02_TARGET_THREE_A', 'Three a assignments', 'Prefer approximately 3 evening + night on-call assignments per employee.'],
  ['S03_SIMILAR_EXPERIENCE_DISTRIBUTION', 'Balance each shift type', 'Compare all six shift-type counts, with greater weight for closer years of service.'],
  ['S04_OVERTIME_EXPERIENCE_PREFERENCE', 'Overtime by experience', 'Prefer relatively less overtime as years of service increase. Senior overtime is allowed.'],
];
