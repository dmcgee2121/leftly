import { useMemo } from 'react'
import type { ReactNode } from 'react'
import type { Bill, BudgetPeriod, Expense, RecurringItemTemplate } from '../types/budget'
import { buildRecurringPreview, generateRecurringItems, getRecurringPeriodKey } from '../lib/recurring'

const buttonStyles = {
  primary: 'button-primary',
  secondary: 'button-secondary',
}

type ApplyResult = {
  bills: Bill[]
  expenses: Expense[]
  templates: RecurringItemTemplate[]
}

type PreviewEntry = {
  id: string
  label: string
  amount: number
  category: string
  detail: string
  planName: string
  status: 'To add' | 'Already added'
}

type ApplyPreview = {
  summary: {
    income: number
    startDate: string
    endDate: string
  }
  billsToAdd: PreviewEntry[]
  billsAlreadyAdded: PreviewEntry[]
  setAsidesToAdd: PreviewEntry[]
  setAsidesAlreadyAdded: PreviewEntry[]
  plannedToAdd: PreviewEntry[]
  plannedAlreadyAdded: PreviewEntry[]
  hasTemplates: boolean
}

export function ApplyBillPlanPanel({
  activePayPeriod,
  templates,
  bills,
  expenses,
  isOpen,
  onClose,
  onApply,
}: {
  activePayPeriod: BudgetPeriod | null
  templates: RecurringItemTemplate[]
  bills: Bill[]
  expenses: Expense[]
  isOpen: boolean
  onClose: () => void
  onApply: (result: ApplyResult) => void
}) {
  const preview = useMemo<ApplyPreview | null>(() => {
    if (!activePayPeriod) {
      return null
    }

    const activeTemplates = templates.filter((template) => template.isActive)
    const recurringPreview = buildRecurringPreview({
      templates: activeTemplates,
      period: activePayPeriod,
    })

    const periodKey = getRecurringPeriodKey(activePayPeriod)
    const addedBillKeys = new Set(
      bills
        .filter((bill) => bill.source === 'recurring' && bill.templateId && bill.generatedForPeriodId === periodKey)
        .map((bill) => `${bill.templateId}:${bill.dueDate}:${bill.generatedForPeriodId}`),
    )
    const addedPlannedExpenseKeys = new Set(
      expenses
        .filter(
          (expense) =>
            expense.source === 'recurring' &&
            expense.templateId &&
            expense.generatedForPeriodId === periodKey &&
            !expense.setAsideForTemplateId,
        )
        .map((expense) => `${expense.templateId}:${expense.date}:${expense.generatedForPeriodId}`),
    )
    const addedSetAsideKeys = new Set(
      expenses
        .filter(
          (expense) =>
            expense.source === 'recurring' &&
            expense.setAsideForTemplateId &&
            expense.generatedForPeriodId === periodKey,
        )
        .map((expense) => `${expense.setAsideForTemplateId}:${expense.generatedForPeriodId}`),
    )

    const billsToAdd: PreviewEntry[] = []
    const billsAlreadyAdded: PreviewEntry[] = []
    for (const item of recurringPreview.bills) {
      const key = `${item.templateId}:${item.dateLabel}:${periodKey}`
      const entry = toPreviewEntry(item, `Due ${item.dateLabel}`)
      if (addedBillKeys.has(key)) {
        billsAlreadyAdded.push({ ...entry, status: 'Already added' })
      } else {
        billsToAdd.push({ ...entry, status: 'To add' })
      }
    }

    const setAsidesToAdd: PreviewEntry[] = []
    const setAsidesAlreadyAdded: PreviewEntry[] = []
    for (const item of recurringPreview.setAsides) {
      const key = `${item.templateId}:${periodKey}`
      const entry = toPreviewEntry(item, 'Set aside each pay period')
      if (addedSetAsideKeys.has(key)) {
        setAsidesAlreadyAdded.push({ ...entry, status: 'Already added' })
      } else {
        setAsidesToAdd.push({ ...entry, status: 'To add' })
      }
    }

    const plannedToAdd: PreviewEntry[] = []
    const plannedAlreadyAdded: PreviewEntry[] = []
    for (const item of recurringPreview.plannedExpenses) {
      const key = `${item.templateId}:${item.dateLabel}:${periodKey}`
      const entry = toPreviewEntry(item, `Date ${item.dateLabel}`)
      if (addedPlannedExpenseKeys.has(key)) {
        plannedAlreadyAdded.push({ ...entry, status: 'Already added' })
      } else {
        plannedToAdd.push({ ...entry, status: 'To add' })
      }
    }

    return {
      summary: {
        income: activePayPeriod.income,
        startDate: activePayPeriod.startDate,
        endDate: activePayPeriod.endDate,
      },
      billsToAdd,
      billsAlreadyAdded,
      setAsidesToAdd,
      setAsidesAlreadyAdded,
      plannedToAdd,
      plannedAlreadyAdded,
      hasTemplates: activeTemplates.length > 0,
    }
  }, [activePayPeriod, bills, expenses, templates])

  const period = activePayPeriod

  if (!isOpen || !period || !preview) {
    return null
  }

  const activePeriod = period

  const hasAnythingToAdd =
    preview.billsToAdd.length > 0 || preview.setAsidesToAdd.length > 0 || preview.plannedToAdd.length > 0
  const hasAnythingAlreadyAdded =
    preview.billsAlreadyAdded.length > 0 || preview.setAsidesAlreadyAdded.length > 0 || preview.plannedAlreadyAdded.length > 0
  const alreadyAddedCount =
    preview.billsAlreadyAdded.length + preview.setAsidesAlreadyAdded.length + preview.plannedAlreadyAdded.length
  const readyToAddCount =
    preview.billsToAdd.length + preview.setAsidesToAdd.length + preview.plannedToAdd.length

  function handleApply() {
    const generated = generateRecurringItems({
      templates,
      period: activePeriod,
      existingBills: bills,
      existingExpenses: expenses,
    })

    onApply({
      bills: generated.bills,
      expenses: generated.expenses,
      templates: generated.templates,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 p-3 sm:items-center sm:p-4">
      <button type="button" aria-label="Close bill plan review" className="absolute inset-0 cursor-default" onClick={onClose} />
      <section className="leftly-sheet max-w-3xl">
        <div className="flex flex-col gap-3 border-b border-slate-800/70 pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Bill Plan</p>
            <h3 className="mt-1 text-lg font-semibold text-white">Review Bill Plan items</h3>
            <p className="mt-1 text-sm leading-6 text-slate-400">
              Review what Leftly will add before updating your active budget.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge>{readyToAddCount} ready to add</Badge>
              {alreadyAddedCount > 0 ? <Badge muted>{alreadyAddedCount} already added</Badge> : null}
            </div>
          </div>
          <button type="button" onClick={onClose} className={`${buttonStyles.secondary} w-full sm:w-auto`}>
            Close
          </button>
        </div>

        <div className="leftly-shell-soft mt-4 grid gap-3 p-4 sm:grid-cols-3">
          <SummaryCard label="Pay period" value={`${preview.summary.startDate} to ${preview.summary.endDate}`} />
          <SummaryCard label="Income" value={formatCurrency(preview.summary.income)} />
          <SummaryCard label="Ready to add" value={`${readyToAddCount}`} detail={alreadyAddedCount > 0 ? `${alreadyAddedCount} already added` : 'Nothing duplicated'} />
        </div>

        {!hasAnythingToAdd && !hasAnythingAlreadyAdded ? (
          <div className="leftly-shell-faint mt-4 grid gap-3 p-4">
            <p className="text-sm font-semibold text-white">Nothing from Bill Plan lands in this pay period.</p>
            <p className="text-sm leading-6 text-slate-400">
              Items saved in Bill Plan will appear when their due date falls inside a pay period, or when set-aside is enabled.
            </p>
          </div>
        ) : null}

        <div className="mt-4 grid gap-4">
          <PreviewGroup title="Bills due this period" toAdd={preview.billsToAdd} alreadyAdded={preview.billsAlreadyAdded} />
          <PreviewGroup title="Set-asides" toAdd={preview.setAsidesToAdd} alreadyAdded={preview.setAsidesAlreadyAdded} />
          <PreviewGroup title="Planned spending" toAdd={preview.plannedToAdd} alreadyAdded={preview.plannedAlreadyAdded} />
        </div>

        <div className="leftly-sheet-footer">
          <div className="leftly-action-grid">
            <button type="button" onClick={handleApply} className={`${buttonStyles.primary} w-full sm:w-auto`}>
              Apply selected items
            </button>
            <button type="button" onClick={onClose} className={`${buttonStyles.secondary} w-full sm:w-auto`}>
              Back
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}

function toPreviewEntry(
  item: { name: string; amount: number; category: string; frequency: string; planName: string },
  detail: string,
): PreviewEntry {
  return {
    id: `${item.name}:${detail}:${item.amount}`,
    label: item.name,
    amount: item.amount,
    category: item.category,
    detail: `${item.frequency} · ${detail}`,
    planName: item.planName,
    status: 'To add',
  }
}

function PreviewGroup({
  title,
  toAdd,
  alreadyAdded,
}: {
  title: string
  toAdd: PreviewEntry[]
  alreadyAdded: PreviewEntry[]
}) {
  const totalRows = toAdd.length + alreadyAdded.length

  return (
    <div className="leftly-shell-soft p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
          {toAdd.length} to add{alreadyAdded.length > 0 ? ` · ${alreadyAdded.length} already added` : ''}
        </p>
      </div>

      {toAdd.length === 0 && alreadyAdded.length === 0 ? (
        <p className="mt-3 text-sm leading-6 text-slate-400">Nothing to add yet. Bill Plan items only appear here when they belong in this pay period.</p>
      ) : (
        <div className="mt-3 grid gap-3">
          {toAdd.map((item) => (
            <PreviewRow key={item.id} item={item} />
          ))}
          {alreadyAdded.length > 0 ? (
            <div className="leftly-shell-faint grid gap-2 p-3">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Already added</p>
              {alreadyAdded.map((item) => (
                <PreviewRow key={item.id} item={item} />
              ))}
            </div>
          ) : null}
        </div>
      )}
      {totalRows > 0 ? (
        <p className="mt-3 text-xs leading-5 text-slate-500">
          {toAdd.length > 0 ? 'New items will affect this pay period after you apply.' : 'Everything here is already active in this pay period.'}
        </p>
      ) : null}
    </div>
  )
}

function PreviewRow({ item }: { item: PreviewEntry }) {
  const rowClass =
    item.status === 'Already added'
      ? 'border-emerald-400/20 bg-emerald-400/10'
      : 'border-cyan-400/20 bg-cyan-400/10'

  return (
    <div className={`leftly-shell-soft flex flex-col gap-2 border p-3 sm:flex-row sm:items-start sm:justify-between ${rowClass}`}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-semibold text-white">{item.label}</p>
          <Badge muted={item.status === 'Already added'} success={item.status === 'Already added'}>
            {item.status}
          </Badge>
          <Badge muted>{item.planName}</Badge>
        </div>
        <p className="mt-1 text-xs leading-5 text-slate-400">
          {item.category} · {item.detail}
        </p>
      </div>
      <p className="shrink-0 text-sm font-semibold text-white">{formatCurrency(item.amount)}</p>
    </div>
  )
}

function SummaryCard({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="leftly-shell-soft px-4 py-3.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-semibold tracking-[-0.02em] text-white">{value}</p>
      {detail ? <p className="mt-1 text-xs leading-5 text-slate-400">{detail}</p> : null}
    </div>
  )
}

function Badge({
  children,
  muted = false,
  success = false,
}: {
  children: ReactNode
  muted?: boolean
  success?: boolean
}) {
  const className = success ? 'leftly-chip-success' : muted ? 'leftly-chip-muted' : 'leftly-chip-default'
  return <span className={`leftly-chip ${className}`}>{children}</span>
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

