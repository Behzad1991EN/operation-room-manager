# Verification

## Local verification — 16 September 2026

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

Repository creation and GitHub Pages deployment are in progress. Live workflow, asset, routing and worker checks will be recorded after publication.

## Outstanding business confirmation

Official holidays must be selected from the hospital’s approved calendar. The requirement to enforce month-boundary rules continuously has not yet been confirmed; the UI supports both scopes and labels within-month-only validation explicitly.
