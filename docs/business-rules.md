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
| H11_DAILY_FIXED_LIMIT | At most one fixed shift/day for everyone; only the final shortage stage permits two for 0–4 years |
| H12_NO_TRIPLE_FIXED | Prohibit M+E+N for every employee |
| H13_NON_RADIATION_N_TO_NEXT_M | Non-radiation: prohibit N followed by next-day M |
| H14_NON_RADIATION_MAX_THREE_OFF | Non-radiation: every four-day window contains an assignment or requested leave; leave interrupts the run |
| H15_REQUIRED_HOURS | Fixed worked hours must meet each employee’s requirement |
| H16_OVER_8_MAX_FOUR_NIGHTS | More than 8 years: at most 4 N per month |
| H17_REQUESTED_LEAVE | No assignment on requested leave dates; leave overrides weekly patterns |
| H18_WEEKLY_PATTERN | Required employee weekday/shift patterns apply except on leave |

Normal days require M/E/N = 8/2/2 and m/e/a = 0/1/1. Holidays require 2/2/2 and 1/1/1. A holiday is a Friday or an explicitly selected official holiday, with each date counted once.

Base required hours = normal-day count × 7.33. Non-radiation required hours = base minus the employee-provided productivity deduction (0–4: 16, 4–8: 20, 8–12: 24, 12–16: 28, 16+: 32). Radiation required hours = base × 0.75 with no productivity or years-of-service deduction. No floor or alternative hospital formula is invented.

M and E each contribute 7 hours; N contributes 13. m/e/a contribute zero. Overtime = max(0, worked − required). Negative requirements in unusually holiday-heavy months are retained as the supplied formula defines; verify the hospital’s calendar and policy if that situation occurs.

Allowed cases include non-radiation N→E, E→M, N→E→M, consecutive working days, and e→a on consecutive days. No restrictions beyond the supplied rules are introduced.

Soft rules: S01 prefers four N for >8 years; S02 prefers three a assignments per employee; S03 compares six separate shift counts with stronger weight for closer experience; S04 penalizes overtime relatively more as years of service increase. S05 discourages senior fixed holiday assignments; S06 discourages eligible junior double shifts. All six are preferences within the enabled search stage. Numerical scoring choices are transparent optimization heuristics, not hospital hard rules.

**TODO: Business rule requires clarification.** Confirm the required month-boundary policy. The application supports within-month and continuous validation explicitly. Continuous mode needs actual previous-month history; missing history blocks generation. Next-month rules are evaluated when the next month is scheduled. The initial default is labelled “Within this month only.”

Official holidays require manual hospital review. Selection is cleared for review after any holiday change. Persian calendar months are used per user clarification.

## Rules version 2 — shared-chat corrections

The [review and confirmed decisions](rule-review.md) supersede the original same-day radiation/non-radiation distinction. The engine first forbids all pairs and senior fixed holiday shifts; if proven infeasible, it allows senior holiday shifts with singles; only after that stage is proven infeasible does it allow pairs for yearsOfService ≤ 4. Staff over 4 years never receive pairs. Radiation still determines whether N→next M is allowed. Staff over 8 years may take holiday on-call assignments in every stage.

Requested leave is hard unavailability for both fixed and on-call shifts, overrides weekly patterns on those dates, and is exempt from the maximum-three-OFF-day rule. It does not reduce required hours. Weekly patterns are configurable per employee, not hardcoded names; other hard rules can make a pattern infeasible (for example, five required nights for a senior employee).

There is no objective to create discretionary OFF days. Exact staffing can nevertheless require unassigned days when available employees exceed assignment slots. LEAVE and OFF are displayed/exported separately. The month-boundary question above remains open.
