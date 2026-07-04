export function HelpAboutFeedbackSection() {
  return (
    <div className="grid gap-3">
      <div className="leftly-shell-soft grid gap-2 p-4">
        <p className="text-sm font-semibold text-white">What Leftly does</p>
        <p className="text-sm leading-6 text-slate-300">
          Leftly helps you plan what is left from a paycheck after bills, expenses, and set-asides. It keeps the
          focus on one pay period at a time.
        </p>
      </div>

      <div className="leftly-shell-soft grid gap-2 p-4">
        <p className="text-sm font-semibold text-white">Your data</p>
        <p className="text-sm leading-6 text-slate-300">
          Your budget stays in this browser or on this device unless you export a JSON backup or use optional cloud
          backup.
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
            Optional cloud backup stores one latest snapshot for your account. It is not live sync.
          </p>
          <p>Upload and restore are manual. Reset and demo only affect the data saved on this device.</p>
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
