# Store listing metadata draft

All store fields below are drafts based on the current web app and must be reverified against the final native 1.0 build.

## Apple App Store

- **App Name:** Leftly
- **Subtitle:** Local-first paycheck budgeting
- **Primary category:** Finance
- **Secondary category:** Productivity (optional; decide during submission)
- **Promotional Text:** Plan a paycheck, track bills and spending, and see what is left.
- **Description:** Leftly is a local-first paycheck budget tracker. Set up a pay period, plan bills and spending, organize recurring items in Bill Plan, and review saved History. Core budgeting works without an account or bank connection. Save a portable JSON backup when you want a restoreable copy, or export CSV records for a spreadsheet. Optional cloud backup uses a manual upload and restore flow; it is not live sync.
- **Keywords:** paycheck,budget,bills,expenses,spending,finance,local
- **Privacy Policy URL:** https://leftly.netlify.app/privacy/
- **Support URL:** https://leftly.netlify.app/support/
- **Marketing URL:** No separate marketing site is currently planned; use the app site only if the owner approves.
- **Version baseline:** 0.9.0 release candidate; reserve 1.0.0 for the intentional submission milestone.
- **Copyright owner:** OWNER DECISION REQUIRED
- **SKU:** OWNER DECISION REQUIRED
- **Bundle ID:** PHASE 16 / OWNER DECISION
- **Review notes:** No login is required for core budgeting. Leftly works locally. Optional email account and cloud-backup functionality are not required for core use. The app invites reviewers to use sample or fake numbers; no preloaded demo dataset was verified in source.
- **Sign-in/reviewer access:** No credentials should be needed for the core review path. If optional cloud backup is tested, reviewer access and redirect configuration must be finalized in Phase 16.
- **Age/content notes:** No user-generated public feed, ads, bank connection, or mature-content feature was found. Complete Apple's current age-rating questionnaire for the final native build.
- **Screenshot plan:** iPhone screenshots of pay-period setup, Leftly/Safe to Spend, Bill Plan, History, Data/JSON backup, and optional cloud backup clearly labeled as optional. Use only synthetic data.

Apple's current App Store Connect reference sets the app name and subtitle limits at 30 characters, promotional text at 170 characters, description at 4,000 characters, and keywords at 100 bytes. This draft stays within those limits; recheck them in App Store Connect at submission.

## Google Play

- **App Name:** Leftly
- **Short Description:** Local-first paycheck budgeting for bills, spending, and what is left.
- **Full Description:** Leftly helps you plan one paycheck at a time. Add income, bills, spending, and set-asides to see what is left. Use Bill Plan for recurring items and History for saved pay periods. Core budgeting is local-first and does not require an account or bank connection. Export JSON for a portable restoreable backup or CSV for spreadsheet records. Optional cloud backup is manual, stores one latest snapshot for the signed-in account, and is not live sync.
- **Category:** Finance
- **Tags:** budget, personal finance (if available and appropriate in Play Console)
- **Privacy Policy URL:** https://leftly.netlify.app/privacy/
- **Support approach:** https://leftly.netlify.app/support/; public GitHub Issues are the current fallback. Dedicated public support email is OWNER DECISION REQUIRED.
- **Version baseline:** 0.9.0 release candidate
- **Application ID:** PHASE 16 / OWNER DECISION
- **Target API:** Android 16 / API level 36 or higher for new mobile apps submitted from August 31, 2026, per Google's current target API policy.
- **Content rating notes:** Complete the current IARC questionnaire against the final native build; source audit found no ads, bank integration, or public user-generated content.
- **Data safety:** See `docs/store-data-disclosure.md`; final answers require native-build verification.
- **Screenshot plan:** Android phone screenshots of setup, dashboard, Bill Plan, History, Data/JSON backup, and optional cloud backup, using synthetic data.
- **Feature graphic:** Prepare and verify the currently required Google Play feature graphic during asset preparation.
- **Internal testing:** Run a Play internal test with the native shell, offline behavior, import/export, external links, and optional cloud backup before production submission.

Source: [Google Play target API requirements](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en).
