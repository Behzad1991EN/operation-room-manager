# Verification

## Version 1.2 local verification — 19 September 2026

- All 71 JavaScript tests passed, including supervisor-role normalization, rule-version-two migration, schedule invalidation, holiday/Friday/leave exemptions, conflicting weekly patterns and a full-month solve.
- All 13 browser test cases passed, including saving the supervisor role, reloading it, generating a real schedule and verifying morning duty on all 27 regular days in the test month.
- Syntax checks and production packaging passed. The existing responsive checks include the updated employee form.


## Version 1.1 local verification — 18 September 2026

- All 66 JavaScript tests passed, including real solver tests for the three ordered search stages, requested leave, weekly patterns, exception eligibility, timeout handling and migration of existing data.
- All 13 browser acceptance tests passed in Microsoft Edge in 32.0 seconds. They exercised actual weekly-pattern and leave forms, persistence after reload, the module Worker and WASM solver, and downloaded CSV contents containing Persian weekday names and LEAVE markers.
- Syntax checks and production packaging passed. The seven viewport checks include both new forms. The 320-pixel forms were also visually inspected.
- Requested leave overrides weekly patterns and interrupts the non-radiation OFF-day count. Senior holiday shifts are tried before junior double shifts. Later exceptions require proof that the earlier stage is infeasible; a timeout alone does not enable them.
- Existing employee data migrates to schema 2. Older schedules remain saved records but must be regenerated to be current under version 2 of the rules.

## Original local verification — 16 September 2026

- 50 automated JavaScript tests passed: all 30 requested rules, Persian dates/leap years, input validation, imports/exports, invalidation, boundary history and real solver integrations.
- JavaScript syntax checks passed. Static production packaging passed.
- 13 browser acceptance tests passed in headless Microsoft Edge, including a real module Worker and locally served WebAssembly under `/operation-room-manager/`. The latest local browser run completed in 31.3 seconds.
- The first GitHub workflow exposed an employee-save/reload race. Application changes now commit to IndexedDB before the new state appears. A regression test keeps a real write transaction open for 400 ms, verifies the pending state, and reloads immediately after the saved employee appears. It passes without an arbitrary test delay.
- Employee add/edit/delete (including Persian names), CSV preview/apply, invalid import atomicity, IndexedDB reload, holiday toggling, Friday overlap, review persistence, keyboard operation, cancellation, CSV/print exports and stale-schedule hiding passed.
- Dashboard, employees, calendar, generation, rules, populated employee schedule, matrix container and populated reports were checked at 320, 375, 430, 768, 1024, 1280 and 1440 pixels. No page-level horizontal overflow was found. The full matrix scrolls inside its own region.
- Console/page errors and HTTP failures were checked in the real-worker acceptance test; none were reported.
- Local solves succeeded for 31-day Shahrivar, 30-day Mehr with selected holidays, and 29-day Esfand with actual boundary inputs. Deliberately corrupted schedules were rejected. Known infeasible hours/night/boundary cases were detected. A search timeout without a candidate is reported as undetermined rather than infeasible.
- Soft optimization is bounded and seeded from the valid candidate. The retained score cannot worsen. A global optimum is not promised.
- Desktop dashboard and mobile layouts were visually inspected. Local test screenshots are generated in the ignored `test-results` folder.

## Deployment verification

- Repository: [Behzad1991EN/operation-room-manager](https://github.com/Behzad1991EN/operation-room-manager). The user's initial commit was preserved.
- The [fix workflow](https://github.com/Behzad1991EN/operation-room-manager/actions/runs/35123133004) for commit `7dad3fa` passed syntax checks, all 50 JavaScript tests, all 13 browser tests in Chromium on GitHub's Linux runner, production packaging, and Pages deployment.
- Pages source is **GitHub Actions**, publishing the tested `dist` artifact with the packaged solver. Direct branch publication would omit the generated solver assets and must not be used.
- [The live application](https://behzad1991en.github.io/operation-room-manager/) loaded with its styles, modules and assets beneath the repository subdirectory. The actual module Worker and local WASM solver generated a schedule for 16 fictional employees in Shahrivar 1405 in 18.37 seconds. Every hard rule passed the independent validator within the explicitly selected within-month scope. The retained soft score was 146.94; a global optimum was not proven.
- Hash navigation to the monthly schedule worked. Reloading that URL preserved the employees and generated schedule and displayed `VALID`. No browser console warnings or errors were reported during the live generation and reload checks. The displayed matrix was visually inspected.
- Live verification used only clearly labelled fictional demo employees and a synthetic calendar with Fridays. It does not establish the hospital's official holiday dates or certify a real operational schedule.

## Outstanding business confirmation

Official holidays must be selected from the hospital’s approved calendar. The requirement to enforce month-boundary rules continuously has not yet been confirmed; the UI supports both scopes and labels within-month-only validation explicitly.
