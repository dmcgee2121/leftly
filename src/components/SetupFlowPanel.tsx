import { useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { FALLBACK_CATEGORY, normalizeCategoryName } from '../lib/categories'
import type { BudgetCategory, BudgetPeriod, PayCadence, RecurringFrequency, RecurringItemTemplate } from '../types/budget'
import { MAIN_BILL_PLAN, buildRecurringPreview } from '../lib/recurring'
import { clearSetupDraft, loadSetupDraft, saveSetupDraft } from '../lib/storage'

const buttonStyles = {
  primary: 'button-primary',
  secondary: 'button-secondary',
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

type SetupStep = 1 | 2 | 3

type SetupRecurringDraft = {
  id: string
  name: string
  amount: string
  category: BudgetCategory
  frequency: RecurringFrequency
  monthlyDueDay: string
  anchorDate: string
}

type SetupDraft = {
  step: SetupStep
  cadence: PayCadence
  income: string
  startDate: string
  endDate: string
  addRecurringBill: boolean
  recurringItems: SetupRecurringDraft[]
}

type SetupResult = {
  period: BudgetPeriod
  recurringTemplates?: RecurringItemTemplate[]
}

type SetupReview = {
  templates: RecurringItemTemplate[]
  templatesReady: number
  skippedBlankRows: number
  partialRows: number
  dueThisPeriodCount: number
  status: string
}

export function SetupFlowPanel({
  defaultPayCadence,
  categories,
  activeBudgetPeriod,
  onClose,
  onClearDraft,
  onFinish,
}: {
  defaultPayCadence: PayCadence
  categories: BudgetCategory[]
  activeBudgetPeriod: BudgetPeriod | null
  onClose: () => void
  onClearDraft: (clearDraft: () => void) => void
  onFinish: (result: SetupResult) => void
}) {
  const [draft, setDraft] = useState<SetupDraft>(() => loadOrCreateDraft(activeBudgetPeriod, defaultPayCadence, categories))
  const [error, setError] = useState('')
  const [clearedDraftMarker, setClearedDraftMarker] = useState<string | null>(null)

  useEffect(() => {
    if (activeBudgetPeriod) {
      clearSetupDraft()
      return
    }

    if (clearedDraftMarker && clearedDraftMarker === getSetupDraftMarker(draft)) {
      clearSetupDraft()
      return
    }

    saveSetupDraft(draft)
  }, [activeBudgetPeriod, clearedDraftMarker, draft])

  const stepTitle = useMemo(() => {
    if (draft.step === 1) {
      return 'Step 1 of 3: Income and cadence'
    }
    if (draft.step === 2) {
      return 'Step 2 of 3: Pay period'
    }
    return 'Step 3 of 3: Bill Plan items'
  }, [draft.step])

  const canContinue =
    draft.step === 1 ? Boolean(draft.cadence) : draft.step === 2 ? isPayPeriodStepComplete(draft) : true

  const setupReview = useMemo<SetupReview | null>(() => {
    const periodValidation = validatePayPeriodDraft(draft, false)
    if (!periodValidation.ok) {
      return null
    }

    if (!draft.addRecurringBill) {
      return {
        templates: [],
        templatesReady: 0,
        skippedBlankRows: 0,
        partialRows: 0,
        dueThisPeriodCount: 0,
        status: 'Skip this if you want to start with income only. You can add more later from Bill Plan.',
      }
    }

    const recurringCollection = collectRecurringTemplates(draft, false)
    if (!recurringCollection.ok) {
      return null
    }
    const dueThisPeriodTemplateIds = new Set<string>()

    if (recurringCollection.templates.length > 0) {
      const preview = buildRecurringPreview({
        templates: recurringCollection.templates,
        period: periodValidation.period,
      })

      for (const item of [...preview.bills, ...preview.setAsides, ...preview.plannedExpenses]) {
        dueThisPeriodTemplateIds.add(item.templateId)
      }
    }

    if (recurringCollection.partialRows > 0) {
      return {
        templates: recurringCollection.templates,
        templatesReady: recurringCollection.templates.length,
        skippedBlankRows: recurringCollection.blankRows,
        partialRows: recurringCollection.partialRows,
        dueThisPeriodCount: dueThisPeriodTemplateIds.size,
        status: 'Finish any bill card you started, or clear it before setup can save your Bill Plan items.',
      }
    }

    if (recurringCollection.templates.length === 0) {
      return {
        templates: [],
        templatesReady: 0,
        skippedBlankRows: recurringCollection.blankRows,
        partialRows: 0,
        dueThisPeriodCount: 0,
        status: 'Skip this if you want to start with income only. You can add more later from Bill Plan.',
      }
    }

    return {
      templates: recurringCollection.templates,
      templatesReady: recurringCollection.templates.length,
      skippedBlankRows: recurringCollection.blankRows,
      partialRows: 0,
      dueThisPeriodCount: dueThisPeriodTemplateIds.size,
      status:
        dueThisPeriodTemplateIds.size > 0
          ? `${dueThisPeriodTemplateIds.size} Bill Plan item${dueThisPeriodTemplateIds.size === 1 ? '' : 's'} will be added to your first pay period.`
          : 'Your Bill Plan items will be saved, even if none are due in this pay period yet.',
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

    const recurringCollection = collectRecurringTemplates(draft, true)
    if (!recurringCollection.ok) {
      setError(recurringCollection.error)
      return
    }

    onFinish({
      period: periodValidation.period,
      recurringTemplates: recurringCollection.templates,
    })
  }

  function updateRecurringItem(itemId: string, updates: Partial<SetupRecurringDraft>) {
    setDraft((current) => ({
      ...current,
      recurringItems: current.recurringItems.map((item) => (item.id === itemId ? { ...item, ...updates } : item)),
    }))
  }

  function addAnotherBill() {
    setDraft((current) => ({
      ...current,
      recurringItems: [...current.recurringItems, createEmptyRecurringDraft()],
    }))
  }

  function removeBill(itemId: string) {
    setDraft((current) => {
      const nextItems = current.recurringItems.filter((item) => item.id !== itemId)
      return {
        ...current,
        recurringItems: nextItems.length > 0 ? nextItems : [createEmptyRecurringDraft()],
      }
    })
  }

  function clearDraft() {
    clearSetupDraft()
    setError('')
    const nextDraft = getInitialDraft(defaultPayCadence)
    setClearedDraftMarker(getSetupDraftMarker(nextDraft))
    setDraft(nextDraft)
  }

  if (draft.step === 1) {
    return renderPanel(
      'Welcome to Leftly',
      "Set up the paycheck Leftly should track first. This stays short and gives you a working budget right away.",
      <>
        <div className="leftly-panel-section">
          <div className="grid gap-1">
            <p className="leftly-panel-label">Paycheck basics</p>
            <p className="leftly-panel-copy">Choose how often you get paid and the income amount for the paycheck you want to track first.</p>
          </div>

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
          </div>
        </div>

        <div className="leftly-shell-faint grid gap-2 p-3">
          <p className="text-sm font-medium text-white">Setup draft saved on this device.</p>
          <p className="text-sm leading-6 text-slate-400">
            Leftly saves your setup draft in this browser. No account or bank connection is needed. You can export a JSON backup later from Data.
          </p>
        </div>

        {error ? <ErrorBanner message={error} /> : null}

        <div className="leftly-sheet-footer leftly-sheet-footer-sticky">
          <div className="leftly-action-grid">
            <button type="button" onClick={goNext} className={`${buttonStyles.primary} w-full sm:w-auto`}>
              Continue
            </button>
          </div>
        </div>
      </>,
      stepTitle,
      onClose,
      () => onClearDraft(clearDraft),
    )
  }

  if (draft.step === 2) {
    return renderPanel(
      'Set up your first pay period',
      'Choose the start and end dates for the paycheck you want Leftly to track right now.',
      <>
        <div className="leftly-panel-section">
          <div className="grid gap-1">
            <p className="leftly-panel-label">Pay period details</p>
            <p className="leftly-panel-copy">This becomes your first active paycheck view, so keep it current and easy to recognize.</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
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
        </div>

        <div className="leftly-shell-faint grid gap-2 p-3">
          <p className="text-sm font-medium text-white">What this sets up</p>
          <p className="text-sm leading-6 text-slate-400">
            Leftly will use your cadence, income, and these dates to build your first pay period.
          </p>
        </div>

        {error ? <ErrorBanner message={error} /> : null}

        <div className="leftly-sheet-footer leftly-sheet-footer-sticky">
          <div className="leftly-action-grid">
            <button type="button" onClick={goBack} className={`${buttonStyles.secondary} w-full sm:w-auto`}>
              Back
            </button>
            <button type="button" onClick={goNext} className={`${buttonStyles.primary} w-full sm:w-auto`} disabled={!canContinue}>
              Continue
            </button>
          </div>
        </div>
      </>,
      stepTitle,
      onClose,
      () => onClearDraft(clearDraft),
    )
  }

  return renderPanel(
    'Add regular bills you already know about',
    'Optional: save one or more regular bills now. You can add more later from Bill Plan.',
    <form className="grid gap-4" onSubmit={handleFinish}>
      <div className="leftly-shell-faint flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-6 text-slate-400">Setup draft saved on this device.</p>
      </div>

      <div className="leftly-panel-section">
        <p className="text-sm font-semibold text-white">Setup review</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <SummaryCard label="Pay cadence" value={cadenceOptions.find((option) => option.value === draft.cadence)?.label ?? draft.cadence} />
          <SummaryCard label="Income" value={draft.income ? formatCurrency(Number(draft.income)) : 'Add income'} />
          <SummaryCard
            label="Pay period"
            value={draft.startDate && draft.endDate ? `${draft.startDate} to ${draft.endDate}` : 'Choose your dates'}
          />
          <SummaryCard
            label="Bill Plan items ready"
            value={
              draft.addRecurringBill
                ? setupReview?.templatesReady
                  ? `${setupReview.templatesReady} ready`
                  : 'None yet'
                : 'Skipping for now'
            }
            detail={
              draft.addRecurringBill
                ? setupReview?.skippedBlankRows
                  ? `${setupReview.skippedBlankRows} blank row${setupReview.skippedBlankRows === 1 ? '' : 's'} will be ignored.`
                  : 'Blank rows are ignored.'
                : 'You can add regular bills later from Bill Plan.'
            }
          />
          <SummaryCard
            label="Included this pay period"
            value={setupReview?.dueThisPeriodCount ? `${setupReview.dueThisPeriodCount} item${setupReview.dueThisPeriodCount === 1 ? '' : 's'}` : 'Not yet'}
            detail={draft.addRecurringBill ? 'Based on the schedule you choose below.' : 'Skip this if you want to start with income only.'}
          />
        </div>
        <p className="text-sm leading-6 text-slate-400">{setupReview?.status ?? 'Complete the steps below to see your setup review.'}</p>
      </div>

      <label className="leftly-selection-card">
        <input
          type="checkbox"
          checked={draft.addRecurringBill}
          onChange={(event) => setDraft((current) => ({ ...current, addRecurringBill: event.target.checked }))}
          className="mt-1 h-4 w-4 rounded border-slate-700 text-cyan-400 focus:ring-cyan-400"
        />
        <span>
          <span className="block font-semibold">Save Bill Plan items now</span>
          <span className="mt-1 block text-sm leading-6 text-slate-400">
            Add regular bills you already know about. Skip this if you want to start with income only.
          </span>
        </span>
      </label>

      {draft.addRecurringBill ? (
        <div className="leftly-panel-section">
          <div className="grid gap-1">
            <p className="leftly-panel-label">Bill Plan items</p>
            <p className="leftly-panel-copy">You can add one or more regular bills here. You can add more later from Bill Plan.</p>
          </div>

          <div className="grid gap-3">
            {draft.recurringItems.map((item, index) => (
              <article key={item.id} className="leftly-setup-bill-card">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">Bill {index + 1}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-400">Name and amount are required if you want to save this bill.</p>
                  </div>
                  {draft.recurringItems.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => removeBill(item.id)}
                      className="button-secondary w-full sm:w-auto"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Name">
                    <input
                      value={item.name}
                      onChange={(event) => updateRecurringItem(item.id, { name: event.target.value })}
                      placeholder="Rent"
                    />
                  </Field>
                  <Field label="Amount">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.amount}
                      onChange={(event) => updateRecurringItem(item.id, { amount: event.target.value })}
                      placeholder="1200"
                    />
                  </Field>
                  <Field label="Category">
                    <select
                      value={item.category}
                      onChange={(event) => updateRecurringItem(item.id, { category: event.target.value as BudgetCategory })}
                    >
                      {categories.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Frequency">
                    <select
                      value={item.frequency}
                      onChange={(event) => updateRecurringItem(item.id, { frequency: event.target.value as RecurringFrequency })}
                    >
                      {frequencyOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  {item.frequency === 'monthly' ? (
                    <Field label="Monthly due day">
                      <input
                        type="number"
                        min="1"
                        max="31"
                        value={item.monthlyDueDay}
                        onChange={(event) => updateRecurringItem(item.id, { monthlyDueDay: event.target.value })}
                        placeholder="1"
                      />
                    </Field>
                  ) : null}
                  {item.frequency !== 'monthly' ? (
                    <Field label="Anchor date">
                      <input
                        type="date"
                        value={item.anchorDate}
                        onChange={(event) => updateRecurringItem(item.id, { anchorDate: event.target.value })}
                      />
                    </Field>
                  ) : null}
                </div>
              </article>
            ))}
          </div>

          <div className="leftly-action-grid">
            <button type="button" onClick={addAnotherBill} className={`${buttonStyles.secondary} w-full sm:w-auto`}>
              Add another bill
            </button>
          </div>

          <p className="text-sm leading-6 text-slate-400">
            Use the bill&apos;s usual due day for monthly items, or the most recent matching date for weekly, biweekly, and every-pay-period items.
          </p>
        </div>
      ) : null}

      {error ? <ErrorBanner message={error} /> : null}

      <div className="leftly-sheet-footer leftly-sheet-footer-sticky">
        <div className="leftly-action-grid">
          <button type="button" onClick={goBack} className={`${buttonStyles.secondary} w-full sm:w-auto`}>
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
            className={`${buttonStyles.secondary} w-full sm:w-auto`}
          >
            Skip for now
          </button>
          <button type="submit" className={`${buttonStyles.primary} w-full sm:w-auto`}>
            Finish setup
          </button>
        </div>
      </div>
    </form>,
    stepTitle,
    onClose,
    () => onClearDraft(clearDraft),
  )
}

function renderPanel(
  title: string,
  description: string,
  content: ReactNode,
  stepTitle: string,
  onClose: () => void,
  onClearDraft: () => void,
) {
  return (
    <section className="leftly-shell leftly-shell-accent overflow-hidden p-4 sm:p-5">
      <div className="flex flex-col gap-3 border-b border-slate-800/70 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-cyan-200/70">{stepTitle}</p>
          <h3 className="mt-1 text-lg font-semibold text-white">{title}</h3>
          <p className="mt-1 text-sm leading-6 text-slate-400">{description}</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto">
          <button type="button" onClick={onClose} className={`${buttonStyles.secondary} w-full sm:w-auto`}>
            Close
          </button>
          <button type="button" onClick={onClearDraft} className={`${buttonStyles.secondary} w-full sm:w-auto`}>
            Restart setup draft
          </button>
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

function collectRecurringTemplates(
  draft: SetupDraft,
  strict: boolean,
): { ok: true; templates: RecurringItemTemplate[]; blankRows: number; partialRows: number } | { ok: false; error: string } {
  const templates: RecurringItemTemplate[] = []
  let blankRows = 0
  let partialRows = 0

  for (let index = 0; index < draft.recurringItems.length; index += 1) {
    const item = draft.recurringItems[index]
    const validation = validateRecurringDraft(item)

    if (validation.kind === 'blank') {
      blankRows += 1
      continue
    }

    if (validation.kind === 'partial') {
      partialRows += 1
      if (strict) {
        return { ok: false, error: `Bill ${index + 1}: ${validation.error}` }
      }
      continue
    }

    templates.push(validation.template)
  }

  return { ok: true, templates, blankRows, partialRows }
}

function validateRecurringDraft(
  draft: SetupRecurringDraft,
):
  | { kind: 'blank' }
  | { kind: 'partial'; error: string }
  | { kind: 'complete'; template: RecurringItemTemplate } {
  const hasName = draft.name.trim().length > 0
  const hasAmount = draft.amount.trim().length > 0
  const hasContent = hasName || hasAmount

  if (!hasContent) {
    return { kind: 'blank' }
  }

  if (!hasName) {
    return { kind: 'partial', error: 'Bill Plan item name is required.' }
  }
  if (!hasAmount) {
    return { kind: 'partial', error: 'Bill Plan item amount is required.' }
  }

  const amount = Number(draft.amount)
  if (!Number.isFinite(amount) || amount <= 0) {
    return { kind: 'partial', error: 'Bill Plan item amount must be greater than 0.' }
  }
  if (!draft.category) {
    return { kind: 'partial', error: 'Bill Plan item category is required.' }
  }
  if (draft.frequency === 'monthly') {
    const dueDay = Number(draft.monthlyDueDay)
    if (!Number.isFinite(dueDay) || dueDay < 1 || dueDay > 31) {
      return { kind: 'partial', error: 'Monthly due day must be between 1 and 31.' }
    }
  } else if (!draft.anchorDate) {
    return { kind: 'partial', error: 'Anchor date is required.' }
  }

  return {
    kind: 'complete',
    template: {
      id: crypto.randomUUID(),
      name: draft.name.trim(),
      amount,
      category: draft.category,
      kind: 'bill',
      planName: MAIN_BILL_PLAN,
      frequency: draft.frequency,
      dueDay: draft.frequency === 'monthly' ? Number(draft.monthlyDueDay) : undefined,
      anchorDate: draft.frequency === 'monthly' ? undefined : draft.anchorDate,
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

function getInitialDraft(defaultPayCadence: PayCadence): SetupDraft {
  const today = new Date()
  const end = new Date(today)
  end.setDate(end.getDate() + 13)

  return {
    step: 1,
    cadence: defaultPayCadence,
    income: '',
    startDate: today.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
    addRecurringBill: false,
    recurringItems: [createEmptyRecurringDraft()],
  }
}

function loadOrCreateDraft(activeBudgetPeriod: BudgetPeriod | null, defaultPayCadence: PayCadence, categories: BudgetCategory[]): SetupDraft {
  const storedDraft = loadSetupDraft(activeBudgetPeriod)
  if (storedDraft) {
    return normalizeSetupDraft(storedDraft, defaultPayCadence, categories)
  }

  return getInitialDraft(defaultPayCadence)
}

function normalizeSetupDraft(value: unknown, defaultPayCadence: PayCadence, categories: BudgetCategory[]): SetupDraft {
  const draft = value as Partial<SetupDraft> | null
  const recurringItems = Array.isArray(draft?.recurringItems)
    ? draft.recurringItems.map((item) => normalizeSetupRecurringDraft(item, categories))
    : [createEmptyRecurringDraft()]

  return {
    step: draft?.step === 2 || draft?.step === 3 ? draft.step : 1,
    cadence:
      draft?.cadence === 'weekly' || draft?.cadence === 'biweekly' || draft?.cadence === 'monthly'
        ? draft.cadence
        : defaultPayCadence,
    income: typeof draft?.income === 'string' ? draft.income : '',
    startDate: typeof draft?.startDate === 'string' ? draft.startDate : '',
    endDate: typeof draft?.endDate === 'string' ? draft.endDate : '',
    addRecurringBill: typeof draft?.addRecurringBill === 'boolean' ? draft.addRecurringBill : false,
    recurringItems: recurringItems.length > 0 ? recurringItems : [createEmptyRecurringDraft()],
  }
}

function getSetupDraftMarker(draft: SetupDraft) {
  return JSON.stringify({
    step: draft.step,
    cadence: draft.cadence,
    income: draft.income,
    startDate: draft.startDate,
    endDate: draft.endDate,
    addRecurringBill: draft.addRecurringBill,
    recurringItems: draft.recurringItems,
  })
}

function normalizeSetupRecurringDraft(value: unknown, categories: BudgetCategory[]): SetupRecurringDraft {
  const item = value as Partial<SetupRecurringDraft> | null
  const normalizedCategory = normalizeCategoryName(item?.category)
  return {
    id: typeof item?.id === 'string' ? item.id : crypto.randomUUID(),
    name: typeof item?.name === 'string' ? item.name : '',
    amount: typeof item?.amount === 'string' ? item.amount : '',
    category: normalizedCategory && categories.includes(normalizedCategory) ? normalizedCategory : categories[0] ?? FALLBACK_CATEGORY,
    frequency:
      item?.frequency === 'monthly' ||
      item?.frequency === 'weekly' ||
      item?.frequency === 'biweekly' ||
      item?.frequency === 'every-pay-period' ||
      item?.frequency === 'one-time'
        ? item.frequency
        : 'monthly',
    monthlyDueDay: typeof item?.monthlyDueDay === 'string' ? item.monthlyDueDay : '1',
    anchorDate: typeof item?.anchorDate === 'string' ? item.anchorDate : '',
  }
}

function createEmptyRecurringDraft(): SetupRecurringDraft {
  const today = new Date().toISOString().slice(0, 10)
  return {
    id: crypto.randomUUID(),
    name: '',
    amount: '',
    category: 'Housing',
    frequency: 'monthly',
    monthlyDueDay: '1',
    anchorDate: today,
  }
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <p className="leftly-banner-danger" role="alert">
      {message}
    </p>
  )
}

function SummaryCard({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="leftly-shell-faint grid gap-1 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="text-sm font-semibold text-white break-words">{value}</p>
      {detail ? <p className="text-xs leading-5 text-slate-400">{detail}</p> : null}
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="leftly-field">
      <span>{label}</span>
      <span className="leftly-input-shell">
        {children}
      </span>
    </label>
  )
}
