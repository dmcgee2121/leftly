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

## Release prep

- Run `npm run build` before release-facing merges.
- Keep release-prep fixes narrow: copy, layout, tappability, and safe local-only flows.
- Recheck first-run, import/export wording, and demo-data warnings after onboarding changes.

## Onboarding and first run

- Keep setup short: pay cadence, income, pay period dates, then an optional first Bill Plan item.
- Keep local-only trust copy visible: data stays on this device, no bank connection, backups export from Data.
- Make new-user empty states point to the next action instead of explaining the whole app.
- Keep demo data wording clear that it is sample data and replaces current local data on this device.

## Future app packaging

- If packaged later, keep icon assets and theme metadata reusable.
- Revisit safe-area behavior, splash assets, and offline expectations.

## Backend later

- If sync is added later, migrate intentionally rather than mutating local-only assumptions in place.
