export function HelpAboutFeedbackSection() {
  return (
    <div className="grid gap-3">
      <div className="leftly-shell-soft grid gap-2 p-4">
        <p className="text-sm font-semibold text-white">What Leftly does</p>
        <p className="text-sm leading-6 text-slate-300">
          Leftly helps you see what is left from a paycheck after bills, set-asides, and spending. It focuses on one
          pay period—the dates covered by the paycheck you are planning—at a time.
        </p>
      </div>

      <div className="leftly-shell-soft grid gap-2 p-4">
        <p className="text-sm font-semibold text-white">Your data</p>
        <p className="text-sm leading-6 text-slate-300">
          No account or bank connection is required. Your budget is saved in this browser and stays on this device
          unless you export it or manually use optional cloud backup.
        </p>
      </div>

      <div className="leftly-shell-soft grid gap-2 p-4">
        <p className="text-sm font-semibold text-white">Backup and restore</p>
        <div className="grid gap-2 text-sm leading-6 text-slate-300">
          <p>
            JSON backup is the safest portable recovery file. It is the only backup format Leftly can import.
          </p>
          <p>
            CSV export is for spreadsheets only. It is useful for reviewing data, but it cannot be imported back into
            Leftly.
          </p>
        </div>
      </div>

      <div className="leftly-shell-soft grid gap-2 p-4">
        <p className="text-sm font-semibold text-white">Cloud backup</p>
        <div className="grid gap-2 text-sm leading-6 text-slate-300">
          <p>
            Optional cloud backup stores one latest backup for your account. It is not live sync.
          </p>
          <p>You choose when to upload or restore. Changes are not copied automatically between devices.</p>
          <p>Reset and demo data only affect the data saved on this device.</p>
          <p>They do not delete your cloud snapshot.</p>
        </div>
      </div>

      <div className="leftly-shell-soft grid gap-2 p-4">
        <p className="text-sm font-semibold text-white">Feedback</p>
        <p className="text-sm leading-6 text-slate-300">
          Send feedback to the person who shared Leftly with you.
        </p>
      </div>
    </div>
  )
}
