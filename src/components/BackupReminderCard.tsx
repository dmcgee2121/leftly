// Gentle Overview card suggesting a backup file. Shown by shouldShowBackupReminder().

export function BackupReminderCard({
  lastBackupLabel,
  onSave,
  onLater,
}: {
  lastBackupLabel: string
  onSave: () => void
  onLater: () => void
}) {
  return (
    <section className="leftly-shell-soft grid gap-3 border-amber-400/20 bg-amber-400/5 p-4" aria-labelledby="backup-reminder-title">
      <div className="grid gap-1">
        <h2 id="backup-reminder-title" className="text-sm font-semibold text-white">
          Back up your budget
        </h2>
        <p className="text-sm leading-6 text-slate-300">
          {lastBackupLabel} A backup file lets you restore Leftly on a new phone or after reinstalling.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onSave} className="button-primary w-full sm:w-auto">
          Save backup
        </button>
        <button type="button" onClick={onLater} className="button-secondary w-full sm:w-auto">
          Later
        </button>
      </div>
    </section>
  )
}
