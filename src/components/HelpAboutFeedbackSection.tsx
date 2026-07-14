import { useState } from 'react'

const checklistItems = [
  'Start a new paycheck setup.',
  'Enter the paycheck amount and dates.',
  'Add 2-3 bills.',
  'Leave setup and come back to confirm the setup draft stays saved.',
  'Complete setup.',
  'Add a manual expense.',
  'Add a one-time bill.',
  'Check Bill Plan.',
  'Check History.',
  'Export a JSON backup.',
  'Export CSV if you want spreadsheet records.',
  'Try browser install or add to home screen if your browser supports it.',
] as const

const feedbackTemplate = `Leftly beta feedback

Device or phone type:
Browser used:
What I was trying to do:
What worked well:
What felt confusing:
Whether anything failed:
Whether anything felt risky:
Would I actually use Leftly for a real paycheck?
One thing I would change:
`

export function HelpAboutFeedbackSection() {
  const [copyMessage, setCopyMessage] = useState('')

  async function handleCopyTemplate() {
    if (!navigator.clipboard?.writeText) {
      setCopyMessage('Copy is not available here. You can still select the template below.')
      return
    }

    try {
      await navigator.clipboard.writeText(feedbackTemplate)
      setCopyMessage('Feedback template copied.')
    } catch {
      setCopyMessage('Copy did not work here. You can still select the template below.')
    }
  }

  return (
    <div className="grid gap-3">
      <div className="leftly-shell-soft grid gap-2 p-4">
        <p className="text-sm font-semibold text-white">How to test Leftly</p>
        <p className="text-sm leading-6 text-slate-300">
          Try a simple paycheck flow from start to finish. Sample or fake numbers are fine if you do not want to use
          real numbers yet.
        </p>
      </div>

      <div className="leftly-shell-soft grid gap-3 p-4">
        <div className="grid gap-1">
          <p className="text-sm font-semibold text-white">Basic test checklist</p>
          <p className="text-sm leading-6 text-slate-400">
            You do not need to test everything perfectly. A quick real-world pass is enough.
          </p>
        </div>
        <div className="grid gap-2">
          {checklistItems.map((item, index) => (
            <div key={item} className="leftly-shell-faint flex items-start gap-3 p-3">
              <span className="leftly-chip leftly-chip-muted shrink-0 px-2.5 py-1 text-[9px] tracking-[0.12em]">
                {index + 1}
              </span>
              <p className="min-w-0 text-sm leading-6 text-slate-300">{item}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="leftly-shell-soft grid gap-3 p-4">
        <div className="grid gap-1">
          <p className="text-sm font-semibold text-white">Feedback template</p>
          <p className="text-sm leading-6 text-slate-400">
            Send feedback to the person who shared Leftly with you. Copy this template, then fill it in however you
            like.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
          <textarea
            readOnly
            value={feedbackTemplate}
            className="leftly-input-shell min-h-[16rem] resize-y whitespace-pre-wrap font-mono text-[13px] leading-6 text-slate-200"
            aria-label="Feedback template"
          />
          <button type="button" onClick={handleCopyTemplate} className="leftly-btn-secondary w-full sm:w-auto">
            Copy feedback template
          </button>
        </div>

        {copyMessage ? <p className="text-sm leading-6 text-cyan-200">{copyMessage}</p> : null}
      </div>

      <div className="leftly-shell-soft grid gap-2 p-4">
        <p className="text-sm font-semibold text-white">What not to worry about</p>
        <div className="grid gap-2 text-sm leading-6 text-slate-300">
          <p>Leftly does not connect to bank accounts.</p>
          <p>You do not need an account to use Leftly locally on this device.</p>
          <p>Browser install or add to home screen is optional if your browser offers it.</p>
        </div>
      </div>

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
          <p>JSON backup is the Leftly restore file. Save it when you want a portable copy you can bring back later.</p>
          <p>CSV export is for spreadsheet-style records. It is useful for review, but it does not restore data into Leftly.</p>
        </div>
      </div>

      <div className="leftly-shell-soft grid gap-2 p-4">
        <p className="text-sm font-semibold text-white">Cloud backup</p>
        <div className="grid gap-2 text-sm leading-6 text-slate-300">
          <p>Optional cloud backup stores one manual backup snapshot for the signed-in user. It is not live sync.</p>
          <p>You choose when to upload or restore. Changes are not copied automatically between devices.</p>
          <p>Reset and demo data only affect the data saved on this device.</p>
          <p>They do not delete your cloud snapshot.</p>
        </div>
      </div>
    </div>
  )
}
