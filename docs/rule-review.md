# Shared conversation rule review — 18 September 2026

Source: [Shared scheduling discussion](https://chatgpt.com/share/6aace53f-6314-83eb-864a-216a1bb0ecad), read on 18 September 2026. This is a comparison of proposed changes, not the active rule specification. Active rules remain in [business-rules.md](business-rules.md) until the conflicts below are resolved and the corresponding implementation is tested.

The user's latest correction in that conversation supersedes its earlier 0–8-year double-shift proposal. Assistant suggestions in the shared chat are reference material; they do not override the user's browser-only JavaScript / GitHub Pages architecture or authorize a Python/backend rewrite.

## Latest requested changes

- Prefer at most one fixed shift per employee per day, regardless of radiation benefit. If necessary to fill coverage, allow at most two fixed shifts only for employees with 0–4 years of service. The existing implementation instead permits radiation employees to take pairs and prohibits all non-radiation pairs.
- Keep the hard prohibition on fixed N followed by next-day fixed M for employees without radiation benefit. Radiation employees may have N followed by M. This already matches the application.
- Prefer no fixed shifts on Fridays or official holidays for employees with more than eight years of service, with an exception when coverage requires them. This is a new preference.
- Accept requested leave dates for each employee and exclude that employee from all assignments on those dates. The user's wording establishes exclusion; the assistant's subsequent hard-versus-soft question does not negate that wording.
- Accept fixed weekly shift patterns as employee input, with weekday and fixed shift, rather than hardcoding employee names. The examples are Wednesday N / Thursday M, and Tuesday N / Wednesday M.
- Do not introduce an optimization goal that creates discretionary OFF days. The existing solver has no such goal. Exact staffing can still require unassigned days when available employees outnumber assignments; requested leave must be distinguished from those unassigned days.

## Confirmed decisions

Requested leave overrides a fixed weekly shift on the same date: honor the leave and skip that occurrence of the pattern. Confirmed by the user in this project on 18 September 2026.

Requested leave is exempt from the maximum-three-consecutive-OFF-days rule for staff without radiation benefit. Confirmed by the user in this project on 18 September 2026.

## Clarification still needed before scheduler changes

1. Is requested leave exempt from the existing maximum-three-consecutive-OFF-days rule for employees without radiation benefit?
- When coverage needs exceptions, should single holiday shifts for senior employees be tried before junior double shifts, or the reverse?

Any staged shortage search must distinguish proven infeasibility from a time limit without a solution. Existing fixed/on-call conflicts, exact staffing, required hours, and senior night limits remain relevant; weekly patterns that violate a hard rule must produce an explicit diagnostic.

The earlier unresolved month-boundary policy also remains documented in the active business rules.

## Separate export change

The CSV schedule export now adds the Persian weekday in parentheses beside each Solar Hijri date, using the user's requested spellings: شنبه، یکشنبه، دو شنبه، سه شنبه، چهارشنبه، پنج شنبه، جمعه. This does not change assignments, hour calculations or scheduling constraints.
