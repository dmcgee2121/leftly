# Leftly App Readiness Checklist

## PWA and icons

- Keep `manifest.webmanifest`, home-screen icons, and splash behavior aligned.
- Verify browser favicon links cover SVG plus PNG fallback.
- Recheck icon cache after favicon updates.

## Local data safety

- Keep Leftly localStorage-only until a deliberate backend phase.
- Make sure the UI says data stays on this device and browser.
- Treat reset wording as destructive and explicit.

## Backup and import

- JSON backup should remain the restore format.
- CSV exports are for spreadsheet review only.
- Import copy should warn that current local data gets replaced.

## Mobile QA

- Check first-load layout on a narrow phone viewport.
- Check installed PWA icon, title, and theme color.
- Confirm the Data tab stays readable and tappable on mobile.

## Future app packaging

- If packaged later, keep icon assets and theme metadata reusable.
- Revisit safe-area behavior, splash assets, and offline expectations.

## Backend later

- If sync is added later, migrate intentionally rather than mutating local-only assumptions in place.
