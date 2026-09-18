# Architecture

The browser renders seven hash-routed pages. Navigation works without server rewrites, including a direct reload at `/operation-room-manager/#/schedule`.

`app.js` owns events, imports, downloads and Worker lifecycle. `state.js` owns serializable input state and a deterministic input fingerprint. A saved schedule is current only if its input fingerprint exactly matches current employees, calendar, requested leave, weekly patterns, configuration and boundary history. Changing inputs cancels active generation and hides stale schedules from current reports/exports, while preserving their saved snapshot.

Employee normalization rejects every invalid row atomically. Categories come from employee data. Calendar logic uses UTC date arithmetic and `Intl.DateTimeFormat` with the Persian calendar to locate Nowruz, handle Esfand leap years and map Persian dates to Gregorian ISO dates. Persian strings are domain identifiers and must not be passed to `Date.parse`.

Hours and reports are derived, not persisted on employee objects. UI displays up to two decimals; comparisons use full calculation precision. Exact fixed-hour allocations are integers, while requirements can be fractional.

The main thread sends an immutable plain-data snapshot to `scheduler.worker.js`. The worker loads HiGHS and its local WASM file, builds and solves the hard model, independently checks its incumbent, then attempts soft optimization. It posts real phase messages and a result. Elapsed time is measured with `performance.now`; there are no progress percentages. Worker termination provides immediate cancellation. The main thread independently calls `validateSchedule` again before saving a SUCCESS result.

IndexedDB uses a versioned `application` object store and one atomic state record. Entire application changes are queued and applied to a draft. The new state is published to the UI only after its write transaction completes, so an employee visible after saving survives an immediate reload. Navigation during a write continues to display the last committed state with a Saving indicator. Quota errors are visible and do not claim successful persistence. A failed initial read does not overwrite the stored workspace. Backup/restore uses JSON with explicit preview and validation; employee CSV/JSON import remains a separate workflow.

There is no operational network request, account dependency or third-party telemetry. Public static assets include no operational employee data. The demo module contains fictional labels only. No encryption or access-control guarantees are made about browser storage.

Presentation logic is isolated in `js/ui`. CSV and standalone printable HTML adapters accept a schedule and input snapshot; future Excel/PDF adapters can share that interface. WebAssembly and modules are packaged beneath the same site base.
