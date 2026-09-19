# Android device QA record

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
