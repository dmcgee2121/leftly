# Android release build

Leftly uses an owner-controlled upload key for Android release artifacts. The upload keystore stays outside the repository, and its credentials are supplied locally through an ignored properties file or environment variables.

## Prerequisites

- Temurin JDK 21
- Android SDK Platform 36 installed (the project's `compileSdk` and `targetSdk`)
- The committed Gradle wrapper
- An owner-controlled upload keystore with a secure backup

## Configure local signing

Copy `android/keystore.properties.example` to `android/keystore.properties` and replace every placeholder locally:

```properties
storeFile=C:/secure/path/outside-the-repository/leftly-upload.jks
storePassword=YOUR_STORE_PASSWORD
keyAlias=YOUR_UPLOAD_KEY_ALIAS
keyPassword=YOUR_KEY_PASSWORD
```

`android/keystore.properties` is ignored by git. Never commit it, the upload keystore, or either password.

As an alternative, supply all four environment variables:

- `LEFTLY_UPLOAD_STORE_FILE`
- `LEFTLY_UPLOAD_STORE_PASSWORD`
- `LEFTLY_UPLOAD_KEY_ALIAS`
- `LEFTLY_UPLOAD_KEY_PASSWORD`

Release builds fail with a clear message if any required value is missing. Debug signing remains unchanged.

## Build

From the repository root:

```powershell
npm ci
npm run native:sync
cd android
.\gradlew.bat bundleRelease
```

The release bundle is written to:

`android/app/build/outputs/bundle/release/app-release.aab`

The generated AAB is ignored and must not be committed.

## Verify signing

With JDK 21 active:

```powershell
jarsigner -verify -verbose -certs android/app/build/outputs/bundle/release/app-release.aab
```

A successful result must report that the JAR is verified. Do not print passwords or private-key material during verification.

## Device testing caution

A release APK uses the owner upload key. It normally cannot replace an installed debug build with the same package ID because the signatures differ. Never uninstall the existing Samsung app without owner approval because uninstalling clears its local data. Prefer Google Play internal testing for release-mode device validation when signatures differ.
