# Leftly — approved roadmap

Approved by Donavan (CEO / financier) on 2026-11-20. Full proposal: "Leftly — Business Plan & Roadmap (Proposal 01)".

## Business model

- Free download on Google Play. One in-app purchase, **Leftly Plus**, one-time, about $3.99 (launch week $2.99). No ads, no subscriptions.
- Free keeps everything needed to budget each paycheck, including all saved History and file backups. A user's own data is never locked.
- Plus: insights and trends, History search, forecast and planning horizon, calendar, CSV export, custom categories and targets, and later bill reminders, savings goals and themes.
- The website (leftly.netlify.app) stays free with everything. Plus is Android only.
- Cloud backup is hidden for launch; the code stays for later.
- Testers get Plus free.

## How we work

- Claude is the PM and does one scoped assignment at a time on its own branch, ending in a pull request with checks, phone screenshots and a Netlify deploy preview.
- Donavan reviews and merges. Each gate needs his sign-off before the next phase.
- No stored data is lost or moved without a tested migration.

## Phases

| Phase | Assignments | Gate |
|-------|-------------|------|
| 1. Polish | LFT-001 Safe to Spend first ✅ · LFT-002 friendly dates ✅ · LFT-003 setup inputs first ✅ · LFT-004 cut repeated text, offline popup fix ✅ · LFT-005 tab bar with icons ✅ · LFT-006 split `App.tsx` (part 1) ✅ | — |
| 2. Data safety | LFT-007 hide cloud backup, version 1.0.0 ✅ · LFT-008 lasting phone storage + backup reminders ✅ · LFT-009 full test pass on Donavan's Samsung ✅ (2026-11-22) | **A · Stable:** no data lost in phone tests, all tests pass — **approved by Donavan 2026-11-22** |
| 1.5 Simplify (approved 2026-11-28) | LFT-021 compact list rows · LFT-022 add/edit forms in slide-up panels · LFT-023 tidier Categories and summary grids · LFT-024 Undo instead of delete confirmations | Store screenshots (LFT-010) regenerated after this phase |
| 3. Free launch | LFT-010 store screenshots and feature graphic · LFT-011 Play Console forms (Donavan, with prepared answers) · LFT-012 closed test, 12+ testers for 14 days · LFT-013 production release 1.0 | **B · Live:** Google approves production |
| 4. Leftly Plus | LFT-014 payments profile + Plus product in Play Console (Donavan) · LFT-015 Plus switch, Plus screen, Plus tags · LFT-016 Google Play billing, buy + restore · LFT-017 release 1.1 | **C · Paid:** test purchase, refund and restore work on a real phone |
| 5. New Plus features | LFT-018 bill due reminders · LFT-019 savings goals · LFT-020 themes | — |

## Open decisions

- Public address on the store listing once Plus is sold (needed before LFT-014).
- 12+ Android testers lined up (needed before LFT-012).

Google requires new personal developer accounts to run a closed test with at least 12 testers opted in for 14 continuous days before production access. Internal testing does not count.
