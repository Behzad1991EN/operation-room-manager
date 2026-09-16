# Business rules

Authoritative numerical values are in `js/config.js`. The UI does not offer unsupported rule overrides.

| ID | Hard constraint |
|---|---|
| H01_NORMAL_MORNING_COVERAGE | Normal M exactly 8 |
| H02_HOLIDAY_MORNING_COVERAGE | Holiday M exactly 2 |
| H03_EVENING_COVERAGE | E exactly 2 daily |
| H04_NIGHT_COVERAGE | N exactly 2 daily |
| H05_HOLIDAY_M_ONCALL | Holiday m exactly 1 |
| H06_NORMAL_NO_M_ONCALL | Normal m exactly 0 |
| H07_E_ONCALL | e exactly 1 daily |
| H08_A_ONCALL | a exactly 1 daily |
| H09_FIXED_ONCALL_CONFLICT | No same-day fixed plus on-call |
| H10_SINGLE_ONCALL_PER_DAY | At most one on-call type per person/day |
| H11_NON_RADIATION_SINGLE_FIXED | Non-radiation: at most one fixed shift/day |
| H12_RADIATION_NO_TRIPLE_FIXED | Radiation: prohibit M+E+N; all pairs allowed |
| H13_NON_RADIATION_N_TO_NEXT_M | Non-radiation: prohibit N followed by next-day M |
| H14_NON_RADIATION_MAX_THREE_OFF | Non-radiation: every four-day window contains any assignment |
| H15_REQUIRED_HOURS | Fixed worked hours must meet each employee’s requirement |
| H16_OVER_8_MAX_FOUR_NIGHTS | More than 8 years: at most 4 N per month |

Normal days require M/E/N = 8/2/2 and m/e/a = 0/1/1. Holidays require 2/2/2 and 1/1/1. A holiday is a Friday or an explicitly selected official holiday, with each date counted once.

Base required hours = normal-day count × 7.33. Non-radiation required hours = base minus the employee-provided productivity deduction (0–4: 16, 4–8: 20, 8–12: 24, 12–16: 28, 16+: 32). Radiation required hours = base × 0.75 with no productivity or years-of-service deduction. No floor or alternative hospital formula is invented.

M and E each contribute 7 hours; N contributes 13. m/e/a contribute zero. Overtime = max(0, worked − required). Negative requirements in unusually holiday-heavy months are retained as the supplied formula defines; verify the hospital’s calendar and policy if that situation occurs.

Allowed cases include non-radiation N→E, E→M, N→E→M, consecutive working days, and e→a on consecutive days. No restrictions beyond the supplied rules are introduced.

Soft rules: S01 prefers four N for >8 years; S02 prefers three a assignments per employee; S03 compares six separate shift counts with stronger weight for closer experience; S04 penalizes overtime relatively more as years of service increase. All four are preferences only. Numerical scoring choices are transparent optimization heuristics, not hospital hard rules.

**TODO: Business rule requires clarification.** Confirm the required month-boundary policy. The application supports within-month and continuous validation explicitly. Continuous mode needs actual previous-month history; missing history blocks generation. Next-month rules are evaluated when the next month is scheduled. The initial default is labelled “Within this month only.”

Official holidays require manual hospital review. Selection is cleared for review after any holiday change. Persian calendar months are used per user clarification.
