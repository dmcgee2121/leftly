type LandingScreenProps = {
  onStartBudgetingLocally: () => void
  onRestoreFromBackup: () => void
  onOpenCloudBackup?: () => void
  showCloudBackupAction: boolean
  isNative: boolean
}

const buttonStyles = {
  primary: 'button-primary',
  secondary: 'button-secondary',
}

export function LandingScreen({
  onStartBudgetingLocally,
  onRestoreFromBackup,
  onOpenCloudBackup,
  showCloudBackupAction,
  isNative,
}: LandingScreenProps) {
  return (
    <div className="leftly-shell leftly-shell-accent overflow-hidden bg-[linear-gradient(180deg,rgba(6,12,24,0.98),rgba(4,8,18,0.94))] p-4 sm:p-5">
      <div className="grid gap-5">
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="leftly-chip leftly-chip-default">Local first</span>
            <span className="leftly-chip leftly-chip-muted">No bank connection</span>
          </div>

          <div className="grid gap-2">
            <p className="text-[0.75rem] font-semibold uppercase tracking-[0.22em] text-cyan-100/70">Welcome to Leftly</p>
            <h1 className="max-w-xl text-[2rem] font-semibold tracking-[-0.05em] text-white sm:text-[3rem]">
              Know what&apos;s left before you spend.
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-slate-300 sm:text-[1rem] sm:leading-7">
              Plan one paycheck at a time, track bills and expenses, and keep control without connecting your bank.
            </p>
          </div>
        </div>

        <div className="leftly-shell-faint grid gap-2 p-4">
          <p className="text-sm font-semibold text-white">Start in about a minute</p>
          <p className="text-sm leading-6 text-slate-400">
            Add your paycheck amount and dates. Your budget is saved on this device, with no account required.
          </p>
        </div>

        <div className="grid gap-3">
          <button type="button" onClick={onStartBudgetingLocally} className={`${buttonStyles.primary} w-full`}>
            Set up my first paycheck
          </button>
          <button type="button" onClick={onRestoreFromBackup} className={`${buttonStyles.secondary} w-full`}>
            Restore a backup
          </button>
        </div>

        <div className="grid gap-3 rounded-[1.25rem] border border-slate-800/70 bg-slate-950/40 p-4">
          <div className="grid gap-1">
            <p className="text-sm font-semibold text-white">Private by design</p>
            <p className="text-sm leading-6 text-slate-400">
              Leftly does not connect to a bank. Your data stays {isNative ? 'in this app' : 'in this browser'} on this device unless you export or back it up.
            </p>
          </div>

          {showCloudBackupAction && onOpenCloudBackup ? (
            <div className="grid gap-3 border-t border-slate-800/70 pt-3">
              <p className="text-sm leading-6 text-slate-300">
                Sign-in is optional and only used for manual cloud backup and restore. It is not live sync.
              </p>
              <button type="button" onClick={onOpenCloudBackup} className={`${buttonStyles.secondary} w-full sm:w-fit`}>
                Sign in for cloud backup
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
