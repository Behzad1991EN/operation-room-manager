# Data model

```js
{
  schemaVersion: 1,
  employees: [{ id, name, yearsOfService, radiationBenefit, productivityCategory }],
  year: 1405, month: 6,
  holidays: { '1405-06': ['1405-06-01'] },
  holidayReviews: { '1405-06': true },
  histories: { '1405-06': { employeeId: [['E'], [], ['N']] } },
  boundaryMode: 'independent', // or 'continuous'
  config: { /* active rule version and centralized constants */ },
  schedules: {
    '1405-06': {
      input, fingerprint,
      schedule: { dates: ['1405-06-01'], assignments: { employeeId: [['M']] }, createdAt },
      statistics: { elapsedMs, score, optimal, solverStatus, optimizationStatus },
      validation: { valid, errors, warnings }
    }
  },
  demo: false
}
```

Examples are abbreviated; actual months have one assignment array per date for every employee. `[]` means OFF. No employee names appear in LP identifiers; safe internal indices are used.

Calendar days include Persian `date`, Gregorian `isoDate`, `dayNumber`, UTC `dayOfWeek`, `isFriday`, `isOfficialHoliday`, and the union `isHoliday`. The user always selects a Persian year/month. Official holiday records use Persian dates; conversion dates are for interoperability and weekday determination.

IDs are safe unique alphanumeric/hyphen/underscore strings, up to 80 characters. Missing IDs are generated during normalization. Names support Unicode; markup is escaped for display and export. Years are finite 0–80. Radiation is an actual boolean after normalization. Non-radiation productivity category must be supplied; ASCII hyphens are normalized to en dashes. Category ranges are labels, not inferred service intervals.

CSV and JSON parsing are separate from normalization and scheduling. Every record validates before any mutation. Imports preview append/replace; duplicate IDs reject the entire append. Blank or malformed CSV rows are reported, not silently dropped. Embedded commas, quotes, newlines, BOM and CRLF are handled. Excel adapters are deferred. Export quotes cells and neutralizes spreadsheet formula-leading text.

Worked hours, requirements, overtime and per-type counts are computed from current inputs and schedules. Snapshots preserve the inputs used for validation. Input changes invalidate the current view without silently altering saved assignments. V1 keeps the latest schedule per Persian month.
