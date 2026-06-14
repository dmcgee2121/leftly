import { useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import type { BudgetCategory, BudgetPeriod, PayCadence, RecurringFrequency, RecurringItemTemplate } from '../types/budget'
import { buildRecurringPreview } from '../lib/recurring'

const buttonStyles = {
  primary:
    'inline-flex min-h-11 items-center justify-center rounded-xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-cyan-300 focus:outline-none focus:ring-4 focus:ring-cyan-400/20 active:translate-y-px',
  secondary:
    'inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3 text-sm font-semibold text-slate-100 shadow-sm transition hover:border-slate-700 hover:bg-slate-900 focus:outline-none focus:ring-4 focus:ring-cyan-400/10 active:translate-y-px',
}

const cadenceOptions: Array<{ value: PayCadence; label: string }> = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Biweekly' },
  { value: 'monthly', label: 'Monthly' },
]

const frequencyOptions: Array<{ value: RecurringFrequency; label: string }> = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Biweekly' },
  { value: 'every-pay-period', label: 'Every pay period' },
  { value: 'one-time', label: 'One-time' },
]

const categoryOptions: BudgetCategory[] = [
  'Housing',
  'Utilities',
  'Subscriptions',
  'Transportation',
  'Food',
  'Debt',
  'Insurance',
  'Personal',
  'Other / Misc',
]

type SetupStep = 1 | 2 | 3

type SetupDraft = {
  step: SetupStep
  cadence: PayCadence
  income: string
  startDate: string
  endDate: string
  addRecurringBill: boolean
  recurringName: string
  recurringAmount: string
  recurringCategory: BudgetCategory
  recurringFrequency: RecurringFrequency
  monthlyDueDay: string
  anchorDate: string
}

type SetupResult = {
  period: BudgetPeriod
  recurringTemplate?: RecurringItemTemplate
}

export function SetupFlowPanel({
  onClose,
  onFinish,
}: {
  onClose: () => void
  onFinish: (result: SetupResult) => void
}) {
  const [draft, setDraft] = useState<SetupDraft>(() => getInitialDraft())
  const [error, setError] = useState('')

  useEffect(() => {
    setDraft(getInitialDraft())
    setError('')
  }, [])

  const stepTitle = useMemo(() => {
    if (draft.step === 1) {
      return 'Step 1 of 3: Pay cadence'
    }
    if (draft.step === 2) {
      return 'Step 2 of 3: Pay period'
    }
    return 'Step 3 of 3: First recurring item'
  }, [draft.step])

  const canContinue =
    draft.step === 1 ? Boolean(draft.cadence) : draft.step === 2 ? isPayPeriodStepComplete(draft) : true

  const setupReview = useMemo(() => {
    const periodValidation = validatePayPeriodDraft(draft, false)
    if (!periodValidation.ok) {
      return null
    }

    if (!draft.addRecurringBill) {
      return {
        recurringItem: null as RecurringItemTemplate | null,
        willAddToPeriod: false,
        status: 'You can skip a regular bill for now and add one later from Bill Plan.',
      }
    }

    const recurringValidation = validateRecurringDraft(draft)
    if (!recurringValidation.ok) {
      return {
        recurringItem: null as RecurringItemTemplate | null,
        willAddToPeriod: false,
        status: 'Fill in the regular bill details to see whether it will be added to this pay period.',
      }
    }

    const preview = buildRecurringPreview({
      templates: [recurringValidation.template],
      period: periodValidation.period,
    })
    const willAddToPeriod = preview.bills.length > 0 || preview.setAsides.length > 0 || preview.plannedExpenses.length > 0

    return {
      recurringItem: recurringValidation.template,
      willAddToPeriod,
      status: willAddToPeriod
        ? 'This regular bill will be added to your active budget.'
        : 'This bill plan will be saved, but it is not due in this pay period yet.',
    }
  }, [draft])

  function goBack() {
    setError('')
    setDraft((current) => ({ ...current, step: Math.max(1, current.step - 1) as SetupStep }))
  }

  function goNext() {
    if (draft.step === 1) {
      setDraft((current) => ({ ...current, step: 2 }))
      return
    }

    if (draft.step === 2) {
      const validation = validatePayPeriodDraft(draft, true)
      if (!validation.ok) {
        setError(validation.error)
        return
      }

      setError('')
      setDraft((current) => ({ ...current, step: 3 }))
    }
  }

  function handleFinish(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault()

    const periodValidation = validatePayPeriodDraft(draft, true)
    if (!periodValidation.ok) {
      setError(periodValidation.error)
      setDraft((current) => ({ ...current, step: 2 }))
      return
    }

    if (!draft.addRecurringBill) {
      onFinish({
        period: periodValidation.period,
      })
      return
    }

    const recurringValidation = validateRecurringDraft(draft)
    if (!recurringValidation.ok) {
      setError(recurringValidation.error)
      return
    }

    onFinish({
      period: periodValidation.period,
      recurringTemplate: recurringValidation.template,
    })
  }

  if (draft.step === 1) {
    return renderPanel(
      'Welcome to Leftly',
      "Set up your first pay period to see what's left before you spend.",
      <>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Pay cadence">
            <select
              value={draft.cadence}
              onChange={(event) => setDraft((current) => ({ ...current, cadence: event.target.value as PayCadence }))}
            >
              {cadenceOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {error ? <ErrorBanner message={error} /> : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={onClose} className={buttonStyles.secondary}>
            Cancel
          </button>
          <button type="button" onClick={goNext} className={buttonStyles.primary}>
            Continue
          </button>
        </div>
      </>,
      stepTitle,
    )
  }

  if (draft.step === 2) {
    return renderPanel(
      'Set up your first pay period',
      'Add the income and date range for the pay period you want Leftly to track.',
      <>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Income amount">
            <input
              type="number"
              min="0"
              step="0.01"
              value={draft.income}
              onChange={(event) => setDraft((current) => ({ ...current, income: event.target.value }))}
              placeholder="3200"
            />
          </Field>
          <Field label="Start date">
            <input
              type="date"
              value={draft.startDate}
              onChange={(event) => setDraft((current) => ({ ...current, startDate: event.target.value }))}
            />
          </Field>
          <Field label="End date">
            <input
              type="date"
              value={draft.endDate}
              onChange={(event) => setDraft((current) => ({ ...current, endDate: event.target.value }))}
            />
          </Field>
        </div>

        {error ? <ErrorBanner message={error} /> : null}

        <div className="grid gap-3 sm:grid-cols-3">
          <button type="button" onClick={goBack} className={buttonStyles.secondary}>
            Back
          </button>
          <button type="button" onClick={onClose} className={buttonStyles.secondary}>
            Cancel
          </button>
          <button type="button" onClick={goNext} className={buttonStyles.primary} disabled={!canContinue}>
            Continue
          </button>
        </div>
      </>,
      stepTitle,
    )
  }

  return renderPanel(
    'Add your first regular bill',
    'Most bills repeat monthly or every pay period. Add one now, then Leftly can include it in your paycheck plan.',
    <form className="grid gap-4" onSubmit={handleFinish}>
      <div className="grid gap-3 rounded-2xl border border-slate-800/80 bg-slate-950/60 p-4">
        <p className="text-sm font-semibold text-white">Setup review</p>
        <div className="grid gap-2 text-sm leading-6 text-slate-300 sm:grid-cols-2">
          <p>
            <span className="text-slate-500">Pay period:</span> {draft.startDate || 'Select a start date'} to {draft.endDate || 'Select an end date'}
          </p>
          <p>
            <span className="text-slate-500">Income:</span> {draft.income ? formatCurrency(Number(draft.income)) : 'Add income'}
          </p>
          <p className="sm:col-span-2">
            <span className="text-slate-500">Regular bill:</span>{' '}
            {setupReview?.recurringItem
              ? `${setupReview.recurringItem.name} · ${formatCurrency(setupReview.recurringItem.amount)} · ${setupReview.recurringItem.frequency}`
              : draft.addRecurringBill
                ? 'Fill in the bill details below'
                : 'No regular bill selected'}
          </p>
          <p className="sm:col-span-2">
            <span className="text-slate-500">Included in this pay period:</span> {setupReview?.willAddToPeriod ? 'Yes' : 'No'}
          </p>
        </div>
        <p className="text-sm leading-6 text-slate-400">{setupReview?.status ?? 'Complete the steps below to see your setup review.'}</p>
      </div>

      <label className="flex items-start gap-3 rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-3 text-sm text-slate-200">
        <input
          type="checkbox"
          checked={draft.addRecurringBill}
          onChange={(event) => setDraft((current) => ({ ...current, addRecurringBill: event.target.checked }))}
          className="mt-1 h-4 w-4 rounded border-slate-700 text-cyan-400 focus:ring-cyan-400"
        />
        <span>
          <span className="block font-semibold">Save a regular bill now</span>
          <span className="mt-1 block text-sm leading-6 text-slate-400">
            Most bills repeat monthly or every pay period. Add one now, then Leftly can include it in your paycheck plan.
          </span>
        </span>
      </label>

      {draft.addRecurringBill ? (
        <div className="grid gap-3 rounded-2xl border border-slate-800/80 bg-slate-950/60 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name">
              <input
                value={draft.recurringName}
                onChange={(event) => setDraft((current) => ({ ...current, recurringName: event.target.value }))}
                placeholder="Rent"
              />
            </Field>
            <Field label="Amount">
              <input
                type="number"
                min="0"
                step="0.01"
                value={draft.recurringAmount}
                onChange={(event) => setDraft((current) => ({ ...current, recurringAmount: event.target.value }))}
                placeholder="1200"
              />
            </Field>
            <Field label="Category">
              <select
                value={draft.recurringCategory}
                onChange={(event) => setDraft((current) => ({ ...current, recurringCategory: event.target.value as BudgetCategory }))}
              >
                {categoryOptions.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Frequency">
              <select
                value={draft.recurringFrequency}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, recurringFrequency: event.target.value as RecurringFrequency }))
                }
              >
                {frequencyOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
            {draft.recurringFrequency === 'monthly' ? (
              <Field label="Monthly due day">
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={draft.monthlyDueDay}
                  onChange={(event) => setDraft((current) => ({ ...current, monthlyDueDay: event.target.value }))}
                  placeholder="1"
                />
              </Field>
            ) : null}
            {draft.recurringFrequency !== 'monthly' ? (
              <Field label="Anchor date">
                <input
                  type="date"
                  value={draft.anchorDate}
                  onChange={(event) => setDraft((current) => ({ ...current, anchorDate: event.target.value }))}
                />
              </Field>
            ) : null}
          </div>
        </div>
      ) : null}

      {error ? <ErrorBanner message={error} /> : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <button type="button" onClick={goBack} className={buttonStyles.secondary}>
          Back
        </button>
        <button
          type="button"
          onClick={() => {
            const validation = validatePayPeriodDraft(draft, true)
            if (!validation.ok) {
              setError(validation.error)
              setDraft((current) => ({ ...current, step: 2 }))
              return
            }

            onFinish({ period: validation.period })
          }}
          className={buttonStyles.secondary}
        >
          Skip
        </button>
        <button type="submit" className={buttonStyles.primary}>
          Finish setup
        </button>
      </div>
    </form>,
    stepTitle,
  )
}

function renderPanel(title: string, description: string, content: ReactNode, stepTitle: string) {
  return (
    <section className="rounded-[1.5rem] border border-cyan-400/20 bg-[linear-gradient(180deg,rgba(7,19,14,0.96),rgba(6,11,18,0.92))] p-4 shadow-2xl shadow-slate-950/30 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-cyan-200/70">{stepTitle}</p>
          <h3 className="mt-1 text-lg font-semibold text-white">{title}</h3>
          <p className="mt-1 text-sm leading-6 text-slate-400">{description}</p>
        </div>
      </div>
      <div className="mt-4">{content}</div>
    </section>
  )
}

function validatePayPeriodDraft(draft: SetupDraft, strict: boolean): { ok: true; period: BudgetPeriod } | { ok: false; error: string } {
  const income = Number(draft.income)
  if (strict && (!Number.isFinite(income) || income <= 0)) {
    return { ok: false, error: 'Income amount must be greater than 0.' }
  }

  if (strict && !draft.startDate) {
    return { ok: false, error: 'Start date is required.' }
  }

  if (strict && !draft.endDate) {
    return { ok: false, error: 'End date is required.' }
  }

  if (strict && draft.endDate < draft.startDate) {
    return { ok: false, error: 'End date must be after the start date.' }
  }

  return {
    ok: true,
    period: {
      cadence: draft.cadence,
      income: Number.isFinite(income) ? income : 0,
      startDate: draft.startDate,
      endDate: draft.endDate,
    },
  }
}

function validateRecurringDraft(
  draft: SetupDraft,
): { ok: true; template: RecurringItemTemplate } | { ok: false; error: string } {
  const amount = Number(draft.recurringAmount)
  if (!draft.recurringName.trim()) {
    return { ok: false, error: 'Recurring bill name is required.' }
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: 'Recurring bill amount must be greater than 0.' }
  }
  if (!draft.recurringCategory) {
    return { ok: false, error: 'Recurring bill category is required.' }
  }
  if (draft.recurringFrequency === 'monthly') {
    const dueDay = Number(draft.monthlyDueDay)
    if (!Number.isFinite(dueDay) || dueDay < 1 || dueDay > 31) {
      return { ok: false, error: 'Monthly due day must be between 1 and 31.' }
    }
  } else if (!draft.anchorDate) {
    return { ok: false, error: 'Anchor date is required.' }
  }

  return {
    ok: true,
    template: {
      id: crypto.randomUUID(),
      name: draft.recurringName.trim(),
      amount,
      category: draft.recurringCategory,
      kind: 'bill',
      frequency: draft.recurringFrequency,
      dueDay: draft.recurringFrequency === 'monthly' ? Number(draft.monthlyDueDay) : undefined,
      anchorDate: draft.recurringFrequency === 'monthly' ? undefined : draft.anchorDate,
      isActive: true,
      createdAt: new Date().toISOString(),
    },
  }
}

function isPayPeriodStepComplete(draft: SetupDraft) {
  const income = Number(draft.income)
  return Boolean(draft.startDate && draft.endDate && Number.isFinite(income) && income > 0 && draft.endDate >= draft.startDate)
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

function getInitialDraft(): SetupDraft {
  const today = new Date()
  const end = new Date(today)
  end.setDate(end.getDate() + 13)

  return {
    step: 1,
    cadence: 'biweekly',
    income: '',
    startDate: today.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
    addRecurringBill: false,
    recurringName: '',
    recurringAmount: '',
    recurringCategory: 'Housing',
    recurringFrequency: 'monthly',
    monthlyDueDay: '1',
    anchorDate: today.toISOString().slice(0, 10),
  }
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <p className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-3 py-3 text-sm font-medium text-rose-200" role="alert">
      {message}
    </p>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-2 text-sm font-medium text-slate-300">
      <span>{label}</span>
      <span className="[&_input]:min-h-11 [&_input]:w-full [&_input]:rounded-xl [&_input]:border [&_input]:border-slate-800 [&_input]:bg-slate-950 [&_input]:px-3 [&_input]:text-sm [&_input]:text-white [&_input]:outline-none [&_input]:transition [&_input]:placeholder:text-slate-500 [&_input]:focus:border-cyan-400/50 [&_input]:focus:ring-4 [&_input]:focus:ring-cyan-400/10 [&_select]:min-h-11 [&_select]:w-full [&_select]:rounded-xl [&_select]:border [&_select]:border-slate-800 [&_select]:bg-slate-950 [&_select]:px-3 [&_select]:text-sm [&_select]:text-white [&_select]:outline-none [&_select]:transition [&_select]:focus:border-cyan-400/50 [&_select]:focus:ring-4 [&_select]:focus:ring-cyan-400/10">
        {children}
      </span>
    </label>
  )
}
