# Leftly App Readiness Checklist

## PWA and icons

- Keep `manifest.webmanifest`, home-screen icons, and splash behavior aligned.
- Verify browser favicon links cover SVG plus PNG fallback.
- Recheck icon cache after favicon updates.

## Local data safety

- Keep Leftly localStorage-only until a deliberate backend phase.
- Make sure the UI says data stays on this device and browser.
- Treat reset wording as destructive and explicit.
- Keep backup metadata optional and backward-compatible so older JSON backups still restore cleanly.
- Keep future cloud sync out of scope until a dedicated backend phase.

## Backup and import

- JSON backup should remain the restore format.
- CSV exports are for spreadsheet review only.
- Import copy should warn that current local data gets replaced.
- New backups can include export summary metadata, but import must not require it.

## Mobile QA

- Check first-load layout at `360px` and `390px`.
- Check installed PWA icon, title, and theme color.
- Confirm the Data tab stays readable and tappable on mobile.
- Confirm sticky form footers and primary actions stay above the fixed bottom nav on mobile.
- Smoke test first-run setup, Bill Plan, More, and Data without horizontal scrolling.
- Pass 4 status on `2026-06-26`: `360px` and `390px` were checked in the local Vite app with no horizontal scrolling on first-run, setup, Overview, Bill Plan, or Data.
- Pass 4 status on `2026-06-26`: first-run setup still completed with zero Bill Plan items, one item, multiple items, checked-but-blank rows, ignored extra blank rows, targeted name-only and amount-only validation, and extra-row removal.
- Pass 4 status on `2026-06-26`: mobile bottom nav, More entry points, local backup export buttons, and the compact first-run / setup card layout remained readable on phone widths.

## Release prep

- Run `npm run build` before release-facing merges.
- Keep release-prep fixes narrow: copy, layout, tappability, and safe local-only flows.
- Recheck first-run, import/export wording, and demo-data warnings after onboarding changes.
- Manual release check still recommended before a public checkpoint for: Apply Bill Plan preview/apply, Start New Pay Period rollover + unpaid carryover, Weekly/Biweekly Bill Plan schedule review, and History snapshot review after closing a live period.
- Manual release check still recommended before a public checkpoint for: one full export/import/restore round-trip using a saved JSON backup in a clean browser profile.
- Pass 5 status on `2026-06-26`: closeout copy now calls out the closed period, leftover rollover, unpaid carryover, next pay period summary, and the History save before confirm.
- Pass 6 status on `2026-06-27`: local JSON backup/import/reset round-trip was rechecked with live data, and the Data screen copy now calls out device-only storage, JSON restore, spreadsheet-only CSV export, and destructive reset behavior more explicitly.

## Onboarding and first run

- Keep setup short: pay cadence, income, pay period dates, then an optional first Bill Plan item.
- Keep local-only trust copy visible: data stays on this device, no bank connection, backups export from Data.
- Keep a visible restore-backup path on first-run so a fresh profile or reset can recover without hunting for Data.
- Make new-user empty states point to the next action instead of explaining the whole app.
- Keep demo data wording clear that it is sample data and replaces current local data on this device.

## Future app packaging

- If packaged later, keep icon assets and theme metadata reusable.
- Revisit safe-area behavior, splash assets, and offline expectations.

## Backend later

- If sync is added later, migrate intentionally rather than mutating local-only assumptions in place.
