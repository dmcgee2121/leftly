import { useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import type { Bill, BudgetPeriod, PayCadence, RecurringItemTemplate } from '../types/budget'
import { buildRecurringPreview } from '../lib/recurring'

const buttonStyles = {
  primary: 'button-primary',
  secondary: 'button-secondary',
}

const cadenceOptions: Array<{ value: PayCadence; label: string }> = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Biweekly' },
  { value: 'monthly', label: 'Monthly' },
]

const reviewSteps = [
  'Review current period',
  'Choose rollover',
  'Handle unpaid bills',
  'Start next period',
] as const

type StartNewPeriodDraft = {
  income: string
  cadence: PayCadence
  startDate: string
  endDate: string
  generateRecurring: boolean
  carryCategoryTargets: boolean
}

type CurrentPayPeriodReview = {
  periodLabel: string
  income: number
  totalBills: number
  paidBillsCount: number
  unpaidBillsCount: number
  unpaidBills: Bill[]
  totalExpenses: number
  totalSetAsides: number
  leftover: number
  topCategory: { category: string; total: number } | null
}

type PanelMode = 'edit' | 'review'
type CarryoverMode = 'all' | 'choose' | 'skip'

function getBillDedupKey(bill: {
  name: string
  amount: number
  category: string
  dueDate?: string
  dateLabel?: string
  templateId?: string
}) {
  const templateKey = bill.templateId ? `template:${bill.templateId}` : `name:${bill.name.trim().toLowerCase()}`
  const amountKey = `amount:${bill.amount.toFixed(2)}`
  const categoryKey = `category:${bill.category}`
  const dueDateKey = `due:${bill.dueDate || bill.dateLabel || ''}`
  return [templateKey, amountKey, categoryKey, dueDateKey].join('|')
}

export function StartNewPayPeriodPanel({
  currentPayPeriod,
  currentReview,
  templates,
  categoryTargetCount,
  isOpen,
  defaultPayCadence,
  onClose,
  onSubmit,
}: {
  currentPayPeriod: BudgetPeriod | null
  currentReview: CurrentPayPeriodReview | null
  templates: RecurringItemTemplate[]
  categoryTargetCount: number
  isOpen: boolean
  defaultPayCadence: PayCadence
  onClose: () => void
  onSubmit: (period: BudgetPeriod, options: { generateRecurring: boolean; carryoverBills: Bill[]; carryCategoryTargets: boolean }) => void
}) {
  const [draft, setDraft] = useState<StartNewPeriodDraft>(() => ({
    income: currentPayPeriod ? String(currentPayPeriod.income) : '',
    cadence: currentPayPeriod?.cadence ?? defaultPayCadence,
    startDate: currentPayPeriod?.startDate ?? '',
    endDate: currentPayPeriod?.endDate ?? '',
    generateRecurring: templates.length > 0,
    carryCategoryTargets: true,
  }))
  const [mode, setMode] = useState<PanelMode>('edit')
  const [error, setError] = useState('')
  const [applyRollover, setApplyRollover] = useState(false)
  const [carryoverMode, setCarryoverMode] = useState<CarryoverMode>('skip')
  const [selectedCarryoverBillIds, setSelectedCarryoverBillIds] = useState<string[]>([])

  const preview = useMemo(() => {
    if (!draft.generateRecurring || !draft.startDate || !draft.endDate) {
      return { bills: [], setAsides: [], plannedExpenses: [], total: 0 }
    }

    const income = Number(draft.income)
    if (!Number.isFinite(income) || income <= 0 || draft.endDate < draft.startDate) {
      return { bills: [], setAsides: [], plannedExpenses: [], total: 0 }
    }

    return buildRecurringPreview({
      templates: templates.filter((template) => template.isActive),
      period: {
        cadence: draft.cadence,
        income,
        startDate: draft.startDate,
        endDate: draft.endDate,
      },
    })
  }, [draft, templates])

  const recurringBillsAmount = preview.bills.reduce((sum, item) => sum + item.amount, 0)
  const setAsidesAmount = preview.setAsides.reduce((sum, item) => sum + item.amount, 0)
  const plannedExpensesAmount = preview.plannedExpenses.reduce((sum, item) => sum + item.amount, 0)
  const estimatedSafeToSpendImpact = recurringBillsAmount + setAsidesAmount + plannedExpensesAmount
  const unpaidBills = currentReview?.unpaidBills ?? []
  const unpaidBillsAmount = unpaidBills.reduce((sum, bill) => sum + bill.amount, 0)

  const selectedCarryoverBills = useMemo(() => {
    if (!currentReview || carryoverMode === 'skip') {
      return []
    }

    if (carryoverMode === 'all') {
      return currentReview.unpaidBills
    }

    const selectedIds = new Set(selectedCarryoverBillIds)
    return currentReview.unpaidBills.filter((bill) => selectedIds.has(bill.id))
  }, [carryoverMode, currentReview, selectedCarryoverBillIds])

  const selectedCarryoverAmount = selectedCarryoverBills.reduce((sum, bill) => sum + bill.amount, 0)

  const selectedCarryoverUniqueAmount = useMemo(() => {
    if (selectedCarryoverBills.length === 0) {
      return 0
    }

    const previewKeys = new Set(preview.bills.map((item) => getBillDedupKey(item)))
    return selectedCarryoverBills
      .filter((bill) => !previewKeys.has(getBillDedupKey(bill)))
      .reduce((sum, bill) => sum + bill.amount, 0)
  }, [preview.bills, selectedCarryoverBills])

  const rolloverAmount = applyRollover && currentReview?.leftover && currentReview.leftover > 0 ? currentReview.leftover : 0
  const nextIncome = Number(draft.income) + rolloverAmount
  const hasRolloverAvailable = Boolean(currentReview && currentReview.leftover > 0)
  const hasUnpaidBills = unpaidBills.length > 0
  const baseIncome = Number(draft.income)
  const archivedHistoryMessage = currentReview
    ? `${currentReview.periodLabel} will be saved to History exactly as it looks now, before the next pay period starts.`
    : 'The current pay period will be saved to History before the next one begins.'

  const carryoverModeSummary =
    carryoverMode === 'all'
      ? 'All unpaid bills will be copied into the next pay period.'
      : carryoverMode === 'choose'
        ? selectedCarryoverBills.length > 0
          ? `${selectedCarryoverBills.length} unpaid bill${selectedCarryoverBills.length === 1 ? '' : 's'} will be copied into the next pay period.`
          : 'No unpaid bills are selected to carry into the next pay period.'
        : 'No unpaid bills will be copied into the next pay period.'

  function validateDraft() {
    const income = Number(draft.income)
    if (!Number.isFinite(income) || income <= 0) {
      setError('Income amount must be greater than 0.')
      return false
    }
    if (!draft.startDate || !draft.endDate) {
      setError('Start date and end date are required.')
      return false
    }
    if (draft.endDate < draft.startDate) {
      setError('End date must be after the start date.')
      return false
    }

    setError('')
    return true
  }

  function handleReview() {
    if (!validateDraft()) {
      return
    }

    setMode('review')
  }

  function setCarryoverSelectionMode(nextMode: CarryoverMode) {
    setCarryoverMode(nextMode)
    if (nextMode === 'choose' && currentReview && selectedCarryoverBillIds.length === 0) {
      setSelectedCarryoverBillIds(currentReview.unpaidBills.map((bill) => bill.id))
    }
  }

  function handleSubmit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault()

    if (!validateDraft()) {
      return
    }

    const nextBaseIncome = Number(draft.income)

    onSubmit(
      {
        cadence: draft.cadence,
        income: nextIncome,
        startDate: draft.startDate,
        endDate: draft.endDate,
        baseIncome: nextBaseIncome,
        rolloverAmount: rolloverAmount > 0 ? rolloverAmount : undefined,
        rolloverApplied: rolloverAmount > 0,
      },
      {
        generateRecurring: draft.generateRecurring,
        carryoverBills: selectedCarryoverBills,
        carryCategoryTargets: draft.carryCategoryTargets,
      },
    )
  }

  if (!isOpen) {
    return null
  }

  return (
    <section className="leftly-shell leftly-shell-accent overflow-hidden p-4 sm:p-5">
      <div className="flex flex-col gap-3 border-b border-slate-800/70 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Start new pay period</h3>
          <p className="mt-1 text-sm leading-6 text-slate-400">
            Review the current pay period, choose rollover and unpaid bill carryover, then start the next pay period.
          </p>
        </div>
        <button type="button" onClick={onClose} className={buttonStyles.secondary}>
          Cancel
        </button>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {reviewSteps.map((step, index) => (
          <div key={step} className="leftly-shell-soft flex items-center gap-3 px-3 py-3">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-cyan-400/25 bg-cyan-400/10 text-[11px] font-semibold text-cyan-100">
              {index + 1}
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Step {index + 1}</p>
              <p className="mt-1 text-sm font-medium text-white">{step}</p>
            </div>
          </div>
        ))}
      </div>

      {mode === 'edit' ? (
        <form className="mt-4 grid gap-4" onSubmit={(event) => event.preventDefault()}>
          {currentReview ? (
            <div className="leftly-panel-section">
              <div className="grid gap-1">
                <p className="leftly-panel-label">Review current period</p>
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm font-semibold text-white">What will be archived before the next paycheck starts</p>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{currentReview.periodLabel}</p>
                </div>
                <p className="leftly-panel-copy">{archivedHistoryMessage}</p>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                <SummaryCard label="Date range" value={currentReview.periodLabel} />
                <SummaryCard label="Income" value={formatCurrency(currentReview.income)} />
                <SummaryCard label="Final Leftly" value={formatCurrency(currentReview.leftover)} detail="Available before any rollover choice" />
                <SummaryCard
                  label="Bills"
                  value={formatCurrency(currentReview.totalBills)}
                  detail={`${currentReview.paidBillsCount} paid / ${currentReview.unpaidBillsCount} unpaid`}
                />
                <SummaryCard label="Expenses" value={formatCurrency(currentReview.totalExpenses)} />
                <SummaryCard label="Set-asides" value={formatCurrency(currentReview.totalSetAsides)} />
                <SummaryCard label="Unpaid bills" value={`${currentReview.unpaidBillsCount}`} detail={formatCurrency(unpaidBillsAmount)} />
                <SummaryCard
                  label="Top spending category"
                  value={currentReview.topCategory ? currentReview.topCategory.category : 'None yet'}
                  detail={currentReview.topCategory ? formatCurrency(currentReview.topCategory.total) : 'No expenses logged'}
                />
              </div>

              {hasRolloverAvailable ? (
                <div className="mt-4 leftly-shell-soft border-emerald-500/20 bg-emerald-500/10 p-4">
                  <div className="grid gap-1">
                    <p className="leftly-panel-label text-emerald-200/80">Choose rollover</p>
                    <p className="text-sm font-semibold text-emerald-100">You can roll over {formatCurrency(currentReview.leftover)}</p>
                    <p className="text-sm leading-6 text-emerald-50/80">
                      If you apply rollover, Leftly adds this amount to the next pay period income. If you skip it, the next period starts with base income only.
                    </p>
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <label className={`leftly-selection-card ${!applyRollover ? 'leftly-selection-card-active' : ''}`}>
                      <input
                        type="radio"
                        name="rollover"
                        checked={!applyRollover}
                        onChange={() => setApplyRollover(false)}
                        className="mt-1 h-4 w-4 border-slate-700 text-cyan-400 focus:ring-cyan-400"
                      />
                      <span>
                        <span className="block font-semibold">No, start fresh</span>
                        <span className="mt-1 block text-xs leading-5 text-slate-400">The next pay period starts with base income only.</span>
                      </span>
                    </label>

                    <label className={`leftly-selection-card ${applyRollover ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-50' : ''}`}>
                      <input
                        type="radio"
                        name="rollover"
                        checked={applyRollover}
                        onChange={() => setApplyRollover(true)}
                        className="mt-1 h-4 w-4 border-slate-700 text-cyan-400 focus:ring-cyan-400"
                      />
                      <span>
                        <span className="block font-semibold">Yes, add as rollover income</span>
                        <span className="mt-1 block text-xs leading-5 text-slate-400">Adds {formatCurrency(currentReview.leftover)} to the next pay period total.</span>
                      </span>
                    </label>
                  </div>

                  <div className="mt-3 leftly-shell-faint px-3 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-200/80">Next income preview</p>
                    <p className="mt-1 text-sm font-semibold text-white">{formatCurrency(nextIncome || 0)}</p>
                    <p className="mt-1 text-[11px] leading-5 text-slate-300">
                      {rolloverAmount > 0
                        ? `${formatCurrency(baseIncome || 0)} base income + ${formatCurrency(rolloverAmount)} rollover`
                        : `${formatCurrency(baseIncome || 0)} base income only`}
                    </p>
                  </div>
                </div>
              ) : (
                <EmptyNotice message="No leftover amount is available to roll into the next pay period." />
              )}

              {hasUnpaidBills ? (
                <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
                  <div className="grid gap-1">
                    <p className="leftly-panel-label text-amber-200/80">Handle unpaid bills</p>
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-amber-100">Choose how unpaid bills move forward</p>
                        <p className="mt-1 text-sm leading-6 text-amber-50/80">Copied bills stay unpaid and keep the existing carried-over metadata.</p>
                      </div>
                      <p className="text-xs uppercase tracking-[0.2em] text-amber-100/70">
                        {unpaidBills.length} item{unpaidBills.length === 1 ? '' : 's'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 leftly-shell-faint px-3 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-200/80">Current unpaid total</p>
                    <p className="mt-1 text-sm font-semibold text-white">{formatCurrency(unpaidBillsAmount)}</p>
                    <p className="mt-1 text-[11px] leading-5 text-slate-300">{carryoverModeSummary}</p>
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <label className={`leftly-selection-card ${carryoverMode === 'all' ? 'leftly-selection-card-active' : ''}`}>
                      <input
                        type="radio"
                        name="carryover"
                        checked={carryoverMode === 'all'}
                        onChange={() => setCarryoverSelectionMode('all')}
                        className="mt-1 h-4 w-4 border-slate-700 text-cyan-400 focus:ring-cyan-400"
                      />
                      <span>
                        <span className="block font-semibold">Carry all unpaid bills</span>
                        <span className="mt-1 block text-xs leading-5 text-slate-400">Every unpaid bill is copied into the next pay period.</span>
                      </span>
                    </label>

                    <label className={`leftly-selection-card ${carryoverMode === 'choose' ? 'leftly-selection-card-active' : ''}`}>
                      <input
                        type="radio"
                        name="carryover"
                        checked={carryoverMode === 'choose'}
                        onChange={() => setCarryoverSelectionMode('choose')}
                        className="mt-1 h-4 w-4 border-slate-700 text-cyan-400 focus:ring-cyan-400"
                      />
                      <span>
                        <span className="block font-semibold">Choose bills</span>
                        <span className="mt-1 block text-xs leading-5 text-slate-400">Select only the unpaid bills that should stay active.</span>
                      </span>
                    </label>

                    <label className={`leftly-selection-card ${carryoverMode === 'skip' ? 'leftly-selection-card-active' : ''}`}>
                      <input
                        type="radio"
                        name="carryover"
                        checked={carryoverMode === 'skip'}
                        onChange={() => setCarryoverSelectionMode('skip')}
                        className="mt-1 h-4 w-4 border-slate-700 text-cyan-400 focus:ring-cyan-400"
                      />
                      <span>
                        <span className="block font-semibold">Do not carry over</span>
                        <span className="mt-1 block text-xs leading-5 text-slate-400">Leave unpaid bills in the archived period only.</span>
                      </span>
                    </label>
                  </div>

                  {carryoverMode === 'choose' ? (
                    <div className="mt-4 leftly-shell-soft p-3">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm font-semibold text-white">Select bills to carry over</p>
                        <p className="text-xs text-slate-400">
                          {selectedCarryoverBills.length} selected
                          {selectedCarryoverBills.length > 0 ? ` · ${formatCurrency(selectedCarryoverAmount)}` : ''}
                        </p>
                      </div>

                      <div className="mt-3 grid gap-2">
                        {unpaidBills.map((bill) => {
                          const checked = selectedCarryoverBillIds.includes(bill.id)
                          return (
                            <label key={bill.id} className={`leftly-selection-card ${checked ? 'leftly-selection-card-active' : ''}`}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(event) => {
                                  const nextChecked = event.target.checked
                                  setSelectedCarryoverBillIds((current) => {
                                    if (nextChecked) {
                                      return current.includes(bill.id) ? current : [...current, bill.id]
                                    }

                                    return current.filter((id) => id !== bill.id)
                                  })
                                }}
                                className="mt-1 h-4 w-4 rounded border-slate-700 text-cyan-400 focus:ring-cyan-400"
                              />
                              <span className="min-w-0 flex-1">
                                <span className="flex flex-wrap items-center gap-2">
                                  <span className="font-semibold text-white">{bill.name}</span>
                                  {bill.source === 'recurring' ? (
                                    <span className="leftly-chip border-cyan-400/20 bg-cyan-400/10 px-2 py-0.5 text-[10px] text-cyan-100">
                                      Bill Plan
                                    </span>
                                  ) : null}
                                </span>
                                <span className="mt-1 block text-xs leading-5 text-slate-400">
                                  {bill.category} · due {bill.dueDate} · {formatCurrency(bill.amount)}
                                </span>
                              </span>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <EmptyNotice message="No unpaid bills need a carryover decision for this closeout." />
              )}

              <div className="mt-4 leftly-shell-faint p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">History safety</p>
                <p className="mt-1 text-sm leading-6 text-slate-300">
                  Closing this pay period creates a History snapshot first. Archived unpaid bills stay archived exactly as they were, and any carried bills are copied forward as new unpaid items rather than changing the old snapshot.
                </p>
              </div>
            </div>
          ) : null}

          <div className="leftly-panel-section">
            <div className="grid gap-1">
              <p className="leftly-panel-label">Start next period</p>
              <p className="leftly-panel-copy">Set the income and date range for the next pay period.</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Income amount">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={draft.income}
                  onChange={(event) => setDraft({ ...draft, income: event.target.value })}
                  placeholder="3200"
                />
              </Field>

              <Field label="Cadence">
                <select value={draft.cadence} onChange={(event) => setDraft({ ...draft, cadence: event.target.value as PayCadence })}>
                  {cadenceOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Start date">
                <input type="date" value={draft.startDate} onChange={(event) => setDraft({ ...draft, startDate: event.target.value })} />
              </Field>

              <Field label="End date">
                <input type="date" value={draft.endDate} onChange={(event) => setDraft({ ...draft, endDate: event.target.value })} />
              </Field>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <SummaryCard label="Base income" value={formatCurrency(baseIncome || 0)} detail="Before rollover" />
              <SummaryCard label="Rollover" value={formatCurrency(rolloverAmount)} detail={rolloverAmount > 0 ? 'Will be added to next income' : 'Not applied'} />
              <SummaryCard label="Next income total" value={formatCurrency(nextIncome || 0)} detail="What Leftly starts with" />
            </div>
          </div>

          <label className="leftly-selection-card">
            <input
              type="checkbox"
              checked={draft.generateRecurring}
              onChange={(event) => setDraft({ ...draft, generateRecurring: event.target.checked })}
              className="mt-1 h-4 w-4 rounded border-slate-700 text-cyan-400 focus:ring-cyan-400"
            />
            <span>
              <span className="block font-semibold">Apply Bill Plan items to this pay period</span>
              <span className="mt-1 block text-sm leading-6 text-slate-400">
                {templates.length > 0
                  ? 'Recurring and planned Bill Plan items can be added to the next pay period right away.'
                  : 'No Bill Plan items are saved yet.'}
              </span>
            </span>
          </label>

          <label className="leftly-selection-card">
            <input
              type="checkbox"
              checked={draft.carryCategoryTargets}
              onChange={(event) => setDraft({ ...draft, carryCategoryTargets: event.target.checked })}
              className="mt-1 h-4 w-4 rounded border-slate-700 text-cyan-400 focus:ring-cyan-400"
            />
            <span>
              <span className="block font-semibold">Carry category targets into the new pay period</span>
              <span className="mt-1 block text-sm leading-6 text-slate-400">
                {categoryTargetCount > 0
                  ? `${categoryTargetCount} target${categoryTargetCount === 1 ? '' : 's'} will copy as planning amounts. Spending progress starts over with the new period.`
                  : 'No category targets are set yet.'}
              </span>
            </span>
          </label>

          {error ? (
            <p className="leftly-banner-danger" role="alert">
              {error}
            </p>
          ) : null}

          <div className="leftly-sheet-footer leftly-sheet-footer-sticky">
            <div className="leftly-action-grid">
              <button type="button" onClick={onClose} className={`${buttonStyles.secondary} w-full sm:w-auto`}>
                Close
              </button>
              <button type="button" onClick={handleReview} className={`${buttonStyles.primary} w-full sm:w-auto`}>
                Review pay period
              </button>
            </div>
          </div>
        </form>
      ) : (
        <div className="mt-4 grid gap-4">
          <div className="leftly-panel-section">
            <div className="grid gap-1">
              <p className="leftly-panel-label">Start next period</p>
              <p className="text-sm font-semibold text-white">Final confirmation</p>
              <p className="leftly-panel-copy">
                This summary shows what will be saved, what will roll forward, and what the next pay period will start with.
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              <SummaryCard label="Closed period" value={currentReview?.periodLabel ?? 'Current period'} detail="Saved to History first" />
              <SummaryCard label="Next pay period" value={`${draft.startDate} to ${draft.endDate}`} detail={draft.cadence} />
              <SummaryCard label="Base income" value={formatCurrency(baseIncome)} detail="Before rollover" />
              <SummaryCard label="Rollover" value={formatCurrency(rolloverAmount)} detail={rolloverAmount > 0 ? 'Added to next income' : 'Not applied'} />
              <SummaryCard label="Next income total" value={formatCurrency(nextIncome)} detail={rolloverAmount > 0 ? 'Base income + rollover' : 'Base income only'} />
              <SummaryCard label="Bills carried over" value={`${selectedCarryoverBills.length}`} detail={selectedCarryoverBills.length > 0 ? formatCurrency(selectedCarryoverAmount) : 'None selected'} />
              <SummaryCard label="Category targets" value={draft.carryCategoryTargets ? `${categoryTargetCount}` : '0'} detail={draft.carryCategoryTargets ? 'Copied as targets only' : 'Not copied'} />
              <SummaryCard label="Estimated bills" value={formatCurrency(recurringBillsAmount + selectedCarryoverUniqueAmount)} detail="Bill Plan + carried unpaid bills" />
              <SummaryCard label="Estimated expenses" value={formatCurrency(setAsidesAmount + plannedExpensesAmount)} detail="Bill Plan expenses" />
            </div>
          </div>

          <div className="leftly-shell-soft p-4">
            <p className="text-sm font-semibold text-white">After you confirm</p>
            <ul className="mt-2 space-y-2 text-sm leading-6 text-slate-300">
              <li>Leftly saves the current pay period to History before opening the new one.</li>
              <li>{rolloverAmount > 0 ? `${formatCurrency(rolloverAmount)} is added to the new pay period income.` : 'No rollover is applied to the new pay period income.'}</li>
              <li>{carryoverModeSummary}</li>
              <li>{draft.carryCategoryTargets ? 'Category target amounts copy forward; progress starts with new-period expenses.' : 'Category targets will be cleared for the new pay period.'}</li>
              <li>You can go Back to edit or Cancel to leave without changing data.</li>
            </ul>
          </div>

          <div className="leftly-shell-soft p-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-semibold text-white">Bill Plan preview</p>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{preview.total} item{preview.total === 1 ? '' : 's'}</p>
            </div>

            {draft.generateRecurring ? (
              <div className="mt-4 grid gap-4">
                <SummaryStats
                  billsCount={preview.bills.length}
                  billsAmount={recurringBillsAmount}
                  setAsidesCount={preview.setAsides.length}
                  setAsidesAmount={setAsidesAmount}
                  plannedCount={preview.plannedExpenses.length}
                  plannedAmount={plannedExpensesAmount}
                  safeToSpendImpact={estimatedSafeToSpendImpact}
                />

                {preview.total > 0 ? (
                  <>
                    <PreviewGroup
                      title="Bills due this period"
                      items={preview.bills}
                      emptyLabel="No Bill Plan bills fall inside this pay period."
                    />
                    <PreviewGroup
                      title="Set-asides"
                      items={preview.setAsides}
                      emptyLabel="No set-asides are scheduled for this pay period."
                    />
                    <PreviewGroup
                      title="Planned spending"
                      items={preview.plannedExpenses}
                      emptyLabel="No Bill Plan planned expenses fall inside this pay period."
                    />
                  </>
                ) : (
                  <div className="leftly-empty">
                    <p className="text-sm font-medium text-white">No Bill Plan items land in this pay period.</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-4 leftly-empty">
                <p className="text-sm font-medium text-white">Bill Plan preview is off for this pay period.</p>
              </div>
            )}
          </div>

          <div className="leftly-sheet-footer leftly-sheet-footer-sticky">
            <div className="leftly-action-grid">
              <button type="button" onClick={() => setMode('edit')} className={`${buttonStyles.secondary} w-full sm:w-auto`}>
                Back to edit
              </button>
              <button type="button" onClick={() => handleSubmit()} className={`${buttonStyles.primary} w-full sm:w-auto`}>
                Start new pay period
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

function EmptyNotice({ message }: { message: string }) {
  return (
    <div className="leftly-empty">
      <p className="text-sm font-medium text-white">{message}</p>
    </div>
  )
}

function SummaryCard({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="leftly-shell-soft px-4 py-3.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <div className="mt-2 grid gap-1">
        <p className="text-sm font-semibold tracking-[-0.02em] text-white sm:text-[0.96rem]">{value}</p>
        {detail ? <p className="text-xs leading-5 text-slate-400">{detail}</p> : null}
      </div>
    </div>
  )
}

function SummaryStats({
  billsCount,
  billsAmount,
  setAsidesCount,
  setAsidesAmount,
  plannedCount,
  plannedAmount,
  safeToSpendImpact,
}: {
  billsCount: number
  billsAmount: number
  setAsidesCount: number
  setAsidesAmount: number
  plannedCount: number
  plannedAmount: number
  safeToSpendImpact: number
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Stat label="Bill Plan bills" value={`${billsCount}`} detail={formatCurrency(billsAmount)} />
      <Stat label="Set-asides" value={`${setAsidesCount}`} detail={formatCurrency(setAsidesAmount)} />
      <Stat label="Planned spending" value={`${plannedCount}`} detail={formatCurrency(plannedAmount)} />
      <Stat label="Total items" value={`${billsCount + setAsidesCount + plannedCount}`} detail="preview only" />
      <Stat label="Safe-to-spend impact" value={`-${formatCurrency(safeToSpendImpact)}`} detail="estimated" />
    </div>
  )
}

function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="leftly-shell-soft px-4 py-3.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <p className="text-lg font-semibold tracking-[-0.03em] text-white">{value}</p>
        <p className="text-xs text-slate-400">{detail}</p>
      </div>
    </div>
  )
}

function PreviewGroup({
  title,
  items,
  emptyLabel,
}: {
  title: string
  items: Array<{
    templateId: string
    kind: 'bill' | 'planned-expense'
    name: string
    amount: number
    category: string
    dateLabel: string
    frequency: string
    isSetAside?: boolean
  }>
  emptyLabel: string
}) {
  return (
    <div className="rounded-2xl border border-slate-800/70 bg-slate-950/50 p-3">
      <p className="text-sm font-semibold text-white">{title}</p>
      {items.length > 0 ? (
        <div className="mt-3 grid gap-2">
          {items.map((item) => (
            <div
              key={`${item.templateId}:${item.dateLabel}:${item.kind}`}
              className="flex flex-col gap-1 leftly-shell-soft px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-medium text-white">{item.name}</p>
                  <Badge>{item.isSetAside ? 'Set-aside' : 'Bill Plan'}</Badge>
                </div>
                <p className="text-xs text-slate-400">
                  {item.category} · {item.dateLabel} · {item.frequency} · {item.kind === 'bill' ? 'Due date' : 'Date'}
                </p>
              </div>
              <p className="text-sm font-semibold text-white">{formatCurrency(item.amount)}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm leading-6 text-slate-400">{emptyLabel}</p>
      )}
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

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="leftly-chip border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-[11px] text-cyan-100">
      {children}
    </span>
  )
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}
