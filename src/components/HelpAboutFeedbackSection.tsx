export function HelpAboutFeedbackSection() {
  return (
    <div className="grid gap-3">
      <div className="leftly-shell-soft grid gap-2 p-4">
        <p className="text-sm font-semibold text-white">What Leftly does</p>
        <p className="text-sm leading-6 text-slate-300">
          Leftly helps you see what is left from a paycheck after bills, set-asides, and spending. It focuses on one
          pay period - the dates covered by the paycheck you are planning - at a time.
        </p>
      </div>

      <div className="leftly-shell-soft grid gap-2 p-4">
        <p className="text-sm font-semibold text-white">Your data</p>
        <p className="text-sm leading-6 text-slate-300">
          Leftly works without an account and does not connect to bank accounts. Your budget stays on this device in
          this browser unless you export a backup or manually use optional cloud backup.
        </p>
      </div>

      <div className="leftly-shell-soft grid gap-2 p-4">
        <p className="text-sm font-semibold text-white">Backup and restore</p>
        <div className="grid gap-2 text-sm leading-6 text-slate-300">
          <p>
            JSON backup is the Leftly restore file. Save it when you want a portable copy you can bring back later.
          </p>
          <p>
            CSV export is for spreadsheet-style records. It is useful for review, but it does not restore data into
            Leftly.
          </p>
        </div>
      </div>

      <div className="leftly-shell-soft grid gap-2 p-4">
        <p className="text-sm font-semibold text-white">Cloud backup</p>
        <div className="grid gap-2 text-sm leading-6 text-slate-300">
          <p>
            Optional cloud backup stores one manual backup snapshot for the signed-in user. It is not live sync.
          </p>
          <p>You choose when to upload or restore. Changes are not copied automatically between devices.</p>
          <p>Reset and demo data only affect the data saved on this device.</p>
          <p>They do not delete your cloud snapshot.</p>
        </div>
      </div>

      <div className="leftly-shell-soft grid gap-2 p-4">
        <p className="text-sm font-semibold text-white">Beta testing</p>
        <div className="grid gap-2 text-sm leading-6 text-slate-300">
          <p>If you do not want to use real numbers yet, try sample numbers first.</p>
          <p>On supported browsers, you may be able to install Leftly from the browser menu. It is optional.</p>
        </div>
      </div>

      <div className="leftly-shell-soft grid gap-2 p-4">
        <p className="text-sm font-semibold text-white">Feedback</p>
        <div className="grid gap-2 text-sm leading-6 text-slate-300">
          <p>Send feedback to the person who shared Leftly with you.</p>
          <p>Include your phone or device, browser, what you were trying to do, what felt confusing, and whether anything failed or felt risky.</p>
        </div>
      </div>
    </div>
  )
}
