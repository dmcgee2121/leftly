# Store data disclosure inventory

Source audit date: 2026-09-19. This inventory describes current source behavior, not a final native-store declaration.

## Local data

Browser `localStorage` holds the active pay period (dates, cadence, income, rollover), bills (including names, amounts, due/paid dates, categories and notes), expenses (names, amounts, dates, categories), recurring Bill Plan templates, pay-period History snapshots, category targets and custom/order settings, sort mode, preferences, active tab, setup draft, and operational backup/recovery timestamps. Local reset clears these keys.

## Account and authentication data

Optional cloud backup uses Supabase Auth magic-link sign-in. Source passes an email address to `signInWithOtp`, receives a session, and identifies the signed-in user by Supabase user ID; the UI can display the signed-in email or phone value supplied by the session. Core budgeting does not require an account or password.

## Optional cloud data

When configured and chosen by the user, Supabase receives a full JSON backup snapshot, a summary, a SHA-256 content hash, backup version, signed-in user ID, and timestamps. The `cloud_backups` row is upserted by user ID, so one latest snapshot is retained and a new upload replaces the prior snapshot. This is manual upload/restore, not live sync. Cloud restore replaces local Leftly data but retains the cloud copy. Local reset/demo actions do not delete cloud data; source contains no cloud-delete operation.

## Exports and imports

JSON export serializes backup format v1 in the browser; JSON import reads a user-selected file and restores supported local data. CSV exports are browser-created, user-initiated files for current period, History snapshot, or all History records and are not imported for restore. Exported files can include financial information and should be treated as private.

## Network and third-party services

- **Supabase:** optional Auth and `cloud_backups` database access when cloud configuration is enabled and used.
- **Service worker fetch:** requests the built service-worker script as part of PWA/offline lifecycle handling.
- **No other application API endpoints:** found in source.

## Analytics, ads, crash reporting, and bank connections

- Analytics/telemetry SDK: none found.
- Advertising SDK: none found.
- Crash-reporting SDK: none found.
- Bank connection or financial credential integration: none found.

## Permissions

The browser app uses browser storage, browser download/file-selection mechanisms for export/import, clipboard write for the optional feedback-template copy action, and optional PWA installation. The Capacitor native projects use WebView storage and user-initiated temporary cache files plus the native share sheet for JSON/CSV exports. The generated Android manifest declares only `android.permission.INTERNET`, required for optional Supabase auth/cloud backup; it declares no location, camera, microphone, contacts, notification, or storage permission. Final store declarations still require final native-build verification.

## Native storage and auth notes

Capacitor's WebView keeps `localStorage` in the app's local WebView data container; it persists across normal app restarts but is removed if the app is uninstalled or its app data is cleared. No storage migration or new Leftly storage key was added. Native JSON/CSV exports are written to cache only for the share/save operation and then deletion is attempted. Native magic-link auth uses the callback `com.leftly.app://auth/callback` with PKCE; the Supabase dashboard must allow-list that exact redirect URL before native cloud sign-in can complete in production.

## Apple App Privacy draft

**DRAFT — MUST BE REVERIFIED AGAINST FINAL NATIVE 1.0 BUILD.**

Likely disclosures only if optional cloud backup ships enabled: Contact Info (email address) for app functionality/account management; User Content or Financial Info may be implicated by user-entered budget records in the cloud backup; Identifiers (Supabase account user ID); and Diagnostics only if added later (none found now). Data is user-entered and used to provide optional cloud backup. Whether Apple considers each backup field a listed data type, whether it is linked to identity, and whether it is used for tracking must be completed in App Store Connect against the final implementation. No tracking behavior was found.

## Google Data safety draft

**DRAFT — MUST BE REVERIFIED AGAINST FINAL NATIVE 1.0 BUILD.**

Likely declarations only if optional cloud backup ships: email address and account ID collected for account/cloud-backup functionality; user-entered financial/budget content transferred to Supabase when the user manually uploads. Core local-only use does not send budget content to an app backend. Source indicates no ads, analytics, crash reporting, bank credentials, or data sale/sharing for advertising. Confirm retention/deletion controls, encryption, collection/transfer definitions, and all SDK behavior in the final native build and Play Console questionnaire.

## Store asset inventory

- `public/favicon.svg` can potentially serve as the clean source for native icon rendering.
- `public/icons/leftly-icon-192.png` and `public/icons/leftly-icon-512.png` are current web/PWA raster assets; the 512 asset may be reusable where platform specifications permit.
- Final native/store icons still require platform-specific verification. Native 1024-class Apple icon work remains for Phase 16/asset preparation.
- No logo redesign or raster upscaling claim is made by this phase.
