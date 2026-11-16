# Leftly — Play Store polish roadmap

Goal: make Leftly feel like a native phone app, then publish it on Google Play.

How we work:
- Claude acts as Headquarters and does one scoped assignment at a time on its own branch.
- Each assignment ends in a pull request with test results and phone screenshots.
- Donavan reviews the PR, checks it on his phone, and merges it. The next assignment starts only after that review.
- Commits use `[skip netlify]`. Netlify deploys and any Play Console upload happen only when Donavan approves them.
- No changes to how data is stored on the device, so existing users keep their budgets.

## Part 1 — Feels like a real app

| ID | Assignment | Fixes |
|----|------------|-------|
| LFT-001 | Overview first: slim header on Overview, no "Overview" title block, Safe to Spend at the top; every screen and setup step opens scrolled to the top | Wasted top of screen; landing mid-page after setup |
| LFT-002 | Friendly dates everywhere ("Nov 16 – Nov 29" instead of "2026-11-16 to 2026-11-29") | Computer-style dates |
| LFT-003 | Setup flow: input fields first, Exit/Start over moved to a small top-row action, paycheck amount visible without scrolling | Setup puts the wrong things first |
| LFT-004 | Trim repeated copy: one "local / no bank" message on the landing screen, one Add expense entry point on Overview | Repetition |
| LFT-005 | Bottom tab bar with icons, compact height, clear active state, Quick Add explained instead of greyed out before setup | Boxy tabs |
| LFT-006 | Split `App.tsx` (6,300+ lines) into screen files, one screen per assignment, no behaviour changes | Maintenance risk |

## Part 2 — Store launch

| ID | Assignment | Owner |
|----|------------|-------|
| LFT-007 | Version 1.0.0, release notes, final icon check | Claude |
| LFT-008 | Phone screenshots (with sample data) and a 1024×500 feature graphic | Claude |
| LFT-009 | Play Console: app entry, store listing, Data safety, content rating, privacy policy URL | Donavan, with Claude's prepared answers |
| LFT-010 | Closed test: upload the signed AAB, invite 12+ testers, keep them opted in for 14 straight days | Donavan |
| LFT-011 | Apply for production access, then release | Donavan |

Google requires new personal developer accounts to run a closed test with at least 12 testers who stay opted in for 14 continuous days before applying for production access. Internal testing does not count toward this.
