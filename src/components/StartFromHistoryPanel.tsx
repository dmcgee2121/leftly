import { useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import type { Bill, BudgetPeriod, Expense, PayCadence, PayPeriodSnapshot } from '../types/budget'

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

type HistoryStartDraft = {
  income: string
  cadence: PayCadence
  startDate: string
  endDate: string
  copyBills: boolean
  resetCopiedBillsToUnpaid: boolean
  clearPaidDates: boolean
  copyPlannedExpenses: boolean
  copyManualExpenses: boolean
}

type HistoryStartReview = {
  period: BudgetPeriod
  bills: Bill[]
  expenses: Expense[]
  copyManualExpenses: boolean
}

type PanelMode = 'edit' | 'review'

export function StartFromHistoryPanel({
  snapshot,
  isOpen,
  onClose,
  onSubmit,
}: {
  snapshot: PayPeriodSnapshot | null
  isOpen: boolean
  onClose: () => void
  onSubmit: (result: HistoryStartReview) => void
}) {
  const [draft, setDraft] = useState<HistoryStartDraft>({
    income: snapshot ? String(snapshot.income) : '',
    cadence: snapshot?.cadence ?? 'biweekly',
    startDate: '',
    endDate: '',
    copyBills: true,
    resetCopiedBillsToUnpaid: true,
    clearPaidDates: true,
    copyPlannedExpenses: true,
    copyManualExpenses: false,
  })
  const [mode, setMode] = useState<PanelMode>('edit')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen || !snapshot) {
      return
    }

    setDraft({
      income: String(snapshot.income),
      cadence: snapshot.cadence,
      startDate: '',
      endDate: '',
      copyBills: true,
      resetCopiedBillsToUnpaid: true,
      clearPaidDates: true,
      copyPlannedExpenses: true,
      copyManualExpenses: false,
    })
    setMode('edit')
    setError('')
  }, [isOpen, snapshot])

  const preview = useMemo(() => {
    if (!snapshot || !draft.startDate || !draft.endDate) {
      return {
        bills: [] as Bill[],
        expenses: [] as Expense[],
        manualExpensesCount: 0,
        manualExpensesTotal: 0,
      }
    }

    const income = Number(draft.income)
    if (!Number.isFinite(income) || income <= 0 || draft.endDate < draft.startDate) {
      return {
        bills: [] as Bill[],
        expenses: [] as Expense[],
        manualExpensesCount: 0,
        manualExpensesTotal: 0,
      }
    }

    const copiedBills = draft.copyBills
      ? snapshot.bills.map((bill) => cloneBill(bill, draft))
      : []
    const recurringExpenses = draft.copyPlannedExpenses
      ? snapshot.expenses.filter((expense) => expense.source === 'recurring').map((expense) => cloneExpense(expense))
      : []
    const manualExpenses = draft.copyManualExpenses
      ? snapshot.expenses.filter((expense) => expense.source !== 'recurring').map((expense) => cloneExpense(expense))
      : []

    return {
      bills: copiedBills,
      expenses: [...recurringExpenses, ...manualExpenses],
      manualExpensesCount: manualExpenses.length,
      manualExpensesTotal: manualExpenses.reduce((sum, expense) => sum + expense.amount, 0),
    }
  }, [draft, snapshot])

  const copiedBillsAmount = preview.bills.reduce((sum, bill) => sum + bill.amount, 0)
  const copiedPlannedExpensesAmount = preview.expenses
    .filter((expense) => expense.source === 'recurring')
    .reduce((sum, expense) => sum + expense.amount, 0)
  const copiedPlannedExpensesCount = preview.expenses.filter((expense) => expense.source === 'recurring').length

  function validateDraft() {
    if (!snapshot) {
      setError('No archived pay period is selected.')
      return false
    }

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

  function handleReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!validateDraft()) {
      return
    }
    setMode('review')
  }

  function handleSubmit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault()

    if (!validateDraft() || !snapshot) {
      return
    }

    const income = Number(draft.income)
    const copiedBills = draft.copyBills
      ? snapshot.bills.map((bill) => cloneBill(bill, draft))
      : []
    const copiedRecurringExpenses = draft.copyPlannedExpenses
      ? snapshot.expenses.filter((expense) => expense.source === 'recurring').map((expense) => cloneExpense(expense))
      : []
    const copiedManualExpenses = draft.copyManualExpenses
      ? snapshot.expenses.filter((expense) => expense.source !== 'recurring').map((expense) => cloneExpense(expense))
      : []

    onSubmit({
      period: {
        cadence: draft.cadence,
        income,
        startDate: draft.startDate,
        endDate: draft.endDate,
      },
      bills: copiedBills,
      expenses: [...copiedRecurringExpenses, ...copiedManualExpenses],
      copyManualExpenses: draft.copyManualExpenses,
    })
  }

  if (!isOpen || !snapshot) {
    return null
  }

  return (
    <section className="rounded-[1.5rem] border border-cyan-400/20 bg-[linear-gradient(180deg,rgba(7,19,14,0.96),rgba(6,11,18,0.92))] p-4 shadow-2xl shadow-slate-950/30 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Use as starting point</h3>
          <p className="mt-1 text-sm leading-6 text-slate-400">
            Copy this archived pay period into a new active period, then adjust the dates and income before starting it.
          </p>
        </div>
        <button type="button" onClick={onClose} className={buttonStyles.secondary}>
          Cancel
        </button>
      </div>

      {mode === 'edit' ? (
        <form className="mt-4 grid gap-4" onSubmit={handleReview}>
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

          <div className="grid gap-3 rounded-2xl border border-slate-800/80 bg-slate-950/55 p-4">
            <Checkbox
              checked={draft.copyBills}
              onChange={(checked) =>
                setDraft({
                  ...draft,
                  copyBills: checked,
                  resetCopiedBillsToUnpaid: checked ? draft.resetCopiedBillsToUnpaid : false,
                  clearPaidDates: checked ? draft.clearPaidDates : false,
                })
              }
              label="Copy bills"
              description="Default on. Keeps the bills from the archived period in the new one."
            />

            <div className="grid gap-3 rounded-2xl border border-slate-800/70 bg-slate-950/60 p-3">
              <Checkbox
                checked={draft.resetCopiedBillsToUnpaid}
                onChange={(checked) => setDraft({ ...draft, resetCopiedBillsToUnpaid: checked })}
                label="Reset copied bills to unpaid"
                description="Default on. Starts copied bills with unpaid status."
              />
              <Checkbox
                checked={draft.clearPaidDates}
                onChange={(checked) => setDraft({ ...draft, clearPaidDates: checked })}
                label="Clear paid dates"
                description="Default on. Removes old payment dates from copied bills."
              />
            </div>

            <Checkbox
              checked={draft.copyPlannedExpenses}
              onChange={(checked) => setDraft({ ...draft, copyPlannedExpenses: checked })}
              label="Copy planned expenses and set-asides"
              description="Default on. Includes recurring planned expenses and reserved set-asides."
            />

            <Checkbox
              checked={draft.copyManualExpenses}
              onChange={(checked) => setDraft({ ...draft, copyManualExpenses: checked })}
              label="Copy manual expenses"
              description="Default off. Most people should leave manual expenses unchecked so each pay period starts fresh."
            />
          </div>

          <p className="text-sm leading-6 text-slate-400">
            Most people should leave manual expenses unchecked so each pay period starts fresh.
          </p>

          {error ? (
            <p className="leftly-banner-danger" role="alert">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                if (validateDraft()) {
                  setMode('review')
                }
              }}
              className={buttonStyles.primary}
            >
              Review copied pay period
            </button>
          </div>
        </form>
      ) : (
        <div className="mt-4 grid gap-4">
          <div className="grid gap-3 rounded-2xl border border-slate-800/80 bg-slate-950/60 p-4 sm:grid-cols-2">
            <SummaryCard label="Pay period" value={`${draft.startDate} to ${draft.endDate}`} />
            <SummaryCard label="Income" value={formatCurrency(Number(draft.income))} />
            <SummaryCard label="Cadence" value={draft.cadence} />
            <SummaryCard label="Copy manual expenses" value={draft.copyManualExpenses ? 'Enabled' : 'Disabled'} />
          </div>

          <div className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-4">
            <p className="text-sm font-semibold text-white">Copy preview</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Stat label="Copied bills" value={`${preview.bills.length}`} detail={formatCurrency(copiedBillsAmount)} />
              <Stat label="Copied planned spending / set-asides" value={`${copiedPlannedExpensesCount}`} detail={formatCurrency(copiedPlannedExpensesAmount)} />
              <Stat label="Manual expenses" value={draft.copyManualExpenses ? `${preview.manualExpensesCount}` : '0'} detail={draft.copyManualExpenses ? formatCurrency(preview.manualExpensesTotal) : 'not copied'} />
              <Stat label="Total copied items" value={`${preview.bills.length + copiedPlannedExpensesCount + (draft.copyManualExpenses ? preview.manualExpensesCount : 0)}`} detail="preview only" />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-4">
            <p className="text-sm font-semibold text-white">Preview items</p>
            <div className="mt-4 grid gap-4">
              <PreviewGroup
                title="Bills"
                items={preview.bills}
                emptyLabel="No bills will be copied."
              />
              <PreviewGroup
                title="Planned spending and set-asides"
                items={preview.expenses.filter((expense) => expense.source === 'recurring')}
                emptyLabel="No planned spending or set-asides will be copied."
              />
              {draft.copyManualExpenses ? (
                <PreviewGroup
                  title="Manual expenses"
                  items={preview.expenses.filter((expense) => expense.source !== 'recurring')}
                  emptyLabel="No manual expenses will be copied."
                />
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button type="button" onClick={() => setMode('edit')} className={`${buttonStyles.secondary} w-full sm:w-auto`}>
              Back to edit
            </button>
            <button type="button" onClick={() => handleSubmit()} className={`${buttonStyles.primary} w-full sm:w-auto`}>
              Start pay period
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

function cloneBill(bill: Bill, draft: HistoryStartDraft): Bill {
  return {
    ...bill,
    id: crypto.randomUUID(),
    isPaid: draft.resetCopiedBillsToUnpaid ? false : bill.isPaid,
    paidDate: draft.clearPaidDates ? null : bill.paidDate,
    generatedForPeriodId: undefined,
  }
}

function cloneExpense(expense: Expense): Expense {
  return {
    ...expense,
    id: crypto.randomUUID(),
    generatedForPeriodId: undefined,
  }
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="leftly-shell-soft px-4 py-3.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-semibold tracking-[-0.02em] text-white">{value}</p>
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
    id: string
    name: string
    amount: number
    category: string
    date?: string
    dueDate?: string
    source?: 'manual' | 'recurring'
    isPaid?: boolean
    paidDate?: string | null
    isPlanned?: boolean
    setAsideForTemplateId?: string
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
              key={item.id}
              className="flex flex-col gap-1 rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-medium text-white">{item.name}</p>
                  <Badge muted>{item.setAsideForTemplateId ? 'Set-aside' : item.isPlanned ? 'Planned spending' : 'Bill Plan'}</Badge>
                </div>
                <p className="text-xs text-slate-400">
                  {item.category} ? {item.dueDate ?? item.date ?? 'copied from archive'}
                  {item.source === 'recurring' ? ' ? recurring' : ' ? manual'}
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

function Checkbox({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  description: string
}) {
  return (
    <label className="flex items-start gap-3 rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-3 text-sm text-slate-200">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-4 w-4 rounded border-slate-700 text-cyan-400 focus:ring-cyan-400"
      />
      <span>
        <span className="block font-semibold">{label}</span>
        <span className="mt-1 block text-sm leading-6 text-slate-400">{description}</span>
      </span>
    </label>
  )
}

function Badge({ children, muted = false }: { children: ReactNode; muted?: boolean }) {
  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${
        muted ? 'border-slate-700 bg-slate-900/70 text-slate-300' : 'border-cyan-400/20 bg-cyan-400/10 text-cyan-100'
      }`}
    >
      {children}
    </span>
  )
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}
