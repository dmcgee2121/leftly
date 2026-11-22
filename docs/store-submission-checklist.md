# Store submission checklist

## 1. Completed before native packaging

- [x] Product identity established (Leftly, 0.9.0 release-candidate baseline)
- [x] Mature PWA/mobile experience
- [x] Automated tests
- [x] GitHub Actions CI
- [x] Public Privacy page
- [x] Public Support page
- [x] Store listing draft
- [x] Source-backed disclosure inventory

## 2. Phase 16 — native packaging

- [x] Native packaging technology decision: Capacitor 8
- [x] Android project; iOS project
- [x] Application ID; Bundle ID: `com.leftly.app`
- [x] Target API: Android 16 / API 36; minimum Android version: API 24; minimum iOS version: 15.0
- [x] Native app icons and launch/splash assets generated from `assets/icon.svg` and `assets/splash.svg`; safe-area-aware web layout retained
- [x] Android back behavior; external HTTPS link handling
- [x] JSON and CSV native export via temporary cache file plus native share sheet; JSON import retains the WebView file-input flow pending device QA
- [x] Offline behavior and service-worker/native-shell separation; native deep-link callback route
- [x] Native permission audit: generated Android manifest declares only `android.permission.INTERNET`; reproducible build commands added

## 3. Phase 17 — physical Android QA

- [x] Android debug APK built with the committed Gradle wrapper
- [x] Physical Samsung install and package identity verified
- [x] Native launcher identity and branded splash verified
- [x] Offline native launch verified
- [x] Local persistence verified after close/reopen
- [x] Android Back navigation verified
- [x] Native JSON and CSV export verified
- [x] Native JSON import and restore confirmation verified
- [x] Privacy and Support pages verified in the native app
- [x] External HTTPS link handling verified
- [x] Keyboard/forms, rotation, and app lifecycle verified
- [x] Native Supabase magic-link callback/auth flow verified

## 4. Owner / developer account work

- [ ] Apple Developer account; Google Play Console account
- [ ] Developer/legal display name; dedicated public support email
- [ ] Copyright owner; final Bundle ID; final Android application ID
- [x] Android owner-controlled upload key created outside the repository and securely backed up
- [ ] Apple signing keys; certificates/profiles
- [ ] Store regions; tax/account details if required
- [ ] Keep credentials and secrets out of the repository

## 5. Store assets

- [ ] Final native app icon; Apple icon asset; Google Play icon
- [x] Feature graphic 1024×500 (LFT-010, `docs/store-assets/android/`)
- [x] Android phone screenshots, 6 captioned at 1080×1920 (LFT-010)
- [ ] iPhone screenshots (later, with iOS)
- [ ] Optional tablet assets if tablet distribution is chosen
- [x] Screenshot captions (LFT-010)
- [ ] Promotional text

## 6. Final submission review

- [ ] Apple App Privacy; Google Data safety; age/content ratings
- [ ] Review notes; reviewer credentials/access if eventually needed
- [ ] TestFlight; Play internal testing
- [x] Version bumped to 1.0.0 (version code 2) in LFT-007
- [ ] Release notes
- [ ] Production/native release checkpoint

## 7. Phase 21 — Android release candidate

- [x] Android release signing configured for an owner-controlled upload key
- [x] Local signing credentials and generated release artifacts excluded from git
- [x] Signed release AAB built and verified locally (version 0.9.0, version code 1; rebuild required for 1.0.0)
- [ ] Google Play App Signing configured
- [ ] Google Play internal testing completed
