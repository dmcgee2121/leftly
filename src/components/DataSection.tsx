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
    <div className="grid gap-4 rounded-[1.5rem] border border-slate-800/80 bg-slate-950/70 p-4 sm:p-5">
      <div className="grid gap-3 rounded-2xl border border-cyan-400/15 bg-cyan-400/5 p-4">
        <p className="text-sm font-semibold text-white">Privacy note</p>
        <p className="text-sm leading-6 text-slate-300">
          Leftly stores your data on this device. Export a backup if you want to save or move your data.
        </p>
        <p className="text-sm leading-6 text-slate-300">
          JSON backups restore your Leftly data. CSV exports are for viewing your budget in a spreadsheet.
        </p>
      </div>

      <div className="grid gap-3 rounded-2xl border border-slate-800/70 bg-slate-950/55 p-4">
        <div className="grid gap-1">
          <p className="text-sm font-semibold text-white">Preferences</p>
          <p className="text-sm leading-6 text-slate-400">These defaults only affect new entries on this device.</p>
        </div>

        <div className="grid gap-3">
          <label className="grid gap-2 text-sm font-medium text-slate-300">
            <span>Default pay cadence</span>
            <select
              value={preferences.defaultPayCadence}
              className="min-h-11 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 text-sm text-white outline-none transition focus:border-cyan-400/50 focus:ring-4 focus:ring-cyan-400/10"
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
          </label>

          <label className="grid gap-2 text-sm font-medium text-slate-300">
            <span>Default category</span>
            <select
              value={preferences.defaultCategory}
              className="min-h-11 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 text-sm text-white outline-none transition focus:border-cyan-400/50 focus:ring-4 focus:ring-cyan-400/10"
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
          </label>

          <label className="grid gap-2 text-sm font-medium text-slate-300">
            <span>Quick Add date</span>
            <select
              value={preferences.quickAddDateBehavior}
              className="min-h-11 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 text-sm text-white outline-none transition focus:border-cyan-400/50 focus:ring-4 focus:ring-cyan-400/10"
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
          </label>
        </div>
      </div>

      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/8 px-4 py-3">
        <p className="text-sm font-semibold text-amber-100">Backup first</p>
        <p className="mt-1 text-sm leading-6 text-amber-50/80">
          Before resetting data or making major changes, export a backup so you can restore your budget later.
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

      <div className="grid gap-3 rounded-2xl border border-slate-800/70 bg-slate-950/55 p-4">
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

      <div className="grid gap-3 rounded-2xl border border-slate-800/70 bg-slate-950/55 p-4">
        <p className="text-sm font-semibold text-white">Demo data</p>
        <p className="text-sm leading-6 text-slate-400">
          Demo data is only for testing. It replaces the current local data on this device.
        </p>
        <button type="button" onClick={onLoadDemoData} className={`${buttonStyles.primary} w-full`} disabled={isImporting}>
          Load demo data
        </button>
      </div>

      <div className="grid gap-3 rounded-2xl border border-slate-800/70 bg-slate-950/55 p-4">
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

      <div className="grid gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/8 p-4">
        <p className="text-sm font-semibold text-amber-100">Import warning</p>
        <p className="text-sm leading-6 text-amber-50/80">
          Importing this JSON backup will replace the current Leftly data on this device.
        </p>
        <p className="text-sm leading-6 text-slate-300">
          Make sure the file came from Leftly before importing it.
        </p>
      </div>

      {errorMessage ? (
        <p className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-3 py-3 text-sm font-medium text-rose-200" role="alert">
          {errorMessage}
        </p>
      ) : null}

      {statusMessage ? (
        <p className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-3 text-sm font-medium text-emerald-100" role="status">
          {statusMessage}
        </p>
      ) : null}
    </div>
  )
}
