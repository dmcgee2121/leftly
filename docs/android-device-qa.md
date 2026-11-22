# Android device QA record

## Leftly 1.0.0 — LFT-009 (Gate A)

QA date: 2026-11-22

Target: Samsung physical Android device (model and serial intentionally omitted)

Build: debug build installed over the existing 0.9.0 install with `gradlew installDebug` (same debug signature, existing data kept), Leftly `1.0.0`, package `com.leftly.app`

Evidence: the owner ran the LFT-009 checklist and reported "LFT-009 done" with no failures listed. Individual checklist boxes were not ticked, so this record lists the checks the owner reported as passing rather than item-by-item confirmations. No financial data, backup contents or device identifiers are recorded.

Reported passing:

- Upgrade from 0.9.0 kept the owner's existing budget; Help/About shows 1.0.0.
- LFT-001 to LFT-005 changes on device: Safe to Spend first with slim header, friendly dates, new tab bar with center + (Add expense), screens open at the top.
- LFT-007: no cloud backup mentions in Data & backup or Help; no "works offline" popup in the native app.
- Backup reminder: conditional on at least one finished paycheck and no backup in 30 days; the pre-test JSON export normally hides it.
- Airplane mode launch, Android Back behavior, app switching and lock/unlock, rotation.
- LFT-008 restore test: `localStorage.clear(); location.reload()` via chrome://inspect restored the budget from Capacitor Preferences with the "Welcome back" banner; data persisted after a full close.
- Reset all data followed by a full close and reopen did not bring the old budget back.
- JSON import restored the owner's pre-test backup.

---

## Leftly 0.9.0

QA date: 2026-09-19

Target: Samsung physical Android device (model and serial intentionally omitted)

Build: debug APK, Leftly `0.9.0`, package `com.leftly.app`

Evidence: APK installation and package/launch commands succeeded; the owner manually confirmed the native app launched and confirmed the device checks below. No email addresses, financial data, tokens, backup contents, or device serial are recorded.

## Installation and identity

- **PASS** — APK installed with `adb install -r`.
- **PASS** — Package verification found `package:com.leftly.app`.
- **PASS** — ADB launch started `com.leftly.app/.MainActivity`; owner confirmed the app launched.
- **PASS** — Leftly branded launcher icon; not Android/Capacitor template art.
- **PASS** — Help/About shows version `0.9.0`.
- **PASS** — No browser address bar.
- **PASS** — No PWA install prompt.

## Runtime behavior

- **PASS** — Branded splash and cold launch.
- **PASS** — Airplane-mode/offline launch; core UI remained usable without Netlify or service-worker errors.
- **PASS** — Safe local test data persisted after full close and reopen.
- **PASS** — Overview, Quick Add, Bill Plan/recurring, History, More, Data, and Help/About navigation.
- **PASS** — Android Back behavior on overlays, details, edit, and confirmation surfaces.
- **PASS** — JSON export opened the native share/save sheet.
- **PASS** — Current-period and History CSV export opened the native share/save sheet.
- **PASS** — JSON import opened the system picker, showed restore preview/confirmation, and restored the disposable test backup.
- **PASS** — Privacy page opened in the native app.
- **PASS** — Support page opened in the native app.
- **PASS** — External HTTPS links opened in the platform browser.
- **PASS** — Portrait/landscape sanity check.
- **PASS** — Keyboard and add/edit form controls were usable.
- **PASS** — Home/recent-apps/lock lifecycle returned with data intact.
- **PASS** — No crash or blank screen observed.

## Privacy and auth

- **PASS** — `android:allowBackup="false"`; all five configured backup domains are excluded for legacy backup and Android 12+ cloud/device-transfer rules.
- **PASS** — No additional Android permissions; manifest permission remains `android.permission.INTERNET`.
- **PASS** — Native Supabase magic-link auth, including the `com.leftly.app://auth/callback` callback, was tested successfully by the owner.

## Open issues

None reported during this QA session.
