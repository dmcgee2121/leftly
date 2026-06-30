# Leftly Cloud Backup Setup

This document explains the optional cloud-auth shell that is currently behind a feature flag.

## Required environment variables

Use Vite public client env vars only:

- `VITE_LEFTLY_CLOUD_ENABLED`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

### Example local setup

```bash
VITE_LEFTLY_CLOUD_ENABLED=true
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
```

## How to enable or disable it

- Set `VITE_LEFTLY_CLOUD_ENABLED=true` to show the cloud backup shell in the Data screen.
- Set `VITE_LEFTLY_CLOUD_ENABLED=false` or omit it to hide cloud UI completely.
- If the feature flag is on but `VITE_SUPABASE_URL` or `VITE_SUPABASE_PUBLISHABLE_KEY` is missing, Leftly shows a safe unavailable state and continues working locally.

## What is implemented now

- Optional cloud UI gating behind a feature flag.
- Supabase client setup using the public publishable key only.
- Magic-link email auth shell with signed-out, loading, signed-in, and sign-out states.
- Cloud backup/restore UI shell in the Data screen.
- Clear placeholder handling for upload and restore until backend tables exist.

## What is intentionally deferred

- Live sync.
- Automatic cloud writes.
- Conflict resolution.
- Backend tables and migrations.
- Any destructive cloud delete flow.
- Any bank connection or Plaid integration.

## What Supabase setup is still needed later

- Auth configuration for the project.
- Storage or table design for snapshots and metadata.
- Row Level Security policies for user-owned records.
- A real upload path for current local snapshots.
- A real restore path for cloud snapshots.

## Why local-first remains the default

Leftly is still a local-first budgeting app. Cloud sync is optional and should never be required to use the app or to keep working locally. JSON backup/export/import remains the portable recovery path.

## Security warning

Do not use a Supabase service-role key or any secret key in frontend code. The browser should only receive the public publishable key and only through Vite client env vars.
