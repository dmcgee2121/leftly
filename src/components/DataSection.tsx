import { useRef } from 'react'
import type { LeftlyBackupSummary } from '../lib/storage'
import type { BudgetCategory, LeftlyPreferences, PayCadence, QuickAddDateBehavior } from '../types/budget'
import { getLeftlyCloudConfig } from '../lib/cloudConfig'
import { CloudBackupSection } from './CloudBackupSection'

const buttonStyles = {
  primary: 'button-primary',
  secondary: 'button-secondary',
}

const cadenceOptions: Array<{ value: PayCadence; label: string }> = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Biweekly' },
  { value: 'monthly', label: 'Monthly' },
]

const quickAddDateOptions: Array<{ value: QuickAddDateBehavior; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: 'pay-period-start', label: 'Pay period start' },
  { value: 'blank', label: 'Blank / choose each time' },
]

export function DataSection({
  backupSummary,
  categories,
  preferences,
  onPreferencesChange,
  onLocalDataReloaded,
  onExport,
  onImportFile,
  onExportCurrentPeriodCsv,
  onExportAllHistoryCsv,
  onLoadDemoData,
  onReset,
  statusMessage,
  errorMessage,
  isImporting,
}: {
  backupSummary: LeftlyBackupSummary
  categories: BudgetCategory[]
  preferences: LeftlyPreferences
  onPreferencesChange: (preferences: LeftlyPreferences) => void
  onLocalDataReloaded: () => void
  onExport: () => void
  onImportFile: (file: File | null) => void
  onExportCurrentPeriodCsv: () => void
  onExportAllHistoryCsv: () => void
  onLoadDemoData: () => void
  onReset: () => void
  statusMessage: string
  errorMessage: string
  isImporting: boolean
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const cloudConfig = getLeftlyCloudConfig()

  return (
    <div className="grid gap-4">
      <div className="leftly-shell-soft grid gap-3 border-cyan-400/15 bg-cyan-400/5 p-4">
        <p className="text-sm font-semibold text-white">Stored on this device</p>
        <p className="text-sm leading-6 text-slate-300">
          Leftly saves your budget on this device in this browser. No account or bank connection is required.
        </p>
        <p className="text-sm leading-6 text-slate-300">
          Your data stays here unless you export a backup or manually use optional cloud backup. If you reset Leftly,
          clear browser data, switch devices, or test cloud restore, export a JSON backup first. JSON is the restore
          format. CSV exports are spreadsheet-style copies only and cannot be imported back into Leftly.
        </p>
      </div>

      <div className="leftly-shell-soft grid gap-4 p-4">
        <div className="grid gap-1">
          <p className="text-sm font-semibold text-white">Backup and restore</p>
          <p className="text-sm leading-6 text-slate-400">
            Export creates a complete JSON backup you can save somewhere safe and import back into Leftly. Import
            replaces the Leftly data currently saved on this device. Export JSON first before restore, reset, demo
            testing, or cloud restore if you want to keep a recovery copy.
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="leftly-data-stat">
            <p className="leftly-data-stat-label">Active pay period</p>
            <p className="leftly-data-stat-value">{backupSummary.hasActivePayPeriod ? 'Included' : 'None saved'}</p>
          </div>
          <div className="leftly-data-stat">
            <p className="leftly-data-stat-label">Bills</p>
            <p className="leftly-data-stat-value">{backupSummary.billCount}</p>
          </div>
          <div className="leftly-data-stat">
            <p className="leftly-data-stat-label">Expenses</p>
            <p className="leftly-data-stat-value">{backupSummary.expenseCount}</p>
          </div>
          <div className="leftly-data-stat">
            <p className="leftly-data-stat-label">Bill Plan items</p>
            <p className="leftly-data-stat-value">{backupSummary.recurringTemplateCount}</p>
          </div>
          <div className="leftly-data-stat">
            <p className="leftly-data-stat-label">Saved pay periods</p>
            <p className="leftly-data-stat-value">{backupSummary.historySnapshotCount}</p>
          </div>
          <div className="leftly-data-stat">
            <p className="leftly-data-stat-label">Categories</p>
            <p className="leftly-data-stat-value">{backupSummary.categoryCount}</p>
          </div>
          <div className="leftly-data-stat">
            <p className="leftly-data-stat-label">Display settings</p>
            <p className="leftly-data-stat-value">{backupSummary.displaySettingsIncluded ? 'Included' : 'Not saved'}</p>
          </div>
          <div className="leftly-data-stat">
            <p className="leftly-data-stat-label">Preferences</p>
            <p className="leftly-data-stat-value">{backupSummary.preferencesIncluded ? 'Included' : 'Not saved'}</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={onExport} className={`${buttonStyles.primary} w-full`} disabled={isImporting}>
            Export JSON backup
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={`${buttonStyles.secondary} w-full`}
            disabled={isImporting}
          >
            Import JSON backup
          </button>
        </div>

        <div className="leftly-shell-faint grid gap-2 p-3">
          <p className="text-sm font-medium text-white">What a JSON backup includes</p>
          <p className="text-sm leading-6 text-slate-400">
            A JSON backup includes your pay period, bills, expenses, Bill Plan, category targets, saved history,
            categories, display settings, and preferences. Older Leftly backups can still be imported.
          </p>
        </div>
      </div>

      <div className="leftly-banner-warning">
        <p className="text-sm font-semibold text-amber-100">Backup first</p>
        <p className="mt-1 text-sm leading-6 text-amber-50/80">
          Export a backup before resetting data, loading demo data, or making major changes so you can restore your
          budget later.
        </p>
      </div>

      <div className="leftly-shell-soft grid gap-3 p-4">
        <p className="text-sm font-semibold text-white">CSV exports</p>
        <p className="text-sm leading-6 text-slate-400">
          These files open cleanly in Google Sheets, Excel, and Apple Numbers. They are for review in a spreadsheet,
          not for restore.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={onExportCurrentPeriodCsv} className={`${buttonStyles.secondary} w-full`}>
            Export current pay period CSV
          </button>
          <button type="button" onClick={onExportAllHistoryCsv} className={`${buttonStyles.secondary} w-full`}>
            Export all history CSV
          </button>
        </div>
      </div>

      <div className="leftly-shell-soft grid gap-3 p-4">
        <p className="text-sm font-semibold text-white">Reset and demo data</p>
        <p className="text-sm leading-6 text-slate-400">
          Reset permanently clears the Leftly data saved on this device. Export a backup first if you might want to
          restore it later. Demo data loads sample numbers so you can explore Leftly without using real numbers yet,
          and it replaces the current local data on this device. Neither action touches any cloud snapshot.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={onReset} className={`${buttonStyles.secondary} w-full`} disabled={isImporting}>
            Reset all data
          </button>
          <button type="button" onClick={onLoadDemoData} className={`${buttonStyles.primary} w-full`} disabled={isImporting}>
            Load demo data
          </button>
        </div>
      </div>

      <div className="leftly-shell-soft grid gap-3 p-4">
        <p className="text-sm font-semibold text-white">Add Leftly to your phone</p>
        <p className="text-sm leading-6 text-slate-400">
          Open Leftly in your mobile browser, then use the browser menu to add it to your home screen or install it as
          an app if your browser offers that option.
        </p>
      </div>

      <CloudBackupSection
        cloudConfig={cloudConfig}
        backupSummary={backupSummary}
        onLocalDataReloaded={onLocalDataReloaded}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(event) => {
          onImportFile(event.target.files?.[0] ?? null)
          event.currentTarget.value = ''
        }}
      />

      <div className="leftly-banner-warning">
        <p className="text-sm font-semibold text-amber-100">Import warning</p>
        <p className="text-sm leading-6 text-amber-50/80">
          Importing a JSON backup replaces all Leftly data currently saved on this device with the data in that file.
        </p>
        <p className="text-sm leading-6 text-slate-300">
          Export a fresh JSON backup first if you may want to keep what is currently saved here. Older Leftly backups
          still work.
        </p>
        <p className="text-sm leading-6 text-slate-300">
          Only import files that came from Leftly.
        </p>
      </div>

      <div className="leftly-shell-soft grid gap-3 p-4">
        <div className="grid gap-1">
          <p className="text-sm font-semibold text-white">Preferences</p>
          <p className="text-sm leading-6 text-slate-400">These defaults only affect new entries on this device.</p>
        </div>

        <div className="grid gap-3">
          <label className="leftly-field">
            <span>Default pay cadence</span>
            <span className="leftly-input-shell">
              <select
                value={preferences.defaultPayCadence}
                onChange={(event) =>
                  onPreferencesChange({
                    ...preferences,
                    defaultPayCadence: event.target.value as PayCadence,
                  })
                }
              >
                {cadenceOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </span>
          </label>

          <label className="leftly-field">
            <span>Default category</span>
            <span className="leftly-input-shell">
              <select
                value={preferences.defaultCategory}
                onChange={(event) =>
                  onPreferencesChange({
                    ...preferences,
                    defaultCategory: event.target.value as BudgetCategory,
                  })
                }
              >
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </span>
          </label>

          <label className="leftly-field">
            <span>Quick Add date</span>
            <span className="leftly-input-shell">
              <select
                value={preferences.quickAddDateBehavior}
                onChange={(event) =>
                  onPreferencesChange({
                    ...preferences,
                    quickAddDateBehavior: event.target.value as QuickAddDateBehavior,
                  })
                }
              >
                {quickAddDateOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </span>
          </label>
        </div>
      </div>

      {errorMessage ? (
        <p className="leftly-banner-danger" role="alert">
          {errorMessage}
        </p>
      ) : null}

      {statusMessage ? (
        <p className="leftly-banner-success" role="status">
          {statusMessage}
        </p>
      ) : null}
    </div>
  )
}
