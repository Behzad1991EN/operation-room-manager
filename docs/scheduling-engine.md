# Scheduling engine

## Actual search strategy

`model.js` builds a mixed-integer linear model with binary `x(employee, day, shift)` variables. HiGHS 1.15.3 runs locally as WebAssembly inside a module Worker. Its branch-and-cut search uses presolve, LP bounds, cuts, branching/backtracking and primal heuristics. It can reconsider every assignment; there is no first-available greedy loop or random schedule generator. A fixed seed makes runs more reproducible, although wall-time cutoffs can still change the final incumbent.

The application performs reliable necessary-capacity checks before invoking the solver: total minimum whole hours against exact staffing hours, aggregate night capacity, and distinct-employee fixed/on-call capacity. Failure proves infeasibility for the stated reason; passing is not a feasibility guarantee.

## Hard model

- Sum employee binaries for every day/shift equals its required coverage.
- Non-radiation sum of all six daily binaries ≤ 1.
- Radiation sum(fixed) + 2×sum(on-call) ≤ 2 and sum(on-call) ≤ 1. This allows each fixed pair and forbids triples or any fixed/on-call mixture.
- Non-radiation N(d) + M(d+1) ≤ 1.
- Non-radiation sum of all assignments over any four consecutive days ≥ 1.
- Weighted fixed hours ≥ individual required hours.
- Senior monthly N sum ≤ 4 when yearsOfService > 8.
- Continuous boundary mode fixes forbidden first-day M from previous N and adds crossing four-day windows from the previous three daily assignments. No history is fabricated.

The first solve uses a zero objective to obtain a feasible solution. Feasible assignments are extracted only when all relevant variables are finite and integral, then checked by the independent validator. The second solve adds the soft objective and is seeded with all assignment binaries from the feasible solution; HiGHS fills the continuous deviation variables. Its persistent model is disposed in a finally block. The first valid candidate is retained if optimization times out, returns no valid incumbent, or does not improve the evaluated score.

## Soft score

The score is minimized. S01 = sum(abs(N−4)) for senior employees, weight 8. S02 = sum(abs(a−3)), weight 3. S03 = mean over employee pairs of the sum of six absolute shift-type count differences divided by (1 + absolute years-of-service difference), weight 1. This continuous similarity weighting avoids inventing a hard “similar years” cutoff. S04 = sum(overtime × (1 + years/max(1, highest years))), weight 0.05. Absolute deviations use nonnegative continuous auxiliary variables. Omitting fixed required-hour constants from the LP objective does not change candidate ordering.

These are configurable developer constants in `CONFIG`; they are shown as read-only on the Rules page. No extra restrictions are created by scoring. The independent score is evaluated from extracted assignments. Hard constraints are never traded for score.

## Outcomes and runtime

Default time limits are 35 seconds for feasibility and 15 for optimization, excluding asset loading/model construction. The UI offers an actual longer-search option (80 + 40 seconds). No global optimum is claimed unless proven. Runtime/resource limits do not prove infeasibility. A validated incumbent can succeed at a solver time limit.

Messages: `GENERATE_SCHEDULE` input; `PROGRESS` phase text; `SUCCESS` with schedule and statistics; `INFEASIBLE` only after a proof/precheck; `ERROR` for failures or a limit without a validated candidate. Cancellation terminates the Worker rather than waiting for a synchronous solve to process a message.

The main thread validates SUCCESS again with a separate `validator.js` that inspects individual arrays and daily coverage. It does not import model building or solver helpers. All H01–H16 are checked, together with shape, dates, duplicate/unknown codes, unknown employees and boundary history. Invalid candidates are never saved as successful.

Source references: [HiGHS JavaScript project](https://github.com/lovasoa/highs-js), [HiGHS solver documentation](https://ergo-code.github.io/HiGHS/). The solver package and license are pinned and locally bundled.
