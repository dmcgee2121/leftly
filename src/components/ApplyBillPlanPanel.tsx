import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { MAIN_BILL_PLAN, getRecurringOccurrenceKey, getRecurringSetAsideKey } from '../lib/recurring'
import type { Bill, BudgetPeriod, Expense, RecurringItemTemplate } from '../types/budget'
import {
  buildRecurringPreview,
  generateRecurringItems,
  getRecurringPeriodKey,
} from '../lib/recurring'

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
  templateId: string
  label: string
  amount: number
  category: string
  planName: string
  scheduleLabel: string
  occurrenceLabel: string
  dateLabel: string
  status: 'Ready' | 'Already added'
  occurrenceIndex: number
  occurrenceCount: number
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
  planNames: string[]
}

type RecurringPreviewLikeItem = {
  templateId: string
  name: string
  amount: number
  category: string
  planName: string
  scheduleLabel: string
  occurrenceLabel: string
  dateLabel: string
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
        .map((bill) =>
          getRecurringOccurrenceKey({
            kind: 'bill',
            templateId: bill.templateId as string,
            dateLabel: bill.dueDate,
            periodKey: bill.generatedForPeriodId as string,
          }),
        ),
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
        .map((expense) =>
          getRecurringOccurrenceKey({
            kind: 'planned-expense',
            templateId: expense.templateId as string,
            dateLabel: expense.date,
            periodKey: expense.generatedForPeriodId as string,
          }),
        ),
    )
    const addedSetAsideKeys = new Set(
      expenses
        .filter(
          (expense) =>
            expense.source === 'recurring' &&
            expense.setAsideForTemplateId &&
            expense.generatedForPeriodId === periodKey,
        )
        .map((expense) => getRecurringSetAsideKey(expense.setAsideForTemplateId as string, expense.generatedForPeriodId as string)),
    )

    const billsToAdd: PreviewEntry[] = []
    const billsAlreadyAdded: PreviewEntry[] = []
    for (const item of recurringPreview.bills) {
      const key = getRecurringOccurrenceKey({
        kind: 'bill',
        templateId: item.templateId,
        dateLabel: item.dateLabel,
        periodKey,
      })
      const entry = toPreviewEntry(item)
      if (addedBillKeys.has(key)) {
        billsAlreadyAdded.push({ ...entry, status: 'Already added' })
      } else {
        billsToAdd.push({ ...entry, status: 'Ready' })
      }
    }

    const setAsidesToAdd: PreviewEntry[] = []
    const setAsidesAlreadyAdded: PreviewEntry[] = []
    for (const item of recurringPreview.setAsides) {
      const key = getRecurringSetAsideKey(item.templateId, periodKey)
      const entry = toPreviewEntry(item)
      if (addedSetAsideKeys.has(key)) {
        setAsidesAlreadyAdded.push({ ...entry, status: 'Already added' })
      } else {
        setAsidesToAdd.push({ ...entry, status: 'Ready' })
      }
    }

    const plannedToAdd: PreviewEntry[] = []
    const plannedAlreadyAdded: PreviewEntry[] = []
    for (const item of recurringPreview.plannedExpenses) {
      const key = getRecurringOccurrenceKey({
        kind: 'planned-expense',
        templateId: item.templateId,
        dateLabel: item.dateLabel,
        periodKey,
      })
      const entry = toPreviewEntry(item)
      if (addedPlannedExpenseKeys.has(key)) {
        plannedAlreadyAdded.push({ ...entry, status: 'Already added' })
      } else {
        plannedToAdd.push({ ...entry, status: 'Ready' })
      }
    }

    const planNames = getUniquePlanNames([
      ...billsToAdd,
      ...billsAlreadyAdded,
      ...setAsidesToAdd,
      ...setAsidesAlreadyAdded,
      ...plannedToAdd,
      ...plannedAlreadyAdded,
    ])

    return {
      summary: {
        income: activePayPeriod.income,
        startDate: activePayPeriod.startDate,
        endDate: activePayPeriod.endDate,
      },
      billsToAdd: annotateOccurrences(billsToAdd),
      billsAlreadyAdded: annotateOccurrences(billsAlreadyAdded),
      setAsidesToAdd: annotateOccurrences(setAsidesToAdd),
      setAsidesAlreadyAdded: annotateOccurrences(setAsidesAlreadyAdded),
      plannedToAdd: annotateOccurrences(plannedToAdd),
      plannedAlreadyAdded: annotateOccurrences(plannedAlreadyAdded),
      hasTemplates: activeTemplates.length > 0,
      planNames,
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
  const planContext = formatPlanContext(preview.planNames)

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
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Bill Plan</p>
            <h3 className="mt-1 text-lg font-semibold text-white">Apply Bill Plan</h3>
            <p className="mt-1 max-w-xl text-sm leading-6 text-slate-400">
              Review what Leftly will add to this pay period, then confirm only the ready items.
            </p>
          </div>
          <button type="button" onClick={onClose} className={`${buttonStyles.secondary} w-full sm:w-auto`}>
            Close
          </button>
        </div>

        <div className="leftly-shell-soft mt-4 grid gap-3 p-3 sm:p-4">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <ContextCard label="Pay period" value={`${preview.summary.startDate} to ${preview.summary.endDate}`} />
            <ContextCard label="Bill Plan" value={planContext} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <ContextStat label="Ready to add" value={String(readyToAddCount)} tone="ready" />
            <ContextStat label="Already added" value={String(alreadyAddedCount)} tone="muted" />
          </div>
          <p className="text-sm leading-6 text-slate-400">
            Bills, set-asides, and planned spending are shown separately below. Ready means Leftly will add it now.
            Already added means it is already in this pay period, so it will not be duplicated.
          </p>
        </div>

        {!hasAnythingToAdd && !hasAnythingAlreadyAdded ? (
          <div className="leftly-empty mt-4 grid gap-2">
            <p className="text-sm font-semibold text-white">
              {preview.hasTemplates ? 'Nothing from this plan lands in the current pay period.' : 'No Bill Plan items yet.'}
            </p>
            <p className="text-sm leading-6 text-slate-400">
              {preview.hasTemplates
                ? 'That can happen when the schedule does not fall inside this date range yet. The items stay saved in Bill Plan for later.'
                : 'Save a bill or planned item first, then Leftly can apply it to the current pay period.'}
            </p>
          </div>
        ) : null}

        {!hasAnythingToAdd && hasAnythingAlreadyAdded ? (
          <div className="leftly-empty mt-4 grid gap-2">
            <p className="text-sm font-semibold text-white">Everything for this pay period is already in place.</p>
            <p className="text-sm leading-6 text-slate-400">
              Leftly found matching Bill Plan items, but they were already added to this pay period so nothing new will be duplicated.
            </p>
          </div>
        ) : null}

        <div className="mt-4 grid gap-4">
          <PreviewGroup title="Bills due this period" toAdd={preview.billsToAdd} alreadyAdded={preview.billsAlreadyAdded} />
          <PreviewGroup title="Set-asides" toAdd={preview.setAsidesToAdd} alreadyAdded={preview.setAsidesAlreadyAdded} />
          <PreviewGroup title="Planned spending" toAdd={preview.plannedToAdd} alreadyAdded={preview.plannedAlreadyAdded} />
        </div>

        <div className="leftly-sheet-footer leftly-sheet-footer-sticky">
          <div className="flex items-center justify-between gap-3 border-b border-slate-800/70 pb-3 sm:hidden">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Ready now</p>
              <p className="text-sm font-semibold text-white">
                {readyToAddCount > 0 ? `${readyToAddCount} item${readyToAddCount === 1 ? '' : 's'} ready` : 'Nothing new to apply'}
              </p>
            </div>
            {alreadyAddedCount > 0 ? <Badge muted>{alreadyAddedCount} already added</Badge> : null}
          </div>
          <div className="leftly-action-grid pt-3 sm:pt-0">
            <button
              type="button"
              onClick={handleApply}
              disabled={!hasAnythingToAdd}
              className={`${buttonStyles.primary} w-full sm:w-auto`}
            >
              {hasAnythingToAdd ? `Apply ready items (${readyToAddCount})` : 'Nothing new to apply'}
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

function toPreviewEntry(item: RecurringPreviewLikeItem): PreviewEntry {
  return {
    id: `${item.templateId}:${item.dateLabel}:${item.amount}:${item.name}`,
    templateId: item.templateId,
    label: item.name,
    amount: item.amount,
    category: item.category,
    planName: item.planName,
    scheduleLabel: item.scheduleLabel,
    occurrenceLabel: item.occurrenceLabel,
    dateLabel: item.dateLabel,
    status: 'Ready',
    occurrenceIndex: 1,
    occurrenceCount: 1,
  }
}

function annotateOccurrences(entries: PreviewEntry[]) {
  const grouped = new Map<string, PreviewEntry[]>()

  for (const entry of entries) {
    const key = `${entry.templateId}:${entry.status}`
    const current = grouped.get(key) ?? []
    current.push(entry)
    grouped.set(key, current)
  }

  return entries.map((entry) => {
    const matches = [...(grouped.get(`${entry.templateId}:${entry.status}`) ?? [])].sort((left, right) =>
      left.dateLabel.localeCompare(right.dateLabel),
    )
    const occurrenceIndex = matches.findIndex((candidate) => candidate.id === entry.id) + 1

    return {
      ...entry,
      occurrenceIndex,
      occurrenceCount: matches.length,
    }
  })
}

function getUniquePlanNames(entries: PreviewEntry[]) {
  return [...new Set(entries.map((entry) => entry.planName).filter(Boolean))].sort((left, right) => {
    if (left === MAIN_BILL_PLAN) {
      return -1
    }
    if (right === MAIN_BILL_PLAN) {
      return 1
    }
    return left.localeCompare(right)
  })
}

function formatPlanContext(planNames: string[]) {
  if (planNames.length === 0) {
    return 'No active plan items'
  }

  if (planNames.length === 1) {
    return planNames[0]
  }

  if (planNames.length === 2) {
    return `${planNames[0]} + ${planNames[1]}`
  }

  return `${planNames.length} plans in this pay period`
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
        <div className="flex flex-wrap gap-2">
          {toAdd.length > 0 ? <Badge>{toAdd.length} ready</Badge> : null}
          {alreadyAdded.length > 0 ? <Badge muted>{alreadyAdded.length} already added</Badge> : null}
        </div>
      </div>

      {toAdd.length === 0 && alreadyAdded.length === 0 ? (
        <p className="mt-3 text-sm leading-6 text-slate-400">Nothing from this section belongs in the current pay period.</p>
      ) : (
        <div className="mt-3 grid gap-3">
          {toAdd.map((item) => (
            <PreviewRow key={item.id} item={item} />
          ))}
          {alreadyAdded.map((item) => (
            <PreviewRow key={item.id} item={item} />
          ))}
        </div>
      )}
      {totalRows > 0 ? (
        <p className="mt-3 text-xs leading-5 text-slate-500">
          {toAdd.length > 0
            ? 'Each row is one occurrence that will be added for this pay period.'
            : 'These occurrences are already part of this pay period, so Apply will leave them alone.'}
        </p>
      ) : null}
    </div>
  )
}

function PreviewRow({ item }: { item: PreviewEntry }) {
  const isAlreadyAdded = item.status === 'Already added'
  const rowClass = isAlreadyAdded
    ? 'border-slate-800/90 bg-slate-950/45'
    : 'border-cyan-400/20 bg-cyan-400/10 shadow-[0_0_0_1px_rgba(34,211,238,0.05)]'
  const amountClass = isAlreadyAdded ? 'text-slate-300' : 'text-white'

  return (
    <div className={`leftly-shell-soft overflow-hidden border p-3 ${rowClass}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3 sm:hidden">
            <p className="min-w-0 flex-1 text-sm font-semibold text-white">{item.label}</p>
            <p className={`shrink-0 text-sm font-semibold ${amountClass}`}>{formatCurrency(item.amount)}</p>
          </div>

          <div className="hidden items-start justify-between gap-3 sm:flex">
            <p className="min-w-0 flex-1 text-sm font-semibold text-white">{item.label}</p>
            <p className={`shrink-0 text-sm font-semibold ${amountClass}`}>{formatCurrency(item.amount)}</p>
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
            <Badge muted={isAlreadyAdded}>
              {item.status}
            </Badge>
            <Badge muted>{item.planName}</Badge>
            <Badge muted>{item.scheduleLabel}</Badge>
            {item.occurrenceCount > 1 ? (
              <Badge muted>
                Occurrence {item.occurrenceIndex} of {item.occurrenceCount}
              </Badge>
            ) : null}
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <DetailTile label={item.status === 'Already added' ? 'Added for' : 'Adds for'} value={item.occurrenceLabel} quiet={isAlreadyAdded} />
            <DetailTile label="Category" value={item.category} quiet={isAlreadyAdded} />
          </div>
        </div>
      </div>
    </div>
  )
}

function ContextCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1rem] border border-slate-800/80 bg-slate-950/45 px-3.5 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-1.5 text-sm font-semibold tracking-[-0.02em] text-white">{value}</p>
    </div>
  )
}

function ContextStat({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: 'ready' | 'muted'
}) {
  const classes =
    tone === 'ready'
      ? 'border-cyan-400/20 bg-cyan-400/10 text-cyan-100'
      : 'border-slate-800/80 bg-slate-950/45 text-slate-200'

  return (
    <div className={`rounded-[1rem] border px-3.5 py-3 ${classes}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-1.5 text-base font-semibold tracking-[-0.02em]">{value}</p>
    </div>
  )
}

function DetailTile({
  label,
  value,
  quiet = false,
}: {
  label: string
  value: string
  quiet?: boolean
}) {
  return (
    <div className={`rounded-[0.95rem] border px-3 py-2.5 ${quiet ? 'border-slate-800/80 bg-slate-950/40' : 'border-slate-700/80 bg-slate-950/55'}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className={`mt-1 text-sm font-medium ${quiet ? 'text-slate-300' : 'text-slate-100'}`}>{value}</p>
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
