# Operation Room Manager

A browser-only application for monthly operating-room personnel scheduling using the **Solar Hijri / Persian calendar**. Employee data, holidays, schedules and backups remain on the current device. This is not a central hospital database.

## Current status

Version 1 implements employee management, CSV/JSON employee imports with previews, a Persian calendar with manual official holidays, required-hour calculations, a Web Worker constraint solver, independent validation, soft optimization, schedule views, reports, CSV exports, printable HTML, and IndexedDB persistence. Sample employees are fictional and load only when requested.

The app requires explicit review of official holidays before generation. Fridays are automatic. It does not supply an official holiday database or infer movable holidays. Hospital staff must select the approved dates.

## Stack and architecture

HTML5, CSS3, JavaScript ES modules, Web Workers, IndexedDB and the MIT-licensed HiGHS solver compiled to WebAssembly. Node.js is used only for development, testing and packaging; deployment contains static files, including the solver. Production loads no third-party services, fonts, analytics or telemetry.

UI → application state → employee/calendar/hour calculations → Web Worker → mathematical constraint model → HiGHS search → independent assignment validator → saved schedule and reports. The scheduler never uses the DOM. See [architecture](docs/architecture.md) and [scheduling engine](docs/scheduling-engine.md).

## Local development

Requires Node.js 22 or newer.

```sh
npm ci
npm run build
npm run dev
```

Open `http://127.0.0.1:4173/operation-room-manager/`. After edits, rebuild and reload. Opening `index.html` with `file://` is unsupported because browser modules, Workers and WebAssembly need HTTP(S).

## Tests

```sh
npm test
npm run check
npx playwright install chromium
npm run test:browser
```

Unit tests cover the 30 requested cases, Persian leap years, boundary histories, invalid imports, formula-safe CSV, state invalidation and exports. Integration tests solve actual months and deliberately corrupt schedules. Browser tests cover persistence, a real module Worker under a repository subdirectory, cancellation, imports, exports, routing, keyboard interaction, and responsive widths from 320 to 1440 pixels. Test results are recorded in [verification](docs/verification.md).

## GitHub Pages

Repository: https://github.com/Behzad1991EN/operation-room-manager

Expected site: https://behzad1991en.github.io/operation-room-manager/

`.github/workflows/deploy-pages.yml` runs syntax checks, unit/integration tests, builds a static artifact, runs browser tests and deploys only after all checks pass. Pages must use GitHub Actions as its source. Every URL is relative to the repository base; Workers and the local WASM asset work beneath `/operation-room-manager/`. See [deployment](docs/deployment.md) for setup and verified status.

## Structure

```text
index.html           Semantic application shell
css/                 Responsive styles and print rules
js/app.js            UI events and Worker lifecycle
js/state.js          State, input identity and schedule invalidation
js/config.js         Central staffing, hours, targets and weights
js/models/           Employee validation and normalization
js/services/         Calendar, required/worked hours, IndexedDB
js/scheduler/        Model, solver orchestration, validation, scoring
js/workers/          Module Worker entry point
js/import/           CSV/JSON parsing independent of the scheduler
js/export/           CSV and standalone printable HTML
js/ui/               Views
data/                Explicit fictional demo
scripts/             Static packaging, serving and syntax checks
tests/               Pure-function and integration tests
tests/browser/       Browser acceptance tests
docs/                Design, rules, model, deployment and verification
```

## Limitations and business-rule TODOs

- **TODO: Business rule requires clarification.** Confirm whether cross-month night-to-morning and OFF-day rules are mandatory. Both scopes are supported and displayed. The default checks within the selected month only; continuous scope requires the previous month’s final three actual assignments for every non-radiation employee. Future-month checks occur when that next month is generated. Do not treat within-month validation as continuous validation.
- Official holiday selection needs hospital review for every Persian month. No unverified holiday feed is bundled. Date conversion uses the browser’s Unicode Persian calendar implementation, with supported years 1300–1500.
- Search is time-bounded. A validated feasible solution may not be globally optimal. A timeout without a solution is an error/undetermined outcome, never “infeasible.” Cancellation terminates the Worker.
- There is no backend, shared database, sign-in, synchronization, encrypted application storage or regulatory-compliance claim. Browser clearing or changing browser/device does not transfer the workspace. Download backups.
- The import limit is 200 employee records and 2 MB; large optimization problems may take longer on phones. Exact staffing often makes an oversized team infeasible because everyone must meet their minimum hours.
- V1 has no leave, skills, staffing overrides, manual assignment editing, approval workflow, automatic holidays, Excel import/export or native PDF export. Printable HTML can be printed to PDF by the browser. No additional hospital restrictions are assumed.
- A productivity category is required for non-radiation employees and never inferred from overlapping year labels. Years of service do not alter radiation required hours.

## Roadmap

Confirm month-boundary policy; add a verified official holiday import; add Excel adapters; expand report exports; introduce audited manual changes if requested; design multi-user storage and access control as a separate future version.

## Further documentation

[Business rules](docs/business-rules.md) · [Data model](docs/data-model.md) · [Third-party notices](THIRD_PARTY_NOTICES.md)
