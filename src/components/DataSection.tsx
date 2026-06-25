import { useRef } from 'react'
import { DEFAULT_CATEGORIES } from '../types/budget'
import type { BudgetCategory, LeftlyPreferences, PayCadence, QuickAddDateBehavior } from '../types/budget'

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
  preferences,
  onPreferencesChange,
  onExport,
  onImportFile,
  onExportCurrentPeriodCsv,
  onExportAllHistoryCsv,
  onLoadDemoData,
  statusMessage,
  errorMessage,
  isImporting,
}: {
  preferences: LeftlyPreferences
  onPreferencesChange: (preferences: LeftlyPreferences) => void
  onExport: () => void
  onImportFile: (file: File | null) => void
  onExportCurrentPeriodCsv: () => void
  onExportAllHistoryCsv: () => void
  onLoadDemoData: () => void
  statusMessage: string
  errorMessage: string
  isImporting: boolean
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  return (
    <div className="grid gap-4">
      <div className="leftly-shell-soft grid gap-3 border-cyan-400/15 bg-cyan-400/5 p-4">
        <p className="text-sm font-semibold text-white">Stored on this device</p>
        <p className="text-sm leading-6 text-slate-300">
          Leftly saves your budget in this browser on this device. If you clear browser data, switch devices, or reset
          Leftly, that data will not follow you unless you export a backup first.
        </p>
        <p className="text-sm leading-6 text-slate-300">
          Export a JSON backup before a reset or major change. Importing a Leftly JSON backup restores the saved data
          from that file. CSV exports are spreadsheet copies only and cannot be imported back into Leftly.
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
                {DEFAULT_CATEGORIES.map((category) => (
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

      <div className="leftly-banner-warning">
        <p className="text-sm font-semibold text-amber-100">Backup first</p>
        <p className="mt-1 text-sm leading-6 text-amber-50/80">
          Before resetting data, loading demo data, or making major changes, export a backup so you can restore your
          budget later.
        </p>
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

      <div className="leftly-shell-soft grid gap-3 p-4">
        <p className="text-sm font-semibold text-white">CSV exports</p>
        <p className="text-sm leading-6 text-slate-400">
          These files open cleanly in Google Sheets, Excel, and Apple Numbers.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={onExportCurrentPeriodCsv} className={`${buttonStyles.secondary} w-full`}>
            Export current period CSV
          </button>
          <button type="button" onClick={onExportAllHistoryCsv} className={`${buttonStyles.secondary} w-full`}>
            Export all history CSV
          </button>
        </div>
      </div>

      <div className="leftly-shell-soft grid gap-3 p-4">
        <p className="text-sm font-semibold text-white">Demo data</p>
        <p className="text-sm leading-6 text-slate-400">
          Demo data is only for testing. It replaces the current local data on this device.
        </p>
        <button type="button" onClick={onLoadDemoData} className={`${buttonStyles.primary} w-full`} disabled={isImporting}>
          Load demo data
        </button>
      </div>

      <div className="leftly-shell-soft grid gap-3 p-4">
        <p className="text-sm font-semibold text-white">Add Leftly to your phone</p>
        <p className="text-sm leading-6 text-slate-400">
          Open Leftly in your mobile browser, then use the browser menu to add it to your home screen or install it as an app.
        </p>
      </div>

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
          Importing this JSON backup will replace the current Leftly data on this device with the data saved in that
          file.
        </p>
        <p className="text-sm leading-6 text-slate-300">
          Export a fresh backup first if you might need what is currently saved here, and only import files that came
          from Leftly.
        </p>
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
