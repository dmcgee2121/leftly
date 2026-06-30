# Leftly Backend and Cloud Sync Plan

## Summary

Leftly should keep its local-first feel as the default product experience. Accounts and cloud sync should be added only as an optional extension for users who need device-to-device continuity, disaster recovery, or shared access to the same budget across devices.

The safest path is:

- Keep the current local-only app as the baseline.
- Design the data model and sync identifiers before writing backend code.
- Introduce optional cloud backup/restore before attempting live multi-device sync.
- Delay any always-on sync or conflict-heavy behavior until the import/export model is proven.

## 1. Product Goals

### Why add accounts and cloud sync

Accounts solve a practical problem: users eventually want their budget available on a second device without manually moving JSON files around. The main user value is continuity, not complexity. Cloud support should make it easier to:

- Recover data after device loss or browser reset.
- Move a budget between desktop and mobile.
- Keep the same Leftly budget available on more than one device.
- Restore from a known snapshot without hunting for a local file.

### What this unlocks

- Optional sign-in for users who want cloud continuity.
- Safer recovery than browser storage alone.
- A path to multi-device use without forcing everyone into an account.
- Future shared-device or partner-use scenarios, if those are ever needed.

### What should not change

Leftly should still feel like a simple paycheck budgeting app:

- Overview stays the main dashboard.
- Local use should remain the default.
- Users should still be able to use Leftly without an account.
- JSON backup/export/import should remain available.
- The app should not start feeling like a heavy finance platform.

## 2. Architecture Options

### Option A: Stay local-only for now

**Description**

Keep all data in browser storage and rely on JSON backup/restore for portability.

**Pros**

- Lowest implementation risk.
- No auth, no backend, no privacy overhead.
- Preserves current UX completely.
- No migration complexity.

**Cons**

- No seamless cross-device use.
- Recovery depends on the user keeping a backup.
- Cannot support cloud continuity or account-based features.

**Verdict**

Best as the current baseline, but it does not solve the cross-device problem.

### Option B: Optional account + backup-style cloud restore

**Description**

Add accounts, but start with a cloud-backed restore flow rather than continuous live sync. Users can sign in, upload a full snapshot, and later restore that snapshot on another device.

**Pros**

- Strongest safety/performance ratio for an initial backend.
- Easy to reason about data correctness.
- Avoids immediate conflict resolution complexity.
- Mirrors the current JSON backup mental model.
- Makes account value understandable: sign in to store a restore point.

**Cons**

- Not yet seamless live sync.
- Users may still need to choose when to back up or restore.
- Two-device divergence still exists until live sync arrives.

**Verdict**

Best first backend milestone. It matches Leftly's current backup model and keeps implementation risk low.

### Option C: Full cloud sync

**Description**

Every local change syncs to the cloud and then to other devices automatically.

**Pros**

- Best convenience for multi-device users.
- Lowest friction once it works.
- Easiest end-state for users.

**Cons**

- Highest risk.
- Requires conflict resolution, offline queuing, and duplication prevention from day one.
- More expensive to build and test.
- Riskier to ship into a polished local-first app.

**Verdict**

Good long-term destination, but not the first move.

### Recommendation

Start with **Option B: optional account + backup-style cloud restore**. Treat it as the smallest safe backend milestone. It aligns with the existing JSON backup/import mental model and creates a stable foundation for later live sync.

## 3. Suggested Phased Rollout

### Phase 0: Local-first stays as-is

- No runtime change.
- Continue using localStorage.
- Continue JSON backup/export/import.
- Continue CSV export.

### Phase 1: Backend planning and schema design only

- Define stable cloud record identifiers.
- Draft tables, ownership rules, and sync metadata.
- Decide how backups map to cloud records.
- Decide how conflict resolution will work later.
- No user-facing change.

### Phase 2: Optional auth shell behind a feature flag

- Add sign-in/sign-out UI only if needed for testing.
- Keep the feature flag off by default.
- Do not sync app data yet.
- Verify account creation and session persistence in isolation.
- Optional auth shell implementation begins here, but backup/restore remains a placeholder until backend tables exist.

### Phase 3: Cloud backup/restore, not live sync

- Allow a signed-in user to upload a complete Leftly snapshot.
- Allow restoring that snapshot to another device/account session.
- Preserve the JSON model as the canonical portable format.
- Keep local data unchanged until a restore or explicit push happens.

### Phase 4: Cautious multi-device sync

- Introduce per-table sync metadata.
- Sync only after the backup/restore path is stable.
- Add conflict handling and merge rules.
- Queue offline changes and replay them carefully.
- Add duplicate detection for recurring-generated content.

## 4. Data Model Draft

This section is documentation-only. It is not a migration or schema file.

### `profiles`

**Purpose**

Store user/account metadata.

**Possible fields**

- `id`
- `user_id`
- `display_name`
- `created_at`
- `updated_at`
- `last_sync_at`

**Ownership strategy**

One row per authenticated user. `user_id` should be the primary ownership boundary.

**Notes / risks**

- Keep this minimal.
- Avoid storing budget content here.
- Do not add app settings that belong in user-owned records.

### `pay_periods`

**Purpose**

Store the active pay period and archived period summaries.

**Possible fields**

- `id`
- `user_id`
- `cadence`
- `start_date`
- `end_date`
- `income`
- `base_income`
- `rollover_amount`
- `rollover_applied`
- `source_device_id`
- `source_local_id`
- `created_at`
- `updated_at`
- `deleted_at`

**Ownership strategy**

One record belongs to one user. Device lineage metadata is optional but useful for debugging sync history.

**Notes / risks**

- History snapshots may be better represented as immutable records.
- A pay period can be a root entity for bills and expenses, but not the only root.

### `bills`

**Purpose**

Store both manual bills and recurring-generated bills.

**Possible fields**

- `id`
- `user_id`
- `pay_period_id`
- `name`
- `amount`
- `due_date`
- `category`
- `is_paid`
- `paid_date`
- `source`
- `template_id`
- `generated_for_period_id`
- `carried_over_from_pay_period_id`
- `notes`
- `created_at`
- `updated_at`
- `deleted_at`
- `sync_key`

**Ownership strategy**

Owned by `user_id`. `pay_period_id` links the bill to a period when relevant.

**Notes / risks**

- Duplicate prevention needs a stable `sync_key`, not just title/amount matching.
- Recurring-generated bills should preserve a source/template link so they can be regenerated safely.

### `expenses`

**Purpose**

Store manual expenses, recurring planned spending, and set-asides.

**Possible fields**

- `id`
- `user_id`
- `pay_period_id`
- `name`
- `amount`
- `date`
- `category`
- `is_planned`
- `source`
- `template_id`
- `generated_for_period_id`
- `set_aside_for_template_id`
- `created_at`
- `updated_at`
- `deleted_at`
- `sync_key`

**Ownership strategy**

Owned by `user_id`. Use `pay_period_id` for the active period relationship.

**Notes / risks**

- Set-asides need explicit identity so they do not duplicate.
- Planned expenses and manual expenses must stay distinguishable.

### `recurring_templates` or `bill_plan_items`

**Purpose**

Store Bill Plan items that can generate bills, planned expenses, or set-asides.

**Possible fields**

- `id`
- `user_id`
- `name`
- `amount`
- `category`
- `kind`
- `plan_name`
- `schedule_type`
- `frequency`
- `due_day`
- `day_of_week`
- `anchor_date`
- `set_aside_enabled`
- `set_aside_amount`
- `is_active`
- `created_at`
- `updated_at`
- `deleted_at`
- `sync_key`

**Ownership strategy**

Owned by `user_id`. Treat templates as the durable source, not generated bills.

**Notes / risks**

- This table is the most important source of duplicate-prevention logic.
- Generated rows should reference the template, but the template should not be inferred only from visible text.

### `pay_period_history` or `snapshots`

**Purpose**

Store immutable closeout snapshots.

**Possible fields**

- `id`
- `user_id`
- `pay_period_id`
- `label`
- `archived_at`
- `cadence`
- `start_date`
- `end_date`
- `income`
- `totals_json`
- `bills_json`
- `expenses_json`
- `base_income`
- `rollover_amount`
- `rollover_applied`
- `source_device_id`
- `created_at`

**Ownership strategy**

Owned by `user_id`. Snapshots should be immutable once written.

**Notes / risks**

- Storing snapshot rows as denormalized JSON is acceptable if the purpose is exact historical preservation.
- Do not try to “recompute” history after the fact.

### `preferences`

**Purpose**

Store non-sensitive user preferences.

**Possible fields**

- `user_id`
- `default_pay_cadence`
- `default_category`
- `quick_add_date_behavior`
- `sort_mode`
- `category_order_mode`
- `category_order_json`
- `updated_at`

**Ownership strategy**

One row per user.

**Notes / risks**

- Keep this separate from financial data.
- Preferences can sync, but local overrides should be predictable.

### `sync_metadata` or `backups`

**Purpose**

Track backup uploads, restore points, and sync bookkeeping.

**Possible fields**

- `id`
- `user_id`
- `device_id`
- `backup_version`
- `content_hash`
- `exported_at`
- `restored_at`
- `source`
- `status`
- `created_at`

**Ownership strategy**

Owned by `user_id`, optionally with device lineage.

**Notes / risks**

- Useful for deduping repeated imports and tracing which device wrote what.
- Should remain auxiliary, not a source of truth for the budget itself.

## 5. Sync and Migration Strategy

### Mapping localStorage data to cloud rows

Current local data should be treated as a complete snapshot:

- `activeBudgetPeriod` maps to `pay_periods`.
- `bills` map to `bills`.
- `expenses` map to `expenses`.
- `recurringTemplates` map to `recurring_templates`.
- `payPeriodHistory` maps to `pay_period_history` or `snapshots`.
- `preferences` map to `preferences`.
- Category order and sort mode map to preference-like settings.

The safest import strategy is a one-time snapshot upload that preserves IDs where possible.

### Preserving IDs and stable sync IDs

Use two layers of identity:

- Existing local IDs remain the visible item IDs when importing into cloud.
- A stable `sync_key` or equivalent dedupe key is used to detect duplicates across devices and repeated uploads.

Recommended identity rules:

- Keep current item IDs when importing local data.
- Add a cloud-side `source_device_id`.
- Add a `sync_key` that combines:
  - entity type
  - user/account
  - template ID if present
  - period ID if relevant
  - due date/date
  - amount
  - normalized name only as a fallback

### Avoiding duplicates

Duplicate prevention should not rely only on visible text.

Rules:

- Recurring-generated bills and expenses should dedupe by template ID plus period key plus occurrence date.
- Manual items should dedupe by their stable ID.
- History snapshots should be immutable and dedupe by snapshot ID.
- Set-asides should have their own explicit identity.

If the same record is uploaded twice, the backend should treat it as an idempotent upsert rather than a new row.

### Importing existing local data into an account

Recommended flow:

1. User signs in.
2. Leftly shows a clear choice: upload current local budget to cloud, or restore from cloud.
3. If the user chooses upload, the app sends the current local snapshot as the initial canonical cloud state.
4. Local IDs are preserved when feasible.
5. Cloud rows are written with `user_id` ownership and sync metadata.
6. Local app state remains intact unless the user explicitly restores from cloud.

### Conflict strategy

For phase 3 backup/restore:

- There are no merge conflicts because the whole snapshot is replaced intentionally.

For phase 4 live sync:

- Prefer last-write-wins only for non-financial metadata if necessary.
- Prefer deterministic merge rules for recurring templates and generated items.
- Prefer append-only history snapshots.
- For bills/expenses, use record-level conflict resolution, not whole-dataset replacement.

### Offline behavior

Local-first behavior should continue offline:

- Users can keep editing locally.
- Changes queue until connectivity returns.
- Cloud sync attempts should fail soft, not block usage.
- The app should show that the latest changes are still stored locally if sync is delayed.

### Two-device behavior

If the same account is used on two devices:

- Phase 3: each device can restore from cloud independently, but later changes do not automatically merge.
- Phase 4: each device should sync changes by record ID and sync key.

If both devices edit the same item:

- Resolve by timestamp and entity type.
- Prefer preserving user-entered data over regenerated data.
- Never duplicate recurring-generated items just because they were created on two devices.

### If cloud and local data disagree

Recommended rule:

- Cloud should be treated as the restore source only when the user explicitly chooses it or when an explicit sync policy says the cloud version wins.
- Local should continue to be authoritative for unsynced edits on that device.

When conflict exists, show a clear choice rather than guessing if the divergence could lose data.

## 6. Security and Privacy Plan

### Row Level Security expectations

Every user-owned table should be protected by Row Level Security with policies that only allow access to rows where `user_id` matches the authenticated user.

### User-owned records only

Budget content must never be accessible across accounts. The core principle is:

- user account owns data
- device does not own data
- anonymous access should not expose synced cloud records

### No bank connection in this phase

Cloud sync should not imply bank feeds or financial institution access.

### How to communicate optional cloud sync

The UI should say:

- local-only remains supported
- cloud sync is optional
- no bank connection is required
- JSON backup/export/import still exists

### Sensitive data

Potentially sensitive data includes:

- income
- bill names and amounts
- expense names and amounts
- pay period dates
- history snapshots
- preferences that reveal budgeting habits

### Basic privacy expectations

- Minimize stored personal metadata.
- Store only what the app needs.
- Do not mix budget data with auth/profile data unnecessarily.
- Be explicit about what is synced and what remains local.

## 7. Backup / Restore Plan

### JSON backup/export/import should remain

JSON backup should remain a first-class escape hatch even after cloud sync exists.

Reason:

- it is already part of the app mental model
- it supports offline recovery
- it gives users a portable archive independent of the account system

### Cloud data export to JSON

Cloud data should be exportable back to the same JSON shape, or a clearly documented superset that still imports safely.

Recommended rule:

- Cloud export should remain compatible with current backup import.
- Older JSON backups should continue to import.
- Backup import should not require a network connection if the goal is local restore.

### Reset when cloud sync exists

Reset needs a carefully worded meaning:

- local reset should clear the local device state
- cloud reset should only happen after explicit user confirmation
- “reset local data” and “delete cloud data” should be separate actions

### Preventing accidental cloud data loss

Safety rules:

- Do not let local reset silently delete cloud data.
- Require an extra confirmation for cloud delete.
- Show the last cloud backup / sync time if available.
- If a user is signed in, make the destructive scope clear.

## 8. Future Implementation Checklist

### Exact order of future backend work

1. Define the target data model and sync keys.
2. Draft RLS policies and account ownership model.
3. Add auth shell behind a feature flag.
4. Add cloud snapshot backup/restore.
5. Verify import/export compatibility.
6. Add device metadata and sync bookkeeping.
7. Introduce live sync only after backup/restore is stable.
8. Add conflict handling and duplicate prevention for recurring content.
9. Expand manual QA to cover offline and dual-device cases.

### Risks

- Duplicate recurring-generated items if sync keys are too weak.
- Unintended data loss if reset scope is unclear.
- Conflict bugs if live sync is shipped before backup/restore is stable.
- Overcomplication if cloud and local storage are mixed too early.

### Testing requirements

Minimum future testing should include:

- local-only app still works unchanged
- fresh account sign-up
- sign-in/sign-out
- upload current local snapshot
- restore cloud snapshot on another device
- offline edits queue and recover
- duplicate apply of Bill Plan does not duplicate items
- history snapshots remain exact
- JSON backup/import still round-trips
- destructive actions only affect the intended scope

### Rollback plan

The backend rollout should be feature-flagged and reversible.

If problems appear:

- disable auth and sync entry points
- keep local-only app functioning
- keep JSON backup/import alive
- stop writing new cloud records before attempting schema changes

### What should be feature-flagged

- auth UI
- cloud restore/upload
- live sync
- conflict resolution UI
- any automatic cloud write on save

### Manual testing before deploy

Before any backend-facing deploy:

- verify local data still loads
- verify JSON backup/import round-trip
- verify cloud upload and restore on a clean browser
- verify offline mode does not block editing
- verify no duplicate recurring items across repeated syncs
- verify reset wording matches the real data scope

## Recommended First Backend Milestone

Build an **optional authenticated cloud backup/restore flow** with no live sync.

Why this first:

- It is the smallest backend step that provides real user value.
- It matches the existing JSON backup model.
- It avoids immediate conflict-resolution complexity.
- It creates a stable foundation for eventual multi-device sync.

## Suggested Next Issue

The next implementation ticket should be:

**Add optional auth shell and cloud backup/restore behind a feature flag, with local-first behavior preserved.**

That ticket should only add the minimum backend plumbing needed to sign in and upload or restore a complete budget snapshot. It should not attempt live sync yet.
