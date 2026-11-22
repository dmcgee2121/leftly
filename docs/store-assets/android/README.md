# Google Play store assets (Android, Leftly 1.0.0)

Made in LFT-010 from the real app with demo data (no personal data).

| File | Play Console field | Spec |
| --- | --- | --- |
| `app-icon-512.png` | App icon | 512 × 512 PNG with alpha (same as the PWA icon) |
| `feature-graphic-1024x500.png` | Feature graphic | 1024 × 500, RGB PNG, no transparency |
| `screenshots/01–06-*.png` | Phone screenshots | 1080 × 1920 (9:16), RGB PNG, no transparency |

Upload the screenshots in this order:

1. **Safe to spend** — "Know what's safe to spend · Every paycheck, at a glance"
2. **Quick add** — "Add spending in seconds · One tap from any screen"
3. **Bill Plan** — "Plan bills before they're due · Recurring bills, ready each payday"
4. **History** — "See how each paycheck went · Averages and trends over time"
5. **Forecast** — "Look ahead to your next paycheck · Try 'what if' income safely"
6. **Setup** — "Set up in about a minute · No account. No bank connection."

When Leftly Plus launches, screenshots 4–5 show features that become Plus. Their captions will need a "Plus" note then.

## Regenerating

With the app built and `npx vite preview --port 4173` running, plus Python with Playwright:

```bash
python3 scripts/store-assets/capture_screens.py   # raw phone captures (390×780 @3x) → store-assets-raw/
python3 scripts/store-assets/frame_screens.py     # captioned 1080×1920 frames → store-assets-out/
python3 scripts/store-assets/feature_graphic.py   # 1024×500 banner (run from repo root)
```

Convert outputs to RGB (no alpha) before uploading.
