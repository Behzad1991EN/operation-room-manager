# Scheduling engine

## Actual search strategy

`model.js` builds a mixed-integer linear model with binary `x(employee, day, shift)` variables. HiGHS 1.15.3 runs locally as WebAssembly inside a module Worker. Its branch-and-cut search uses presolve, LP bounds, cuts, branching/backtracking and primal heuristics. It can reconsider every assignment; there is no first-available greedy loop or random schedule generator. A fixed seed makes runs more reproducible, although wall-time cutoffs can still change the final incumbent.

The application performs reliable necessary-capacity checks before invoking the solver: total minimum whole hours against exact staffing hours, aggregate night capacity, and distinct-employee fixed/on-call capacity. Failure proves infeasibility for the stated reason; passing is not a feasibility guarantee.

## Hard model

- Sum employee binaries for every day/shift equals its required coverage.
- Let cap = 1, except in the final shortage stage where staff with yearsOfService ≤ 4 have cap = 2. Sum(fixed) + cap×sum(on-call) ≤ cap and sum(on-call) ≤ 1, regardless of radiation benefit. No triples or fixed/on-call mixtures are permitted.
- Requested leave fixes all daily binaries to zero. A weekly pattern fixes its required binary to one unless that date is leave.
- The preferred stage fixes all senior fixed holiday binaries to zero; subsequent stages permit them.
- Non-radiation N(d) + M(d+1) ≤ 1.
- Non-radiation sum of all assignments over any four consecutive non-leave days ≥ 1. A window containing requested leave is exempt; leave interrupts the unassigned-day run.
- Weighted fixed hours ≥ individual required hours.
- Senior monthly N sum ≤ 4 when yearsOfService > 8.
- Continuous boundary mode fixes forbidden first-day M from previous N and adds crossing four-day windows from the previous three daily assignments. No history is fabricated.

Feasibility uses up to three zero-objective stages, sharing one feasibility time budget: preferred single shifts with no senior fixed holiday assignments; single shifts allowing senior holidays; then eligible 0–4-year doubles with senior holidays allowed. A later stage is attempted only after a reliable precheck or solver proof makes the previous stage infeasible. A time limit with no candidate returns ERROR, not a relaxed stage. Stage and attempt diagnostics are saved with the result. Feasible assignments are extracted only when all relevant variables are finite and integral, then checked by the independent validator. Optimization stays in the selected stage, adds the soft objective and is seeded with all assignment binaries from the feasible solution; HiGHS fills the continuous deviation variables. Its persistent model is disposed in a finally block. The first valid candidate is retained if optimization times out, returns no valid incumbent, or does not improve the evaluated score.

## Soft score

The score is minimized. S01 = sum(abs(N−4)) for senior employees, weight 8. S02 = sum(abs(a−3)), weight 3. S03 = mean over employee pairs of the sum of six absolute shift-type count differences divided by (1 + absolute years-of-service difference), weight 1. This continuous similarity weighting avoids inventing a hard “similar years” cutoff. S04 = sum(overtime × (1 + years/max(1, highest years))), weight 0.05. Absolute deviations use nonnegative continuous auxiliary variables. Omitting fixed required-hour constants from the LP objective does not change candidate ordering.

S05 counts senior fixed holiday assignments, weight 100. S06 counts extra fixed assignments beyond one per person/day, weight 1000. An auxiliary nonnegative variable bounds each eligible daily fixed count minus one. These weights discourage unnecessary exceptions within the selected stage; they do not prove a globally minimal exception count under a time limit. The staged feasibility order, rather than weights, establishes which exception category may be enabled.

These are configurable developer constants in `CONFIG`; they are shown as read-only on the Rules page. No extra restrictions are created by scoring. The independent score is evaluated from extracted assignments. Hard constraints are never traded for score.

## Outcomes and runtime

Default time limits are 35 seconds for feasibility and 15 for optimization, excluding asset loading/model construction. The UI offers an actual longer-search option (80 + 40 seconds). No global optimum is claimed unless proven. Runtime/resource limits do not prove infeasibility. A validated incumbent can succeed at a solver time limit.

Messages: `GENERATE_SCHEDULE` input; `PROGRESS` phase text; `SUCCESS` with schedule and statistics; `INFEASIBLE` only after a proof/precheck; `ERROR` for failures or a limit without a validated candidate. Cancellation terminates the Worker rather than waiting for a synchronous solve to process a message.

The main thread validates SUCCESS again with a separate `validator.js` that inspects individual arrays and daily coverage. It does not import model building or solver helpers. All H01–H18 and the selected stage restrictions are checked, together with shape, dates, duplicate/unknown codes, unknown employees and boundary history. Invalid candidates are never saved as successful.

Source references: [HiGHS JavaScript project](https://github.com/lovasoa/highs-js), [HiGHS solver documentation](https://ergo-code.github.io/HiGHS/). The solver package and license are pinned and locally bundled.
