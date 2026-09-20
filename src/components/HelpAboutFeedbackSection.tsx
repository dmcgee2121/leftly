import type { OfflineCapabilityStatus } from './usePwaLifecycle'

export function HelpAboutFeedbackSection({
  canInstall, hasInstallPrompt, isInstalled, onInstall, offlineCapabilityStatus,
  isRetryingOfflineSetup, onRetryOfflineSetup, isNative,
}: {
  canInstall: boolean
  hasInstallPrompt: boolean
  isInstalled: boolean
  onInstall: () => void
  offlineCapabilityStatus: OfflineCapabilityStatus
  isRetryingOfflineSetup: boolean
  onRetryOfflineSetup: () => void
  isNative: boolean
}) {
  return (
    <div className="grid gap-3">
      <div className="leftly-shell-soft grid gap-2 p-4">
        <p className="text-sm font-semibold text-white">Leftly</p>
        <p className="text-sm text-slate-300">Version {__LEFTLY_VERSION__}</p>
        <p className="text-sm leading-6 text-slate-400">Local-first paycheck budgeting</p>
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
          <a className="font-medium text-cyan-200 underline decoration-cyan-400/70 underline-offset-4 hover:text-cyan-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300" href="/privacy/">Privacy Policy</a>
          <a className="font-medium text-cyan-200 underline decoration-cyan-400/70 underline-offset-4 hover:text-cyan-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300" href="/support/">Support</a>
        </div>
      </div>

      <div className="leftly-shell-soft grid gap-3 p-4">
        <div className="grid gap-1">
          <p className="text-sm font-semibold text-white">Getting started</p>
          <p className="text-sm leading-6 text-slate-400">Leftly follows one paycheck at a time.</p>
        </div>
        <ol className="list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-300">
          <li>Set the paycheck amount and the dates it needs to cover.</li>
          <li>Add regular bills in Bill Plan, or add a one-time bill from Overview.</li>
          <li>Log spending with Add expense and watch Safe to Spend update.</li>
          <li>When the next paycheck arrives, use Next paycheck. Leftly saves the old one in History.</li>
        </ol>
      </div>

      <div className="leftly-shell-soft grid gap-2 p-4">
        <p className="text-sm font-semibold text-white">Your data</p>
        <p className="text-sm leading-6 text-slate-300">
          Leftly works without an account or bank connection. Your budget stays {isNative ? 'in this app' : 'in this browser'} on this device unless you export a backup or manually use optional cloud backup.
        </p>
      </div>

      {!isNative ? (
        <div className="leftly-shell-soft grid gap-3 p-4">
          <div className="grid gap-1">
            <p className="text-sm font-semibold text-white">Install and use offline</p>
            <p className="text-sm leading-6 text-slate-300">Install Leftly on supported devices to open it like an app.</p>
          </div>
          <div className="leftly-shell-faint grid gap-2 p-3" role="status" aria-live="polite">
            {offlineCapabilityStatus === 'preparing' ? <p className="text-sm leading-6 text-slate-300">Preparing Leftly for offline use. Keep this page open and connected.</p>
              : offlineCapabilityStatus === 'ready' ? <p className="text-sm leading-6 text-emerald-200">Offline access is ready on this device.</p>
              : offlineCapabilityStatus === 'error' ? <><p className="text-sm leading-6 text-rose-200">Leftly could not finish offline setup. Stay connected and retry.</p><button type="button" onClick={onRetryOfflineSetup} disabled={isRetryingOfflineSetup} className="button-secondary w-full sm:w-fit">{isRetryingOfflineSetup ? 'Retrying offline setup...' : 'Retry offline setup'}</button></>
              : <p className="text-sm leading-6 text-slate-400">This browser does not support Leftly&apos;s offline app features.</p>}
          </div>
          {isInstalled ? <p className="text-sm leading-6 text-emerald-200" role="status">Leftly is running in installed app mode.</p>
            : canInstall ? <button type="button" onClick={onInstall} className="button-primary w-full sm:w-auto">Install Leftly</button>
            : hasInstallPrompt && offlineCapabilityStatus === 'preparing' ? <p className="text-sm leading-6 text-slate-400">Install will be available after offline setup finishes.</p>
            : <p className="text-sm leading-6 text-slate-400">Use your browser menu and choose Add to Home screen or Install app when available.</p>}
        </div>
      ) : (
        <div className="leftly-shell-soft grid gap-2 p-4">
          <p className="text-sm font-semibold text-white">Offline use</p>
          <p className="text-sm leading-6 text-slate-300">The Android app keeps your budget on this device and works without a connection.</p>
        </div>
      )}

      <div className="leftly-shell-soft grid gap-2 p-4">
        <p className="text-sm font-semibold text-white">Backup and restore</p>
        <p className="text-sm leading-6 text-slate-300">Use a JSON backup to restore Leftly later. CSV files are spreadsheet copies and cannot be restored.</p>
      </div>

      <div className="leftly-shell-soft grid gap-2 p-4">
        <p className="text-sm font-semibold text-white">Cloud backup</p>
        <p className="text-sm leading-6 text-slate-300">Optional cloud backup stores one snapshot when you choose. It is manual backup, not live sync.</p>
      </div>
    </div>
  )
}
