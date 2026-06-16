import { useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import type { Bill, BudgetPeriod, PayCadence, RecurringItemTemplate } from '../types/budget'
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

type StartNewPeriodDraft = {
  income: string
  cadence: PayCadence
  startDate: string
  endDate: string
  generateRecurring: boolean
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
  isOpen,
  defaultPayCadence,
  onClose,
  onSubmit,
}: {
  currentPayPeriod: BudgetPeriod | null
  currentReview: CurrentPayPeriodReview | null
  templates: RecurringItemTemplate[]
  isOpen: boolean
  defaultPayCadence: PayCadence
  onClose: () => void
  onSubmit: (period: BudgetPeriod, options: { generateRecurring: boolean; carryoverBills: Bill[] }) => void
}) {
  const [draft, setDraft] = useState<StartNewPeriodDraft>({
    income: currentPayPeriod ? String(currentPayPeriod.income) : '',
    cadence: currentPayPeriod?.cadence ?? defaultPayCadence,
    startDate: currentPayPeriod?.startDate ?? '',
    endDate: currentPayPeriod?.endDate ?? '',
    generateRecurring: templates.length > 0,
  })
  const [mode, setMode] = useState<PanelMode>('edit')
  const [error, setError] = useState('')
  const [applyRollover, setApplyRollover] = useState(false)
  const [carryoverMode, setCarryoverMode] = useState<CarryoverMode>('skip')
  const [selectedCarryoverBillIds, setSelectedCarryoverBillIds] = useState<string[]>([])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    setDraft({
      income: currentPayPeriod ? String(currentPayPeriod.income) : '',
      cadence: currentPayPeriod?.cadence ?? defaultPayCadence,
      startDate: '',
      endDate: '',
      generateRecurring: templates.length > 0,
    })
    setMode('edit')
    setError('')
    setApplyRollover(false)
    setCarryoverMode('skip')
    setSelectedCarryoverBillIds([])
  }, [currentPayPeriod, defaultPayCadence, isOpen, templates.length])

  useEffect(() => {
    if (carryoverMode !== 'choose' || !currentReview || selectedCarryoverBillIds.length > 0) {
      return
    }

    setSelectedCarryoverBillIds(currentReview.unpaidBills.map((bill) => bill.id))
  }, [carryoverMode, currentReview, selectedCarryoverBillIds.length])

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

  function handleSubmit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault()

    if (!validateDraft()) {
      return
    }

    const baseIncome = Number(draft.income)

    onSubmit(
      {
        cadence: draft.cadence,
        income: nextIncome,
        startDate: draft.startDate,
        endDate: draft.endDate,
        baseIncome,
        rolloverAmount: rolloverAmount > 0 ? rolloverAmount : undefined,
        rolloverApplied: rolloverAmount > 0,
      },
      {
        generateRecurring: draft.generateRecurring,
        carryoverBills: selectedCarryoverBills,
      },
    )
  }

  if (!isOpen) {
    return null
  }

  return (
    <section className="rounded-[1.5rem] border border-cyan-400/20 bg-[linear-gradient(180deg,rgba(7,19,14,0.96),rgba(6,11,18,0.92))] p-4 shadow-2xl shadow-slate-950/30 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
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

      {mode === 'edit' ? (
        <form className="mt-4 grid gap-4" onSubmit={(event) => event.preventDefault()}>
          {currentReview ? (
            <div className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-4">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-semibold text-white">Current pay period review</p>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{currentReview.periodLabel}</p>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                <SummaryCard label="Current income" value={formatCurrency(currentReview.income)} />
                <SummaryCard
                  label="Bills"
                  value={formatCurrency(currentReview.totalBills)}
                  detail={`${currentReview.paidBillsCount} paid / ${currentReview.unpaidBillsCount} unpaid`}
                />
                <SummaryCard label="Expenses" value={formatCurrency(currentReview.totalExpenses)} />
                <SummaryCard label="Set-asides" value={formatCurrency(currentReview.totalSetAsides)} />
                <SummaryCard label="Rollover available" value={formatCurrency(currentReview.leftover)} detail="Can be added to the next pay period" />
                <SummaryCard label="New income total" value={formatCurrency(nextIncome)} detail={rolloverAmount > 0 ? 'Includes rollover' : 'Starts with base income'} />
                <SummaryCard
                  label="Top spending category"
                  value={currentReview.topCategory ? currentReview.topCategory.category : 'None yet'}
                  detail={currentReview.topCategory ? formatCurrency(currentReview.topCategory.total) : 'No expenses logged'}
                />
              </div>

              {currentReview.leftover > 0 ? (
                <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                  <p className="text-sm font-semibold text-emerald-100">Leftover rollover amount: {formatCurrency(currentReview.leftover)}</p>
                  <p className="mt-1 text-sm leading-6 text-emerald-50/80">Add it to the new pay period income total?</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <label className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm transition ${!applyRollover ? 'border-cyan-400/30 bg-cyan-400/10 text-cyan-50' : 'border-slate-800 bg-slate-950/50 text-slate-200'}`}>
                      <input
                        type="radio"
                        name="rollover"
                        checked={!applyRollover}
                        onChange={() => setApplyRollover(false)}
                        className="mt-1 h-4 w-4 border-slate-700 text-cyan-400 focus:ring-cyan-400"
                      />
                      <span>
                        <span className="block font-semibold">No, start fresh</span>
                        <span className="mt-1 block text-xs leading-5 text-slate-400">New pay period starts at the base income amount.</span>
                      </span>
                    </label>

                    <label className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm transition ${applyRollover ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-50' : 'border-slate-800 bg-slate-950/50 text-slate-200'}`}>
                      <input
                        type="radio"
                        name="rollover"
                        checked={applyRollover}
                        onChange={() => setApplyRollover(true)}
                        className="mt-1 h-4 w-4 border-slate-700 text-cyan-400 focus:ring-cyan-400"
                      />
                      <span>
                        <span className="block font-semibold">Yes, add as rollover income</span>
                        <span className="mt-1 block text-xs leading-5 text-slate-400">Adds {formatCurrency(currentReview.leftover)} to the new pay period income total.</span>
                      </span>
                    </label>
                  </div>
                </div>
              ) : (
                <p className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/45 px-4 py-3 text-sm leading-6 text-slate-400">
                  No leftover amount is available to roll over into the next pay period.
                </p>
              )}

              {unpaidBills.length > 0 ? (
                <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-amber-100">Unpaid bills available to carry over</p>
                      <p className="mt-1 text-sm leading-6 text-amber-50/80">Carry unpaid bills into the next pay period?</p>
                    </div>
                    <p className="text-xs uppercase tracking-[0.2em] text-amber-100/70">
                      {unpaidBills.length} item{unpaidBills.length === 1 ? '' : 's'}
                    </p>
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <label
                      className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm transition ${
                        carryoverMode === 'all'
                          ? 'border-cyan-400/30 bg-cyan-400/10 text-cyan-50'
                          : 'border-slate-800 bg-slate-950/50 text-slate-200'
                      }`}
                    >
                      <input
                        type="radio"
                        name="carryover"
                        checked={carryoverMode === 'all'}
                        onChange={() => setCarryoverMode('all')}
                        className="mt-1 h-4 w-4 border-slate-700 text-cyan-400 focus:ring-cyan-400"
                      />
                      <span>
                        <span className="block font-semibold">Carry all unpaid bills</span>
                        <span className="mt-1 block text-xs leading-5 text-slate-400">Copies every unpaid bill into the next pay period.</span>
                      </span>
                    </label>

                    <label
                      className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm transition ${
                        carryoverMode === 'choose'
                          ? 'border-cyan-400/30 bg-cyan-400/10 text-cyan-50'
                          : 'border-slate-800 bg-slate-950/50 text-slate-200'
                      }`}
                    >
                      <input
                        type="radio"
                        name="carryover"
                        checked={carryoverMode === 'choose'}
                        onChange={() => setCarryoverMode('choose')}
                        className="mt-1 h-4 w-4 border-slate-700 text-cyan-400 focus:ring-cyan-400"
                      />
                      <span>
                        <span className="block font-semibold">Choose bills</span>
                        <span className="mt-1 block text-xs leading-5 text-slate-400">Pick which unpaid bills should stay active.</span>
                      </span>
                    </label>

                    <label
                      className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm transition ${
                        carryoverMode === 'skip'
                          ? 'border-cyan-400/30 bg-cyan-400/10 text-cyan-50'
                          : 'border-slate-800 bg-slate-950/50 text-slate-200'
                      }`}
                    >
                      <input
                        type="radio"
                        name="carryover"
                        checked={carryoverMode === 'skip'}
                        onChange={() => setCarryoverMode('skip')}
                        className="mt-1 h-4 w-4 border-slate-700 text-cyan-400 focus:ring-cyan-400"
                      />
                      <span>
                        <span className="block font-semibold">Do not carry over</span>
                        <span className="mt-1 block text-xs leading-5 text-slate-400">Start fresh and leave unpaid bills out.</span>
                      </span>
                    </label>
                  </div>

                  {carryoverMode === 'choose' ? (
                    <div className="mt-4 rounded-2xl border border-slate-800/80 bg-slate-950/50 p-3">
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
                            <label
                              key={bill.id}
                              className={`flex items-start gap-3 rounded-2xl border px-3 py-3 text-sm transition ${
                                checked ? 'border-cyan-400/30 bg-cyan-400/10 text-cyan-50' : 'border-slate-800 bg-slate-950/60 text-slate-200'
                              }`}
                            >
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
                                    <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-100">
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
              ) : null}
            </div>
          ) : null}

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

          <label className="flex items-start gap-3 rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-3 text-sm text-slate-200">
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
                  ? 'Checked by default because Bill Plan items are saved.'
                  : 'No Bill Plan items are saved yet.'}
              </span>
            </span>
          </label>

          {error ? (
            <p className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm font-medium text-rose-200" role="alert">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={handleReview} className={buttonStyles.primary}>
              Review pay period
            </button>
          </div>
        </form>
  ) : (
        <div className="mt-4 grid gap-4">
          <div className="grid gap-3 rounded-2xl border border-slate-800/80 bg-slate-950/60 p-4 sm:grid-cols-2">
            <SummaryCard label="Pay period dates" value={`${draft.startDate} to ${draft.endDate}`} />
            <SummaryCard label="Base income" value={formatCurrency(Number(draft.income))} detail="Before rollover" />
            <SummaryCard
              label="Rollover"
              value={formatCurrency(rolloverAmount)}
              detail={rolloverAmount > 0 ? 'Added to the new pay period income total' : 'Starting fresh'}
            />
            <SummaryCard label="New income total" value={formatCurrency(nextIncome)} detail={rolloverAmount > 0 ? 'Base income + rollover' : 'Base income only'} />
            <SummaryCard label="Carry over bills" value={`${selectedCarryoverBills.length}`} detail={selectedCarryoverBills.length > 0 ? formatCurrency(selectedCarryoverAmount) : 'None selected'} />
            <SummaryCard label="Estimated bills" value={formatCurrency(recurringBillsAmount + selectedCarryoverUniqueAmount)} detail="Bill Plan + carried unpaid bills" />
            <SummaryCard label="Estimated expenses" value={formatCurrency(setAsidesAmount + plannedExpensesAmount)} detail="Bill Plan expenses" />
          </div>

          <div className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-4">
            <p className="text-sm font-semibold text-white">After you confirm</p>
            <ul className="mt-2 space-y-2 text-sm leading-6 text-slate-300">
              <li>Leftly archives the current pay period in History.</li>
              <li>The new pay period starts with the base income, plus rollover if you chose it.</li>
              <li>Selected unpaid bills are copied forward and stay unpaid.</li>
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-4">
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
                  <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/45 p-4">
                    <p className="text-sm font-medium text-white">No Bill Plan items fall inside this pay period.</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-700 bg-slate-950/45 p-4">
                <p className="text-sm font-medium text-white">No Bill Plan items fall inside this pay period.</p>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button type="button" onClick={() => setMode('edit')} className={`${buttonStyles.secondary} w-full sm:w-auto`}>
              Back to edit
            </button>
            <button type="button" onClick={() => handleSubmit()} className={`${buttonStyles.primary} w-full sm:w-auto`}>
              Start new pay period
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

function SummaryCard({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <p className="text-sm font-semibold text-white">{value}</p>
        {detail ? <p className="text-xs text-slate-400">{detail}</p> : null}
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
    <div className="rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <p className="text-lg font-semibold text-white">{value}</p>
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
              className="flex flex-col gap-1 rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
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
    <label className="grid gap-2 text-sm font-medium text-slate-300">
      <span>{label}</span>
      <span className="[&_input]:min-h-11 [&_input]:w-full [&_input]:rounded-xl [&_input]:border [&_input]:border-slate-800 [&_input]:bg-slate-950 [&_input]:px-3 [&_input]:text-sm [&_input]:text-white [&_input]:outline-none [&_input]:transition [&_input]:placeholder:text-slate-500 [&_input]:focus:border-cyan-400/50 [&_input]:focus:ring-4 [&_input]:focus:ring-cyan-400/10 [&_select]:min-h-11 [&_select]:w-full [&_select]:rounded-xl [&_select]:border [&_select]:border-slate-800 [&_select]:bg-slate-950 [&_select]:px-3 [&_select]:text-sm [&_select]:text-white [&_select]:outline-none [&_select]:transition [&_select]:focus:border-cyan-400/50 [&_select]:focus:ring-4 [&_select]:focus:ring-cyan-400/10">
        {children}
      </span>
    </label>
  )
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-100">
      {children}
    </span>
  )
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

