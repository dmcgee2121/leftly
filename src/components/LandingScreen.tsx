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
          <div className="grid gap-2">
            <p className="text-[0.75rem] font-semibold uppercase tracking-[0.22em] text-cyan-100/70">Welcome to Leftly</p>
            <h1 className="max-w-xl text-[2rem] font-semibold tracking-[-0.05em] text-white sm:text-[3rem]">
              Know what&apos;s left before you spend.
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-slate-300 sm:text-[1rem] sm:leading-7">
              Plan one paycheck at a time and track your bills and spending by hand.
            </p>
          </div>
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
          <p className="text-sm leading-6 text-slate-400">
            Takes about a minute. No account and no bank connection. Your budget stays {isNative ? 'in this app' : 'in this browser'} on this device.
          </p>

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
