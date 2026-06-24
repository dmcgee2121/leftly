import { useEffect, useMemo, useState } from 'react'
import { formatRecurringScheduleLabel, normalizeRecurringPlanName } from '../lib/recurring'
import type { Bill, BudgetPeriod, Expense, RecurringItemTemplate } from '../types/budget'

type CalendarItemKind = 'income' | 'bill' | 'expense' | 'set-aside'
type CalendarItemTone = 'income' | 'bill' | 'expense' | 'set-aside' | 'paid'

type CalendarItem = {
  id: string
  kind: CalendarItemKind
  tone: CalendarItemTone
  label: string
  amount: number
  category?: string
  paidStatus?: 'Paid' | 'Unpaid'
  carriedOverFromPayPeriodId?: string
  detail: string
  planName?: string
  scheduleLabel?: string
  paidDate?: string | null
  onClick?: () => void
}

type CalendarDay = {
  isoDate: string
  date: Date
  dayLabel: string
  shortLabel: string
  isToday: boolean
  isStart: boolean
  items: CalendarItem[]
}

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

const weekdayFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'short' })
const shortDateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })
const longDateFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

function formatCurrency(amount: number) {
  return currencyFormatter.format(amount)
}

function toLocalIsoDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function startOfLocalDay(value: string) {
  return new Date(`${value}T00:00:00`)
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function isSameLocalDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  )
}

function buildDays(
  payPeriod: BudgetPeriod,
  bills: Bill[],
  expenses: Expense[],
  recurringTemplates: RecurringItemTemplate[],
  onEditBill?: (bill: Bill) => void,
  onEditExpense?: (expense: Expense) => void,
) {
  const start = startOfLocalDay(payPeriod.startDate)
  const end = startOfLocalDay(payPeriod.endDate)
  const today = new Date()
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const billByDate = new Map<string, CalendarItem[]>()

  const ensureBucket = (isoDate: string) => {
    const existing = billByDate.get(isoDate)
    if (existing) {
      return existing
    }

    const bucket: CalendarItem[] = []
    billByDate.set(isoDate, bucket)
    return bucket
  }
  const recurringTemplateById = new Map(recurringTemplates.map((template) => [template.id, template]))

  const days: CalendarDay[] = []
  for (let current = new Date(start); current <= end; current = addDays(current, 1)) {
    const isoDate = toLocalIsoDate(current)
    days.push({
      isoDate,
      date: new Date(current),
      dayLabel: weekdayFormatter.format(current),
      shortLabel: shortDateFormatter.format(current),
      isToday: isSameLocalDay(current, todayStart),
      isStart: current.getTime() === start.getTime(),
      items: ensureBucket(isoDate),
    })
  }

  if (billByDate.has(payPeriod.startDate)) {
    ensureBucket(payPeriod.startDate).unshift({
      id: 'income',
      kind: 'income',
      tone: 'income',
      label: 'Payday',
      amount: payPeriod.income,
      category: 'Income',
      detail: 'Income',
    })
  }

  for (const bill of bills) {
    const isoDate = toLocalIsoDate(startOfLocalDay(bill.dueDate))
    if (!billByDate.has(isoDate)) {
      continue
    }
    const template = bill.templateId ? recurringTemplateById.get(bill.templateId) : undefined

    ensureBucket(isoDate).push({
      id: bill.id,
      kind: 'bill',
      tone: bill.isPaid ? 'paid' : 'bill',
      label: bill.name,
      amount: bill.amount,
      category: bill.category,
      paidStatus: bill.isPaid ? 'Paid' : 'Unpaid',
      carriedOverFromPayPeriodId: bill.carriedOverFromPayPeriodId,
      detail: bill.isPaid ? 'Paid bill' : 'Bill',
      planName: template ? normalizeRecurringPlanName(template.planName) : undefined,
      scheduleLabel: template ? formatRecurringScheduleLabel(template) : undefined,
      paidDate: bill.paidDate,
      onClick: onEditBill ? () => onEditBill(bill) : undefined,
    })
  }

  for (const expense of expenses) {
    const isoDate = toLocalIsoDate(startOfLocalDay(expense.date))
    if (!billByDate.has(isoDate)) {
      continue
    }

    const isSetAside = Boolean(expense.setAsideForTemplateId)
    const template = expense.templateId ? recurringTemplateById.get(expense.templateId) : undefined
    ensureBucket(isoDate).push({
      id: expense.id,
      kind: isSetAside ? 'set-aside' : 'expense',
      tone: isSetAside ? 'set-aside' : expense.isPlanned ? 'set-aside' : 'expense',
      label: isSetAside ? `Set-aside ${expense.name}` : expense.isPlanned ? `Planned ${expense.name}` : expense.name,
      amount: expense.amount,
      category: expense.category,
      detail: isSetAside ? 'Set-aside' : expense.isPlanned ? 'Planned spending' : 'Expense',
      planName: template ? normalizeRecurringPlanName(template.planName) : undefined,
      scheduleLabel: template ? formatRecurringScheduleLabel(template) : undefined,
      onClick: onEditExpense ? () => onEditExpense(expense) : undefined,
    })
  }

  for (const day of days) {
    day.items.sort((left, right) => {
      const order: Record<CalendarItemTone, number> = {
        income: 0,
        bill: 1,
        paid: 1,
        'set-aside': 2,
        expense: 3,
      }

      return order[left.tone] - order[right.tone]
    })
  }

  return days
}

function toneClasses(tone: CalendarItemTone) {
  switch (tone) {
    case 'income':
      return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-100'
    case 'bill':
      return 'border-rose-500/25 bg-rose-500/10 text-rose-100'
    case 'paid':
      return 'border-slate-700 bg-slate-900/80 text-slate-300'
    case 'expense':
      return 'border-amber-500/25 bg-amber-500/10 text-amber-100'
    case 'set-aside':
      return 'border-indigo-500/25 bg-indigo-500/10 text-indigo-100'
  }
}

function itemBadgeClasses(tone: CalendarItemTone) {
  switch (tone) {
    case 'income':
      return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-100'
    case 'bill':
      return 'border-rose-500/20 bg-rose-500/10 text-rose-100'
    case 'paid':
      return 'border-slate-700 bg-slate-900/70 text-slate-300'
    case 'expense':
      return 'border-amber-500/20 bg-amber-500/10 text-amber-100'
    case 'set-aside':
      return 'border-indigo-500/20 bg-indigo-500/10 text-indigo-100'
  }
}

function CalendarMetaBadges({ item }: { item: CalendarItem }) {
  return (
    <>
      <span className="leftly-chip leftly-chip-muted px-2.5 py-1 text-[10px]">{item.detail}</span>
      {item.kind === 'bill' && item.paidStatus ? (
        <span className={`leftly-chip px-2.5 py-1 text-[10px] ${item.paidStatus === 'Paid' ? 'leftly-chip-success' : 'leftly-chip-warning'}`}>
          {item.paidStatus}
        </span>
      ) : null}
      {item.kind === 'bill' && item.carriedOverFromPayPeriodId ? (
        <span className="leftly-chip leftly-chip-muted px-2.5 py-1 text-[10px]">Carried over</span>
      ) : null}
      {item.planName ? <span className="leftly-chip leftly-chip-muted px-2.5 py-1 text-[10px]">{item.planName}</span> : null}
      {item.scheduleLabel ? <span className="leftly-chip leftly-chip-muted px-2.5 py-1 text-[10px]">{item.scheduleLabel}</span> : null}
    </>
  )
}

function DayChip({ item }: { item: CalendarItem }) {
  return (
    <div className={`leftly-calendar-chip ${toneClasses(item.tone)}`}>
      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-80" />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <span className="truncate font-medium">{item.label}</span>
          <span className="shrink-0 font-semibold">{formatCurrency(item.amount)}</span>
        </div>
        <div className="mt-1 flex flex-wrap gap-1.5">
          <CalendarMetaBadges item={item} />
        </div>
      </div>
    </div>
  )
}

function DayCard({
  day,
  selected,
  onSelect,
}: {
  day: CalendarDay
  selected: boolean
  onSelect: () => void
}) {
  const visibleItems = day.items.slice(0, 2)
  const overflowCount = Math.max(0, day.items.length - visibleItems.length)

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`leftly-calendar-day-card ${
        selected
          ? 'border-cyan-400/30 bg-cyan-400/10 ring-1 ring-cyan-400/20'
          : day.isToday
            ? 'border-cyan-400/20 bg-cyan-400/5'
            : 'border-slate-800/70 bg-slate-950/55 hover:border-slate-700 hover:bg-slate-950/70'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">{day.dayLabel}</p>
          <p className="mt-1 text-lg font-semibold tracking-tight text-white">{day.date.getDate()}</p>
          <p className="mt-1 text-[11px] text-slate-500">{day.shortLabel}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {day.isStart ? (
            <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-100">
              Payday
            </span>
          ) : null}
          {day.isToday ? (
            <span className="rounded-full border border-cyan-400/25 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-100">
              Today
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-2 grid gap-1">
        {visibleItems.length > 0 ? (
          visibleItems.map((item) => <DayChip key={item.id + item.label} item={item} />)
        ) : (
          <p className="rounded-full border border-dashed border-slate-800 bg-slate-950/35 px-2 py-1.5 text-[11px] text-slate-500">
            No items on this day
          </p>
        )}
        {overflowCount > 0 ? (
          <p className="inline-flex w-fit rounded-full border border-slate-700 bg-slate-900/70 px-2 py-1 text-[11px] font-medium text-slate-300">
            +{overflowCount} more
          </p>
        ) : null}
      </div>
    </button>
  )
}

function DetailItem({
  item,
}: {
  item: CalendarItem
}) {
  const isClickable = Boolean(item.onClick)

  return (
    <button
      type="button"
      onClick={item.onClick}
      disabled={!isClickable}
      className={`leftly-calendar-detail-item ${isClickable ? 'hover:border-slate-500/70 hover:bg-black/10 active:translate-y-px' : ''} ${itemBadgeClasses(item.tone)}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="min-w-0 truncate font-medium text-white">{item.label}</p>
            <CalendarMetaBadges item={item} />
          </div>
          <p className="mt-1 text-[11px] text-current/75">
            {item.category ? item.category : 'Income'}
            {item.kind === 'bill' && item.paidDate ? ` \u00B7 paid ${item.paidDate}` : ''}
          </p>
        </div>
        <div className="shrink-0 text-sm font-semibold text-white">{formatCurrency(item.amount)}</div>
      </div>
    </button>
  )
}

function itemTypeLabel(item: CalendarItem) {
  switch (item.kind) {
    case 'income':
      return 'Income'
    case 'bill':
      return 'Bill'
    case 'expense':
      return 'Expense'
    case 'set-aside':
      return 'Set-aside'
  }
}

function AgendaItemRow({ item }: { item: CalendarItem }) {
  const isClickable = Boolean(item.onClick)

  return (
    <button
      type="button"
      onClick={item.onClick}
      disabled={!isClickable}
      className={`leftly-calendar-agenda-item ${isClickable ? 'hover:border-slate-500/70 hover:bg-black/10 active:translate-y-px' : ''} ${itemBadgeClasses(item.tone)}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="min-w-0 truncate font-medium text-white">{item.label}</p>
            <CalendarMetaBadges item={{ ...item, detail: itemTypeLabel(item) }} />
          </div>
          <p className="mt-1 text-[11px] text-current/75">
            {item.category ? item.category : 'Income'}
            {item.kind === 'bill' && item.paidDate ? ` \u00B7 paid ${item.paidDate}` : ''}
          </p>
        </div>
        <div className="shrink-0 text-sm font-semibold text-white">{formatCurrency(item.amount)}</div>
      </div>
    </button>
  )
}

function AgendaGapRow({ start, end }: { start: string; end: string }) {
  return (
    <div className="leftly-calendar-gap-row">
      Nothing scheduled from {start} {"\u2013"} {end}
    </div>
  )
}

function AgendaDaySection({
  day,
  expanded,
  onToggle,
}: {
  day: CalendarDay
  expanded: boolean
  onToggle: () => void
}) {
  const visibleItems = expanded || day.items.length <= 3 ? day.items : day.items.slice(0, 3)
  const totalAmount = day.items.reduce((sum, item) => sum + item.amount, 0)
  const groups = {
    income: visibleItems.filter((item) => item.kind === 'income'),
    bills: visibleItems.filter((item) => item.kind === 'bill'),
    setAsides: visibleItems.filter((item) => item.kind === 'set-aside'),
    expenses: visibleItems.filter((item) => item.kind === 'expense'),
  }

  return (
    <section className={`leftly-calendar-agenda-day ${day.isToday ? 'border-cyan-400/20 bg-cyan-400/5' : 'border-slate-800/70 bg-slate-950/55'}`}>
      <button type="button" onClick={onToggle} className="flex w-full items-start justify-between gap-3 text-left">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">{day.dayLabel}</p>
            <p className="text-lg font-semibold tracking-tight text-white">{day.date.getDate()}</p>
            <p className="text-[11px] text-slate-500">{day.shortLabel}</p>
            {day.isToday ? (
              <span className="rounded-full border border-cyan-400/25 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-100">
                Today
              </span>
            ) : null}
            {day.isStart ? (
              <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-100">
                Payday
              </span>
            ) : null}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
            <span>{day.items.length} item{day.items.length === 1 ? '' : 's'}</span>
            {day.items.length > 0 ? <span>{"\u2022"} {formatCurrency(totalAmount)}</span> : <span>No scheduled items</span>}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold text-white">{day.items.length > 0 ? formatCurrency(totalAmount) : 'Clear'}</p>
          <span className="mt-1 inline-flex rounded-full border border-slate-700 bg-slate-900/70 px-2.5 py-1 text-[11px] font-semibold text-slate-200">
            {expanded ? 'Hide' : 'Show'}
          </span>
        </div>
      </button>

      <div className="mt-3 grid gap-2">
        {day.items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-800 bg-slate-950/35 px-3 py-2 text-[11px] text-slate-500">Nothing scheduled this day.</p>
        ) : null}

        {groups.income.length > 0 ? (
          <div className="grid gap-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-200/80">Income</p>
            {groups.income.map((item) => (
              <AgendaItemRow key={item.id} item={item} />
            ))}
          </div>
        ) : null}

        {groups.bills.length > 0 ? (
          <div className="grid gap-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-200/80">Bills</p>
            {groups.bills.map((item) => (
              <AgendaItemRow key={item.id} item={item} />
            ))}
          </div>
        ) : null}

        {groups.setAsides.length > 0 ? (
          <div className="grid gap-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-200/80">Set-asides</p>
            {groups.setAsides.map((item) => (
              <AgendaItemRow key={item.id} item={item} />
            ))}
          </div>
        ) : null}

        {groups.expenses.length > 0 ? (
          <div className="grid gap-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-200/80">Expenses</p>
            {groups.expenses.map((item) => (
              <AgendaItemRow key={item.id} item={item} />
            ))}
          </div>
        ) : null}

        {day.items.length > 3 ? (
          <p className="text-[11px] font-medium text-slate-500">{expanded ? 'Show less' : `Show all ${day.items.length} items`}</p>
        ) : null}
      </div>
    </section>
  )
}

export function PayPeriodCalendar({
  payPeriod,
  bills,
  expenses,
  recurringTemplates,
  onEditBill,
  onEditExpense,
}: {
  payPeriod: BudgetPeriod | null
  bills: Bill[]
  expenses: Expense[]
  recurringTemplates: RecurringItemTemplate[]
  onEditBill?: (bill: Bill) => void
  onEditExpense?: (expense: Expense) => void
}) {
  const days = useMemo(() => {
    if (!payPeriod) {
      return []
    }

    return buildDays(payPeriod, bills, expenses, recurringTemplates, onEditBill, onEditExpense)
  }, [bills, expenses, onEditBill, onEditExpense, payPeriod, recurringTemplates])

  const hasScheduledItems = days.some((day) => day.items.some((item) => item.kind !== 'income'))
  const start = payPeriod ? startOfLocalDay(payPeriod.startDate) : null
  const end = payPeriod ? startOfLocalDay(payPeriod.endDate) : null
  const selectedDefault = useMemo(() => {
    if (!days.length) {
      return null
    }

    const todayMatch = days.find((day) => day.isToday)
    if (todayMatch) {
      return todayMatch.isoDate
    }

    const activeMatch = days.find((day) => day.items.length > 0)
    return activeMatch?.isoDate ?? days[0].isoDate
  }, [days])

  const [selectedIsoDate, setSelectedIsoDate] = useState<string | null>(selectedDefault)
  const [viewMode, setViewMode] = useState<'agenda' | 'calendar'>('agenda')
  const [agendaExpandedIsoDate, setAgendaExpandedIsoDate] = useState<string | null>(null)
  const [showAllSelectedItems, setShowAllSelectedItems] = useState(false)

  useEffect(() => {
    if (window.matchMedia('(min-width: 1024px)').matches) {
      setViewMode('calendar')
    }
  }, [])

  useEffect(() => {
    setSelectedIsoDate(selectedDefault)
  }, [selectedDefault, payPeriod?.startDate, payPeriod?.endDate])

  const selectedDay = days.find((day) => day.isoDate === selectedIsoDate) ?? days[0] ?? null

  useEffect(() => {
    setShowAllSelectedItems(false)
  }, [selectedDay?.isoDate])

  const agendaEntries = useMemo(() => {
    const importantIndexes = days
      .map((day, index) => ({ day, index }))
      .filter(({ day }) => day.isStart || day.isToday || day.items.length > 0)

    const entries: Array<
      | { kind: 'day'; day: CalendarDay }
      | { kind: 'gap'; startLabel: string; endLabel: string }
    > = []

    importantIndexes.forEach(({ day, index }, position) => {
      const previous = importantIndexes[position - 1]
      if (previous && index - previous.index > 1) {
        entries.push({
          kind: 'gap',
          startLabel: shortDateFormatter.format(days[previous.index + 1].date),
          endLabel: shortDateFormatter.format(days[index - 1].date),
        })
      }

      entries.push({ kind: 'day', day })
    })

    return entries
  }, [days])

  useEffect(() => {
    setAgendaExpandedIsoDate(null)
  }, [payPeriod?.startDate, payPeriod?.endDate])

  if (!payPeriod || !start || !end) {
    return null
  }

  const dayCount = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1)
  const billCount = bills.length
  const expenseCount = expenses.length
  const setAsideCount = expenses.filter((expense) => Boolean(expense.setAsideForTemplateId)).length
  const rangeLabel = `${longDateFormatter.format(start)} - ${longDateFormatter.format(end)}`
  const nextScheduledDay = days.find((day) => day.items.some((item) => item.kind !== 'income'))

  const groupedItems = selectedDay
    ? {
        income: selectedDay.items.filter((item) => item.kind === 'income'),
        bills: selectedDay.items.filter((item) => item.kind === 'bill'),
        setAsides: selectedDay.items.filter((item) => item.kind === 'set-aside'),
        expenses: selectedDay.items.filter((item) => item.kind === 'expense'),
      }
    : { income: [], bills: [], setAsides: [], expenses: [] }

  const selectedItemsVisible = selectedDay
    ? showAllSelectedItems || selectedDay.items.length <= 5
      ? selectedDay.items
      : selectedDay.items.slice(0, 5)
    : []
  const visibleItemIds = new Set(selectedItemsVisible.map((item) => item.id))
  const visibleGroups = {
    income: groupedItems.income.filter((item) => visibleItemIds.has(item.id)),
    bills: groupedItems.bills.filter((item) => visibleItemIds.has(item.id)),
    setAsides: groupedItems.setAsides.filter((item) => visibleItemIds.has(item.id)),
    expenses: groupedItems.expenses.filter((item) => visibleItemIds.has(item.id)),
  }

  const agendaIsActive = viewMode === 'agenda'
  const toggleViewMode = (nextMode: 'agenda' | 'calendar') => {
    setViewMode(nextMode)
    if (nextMode === 'agenda') {
      setAgendaExpandedIsoDate(null)
    }
  }

  return (
    <section className="leftly-calendar-shell">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-cyan-200/70">Pay Period Calendar</p>
          <h3 className="mt-1 text-xl font-semibold tracking-tight text-white sm:text-2xl">{rangeLabel}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Agenda stays compact on mobile. Calendar stays available when you want the full spread.
          </p>
        </div>
        <div className="leftly-calendar-toggle-wrap">
          <div className="inline-flex rounded-full border border-slate-800 bg-slate-950/70 p-1">
            <button
              type="button"
              aria-pressed={agendaIsActive}
              onClick={() => toggleViewMode('agenda')}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${agendaIsActive ? 'bg-cyan-400/10 text-cyan-100' : 'text-slate-400 hover:text-white'}`}
            >
              Agenda
            </button>
            <button
              type="button"
              aria-pressed={!agendaIsActive}
              onClick={() => toggleViewMode('calendar')}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${!agendaIsActive ? 'bg-cyan-400/10 text-cyan-100' : 'text-slate-400 hover:text-white'}`}
            >
              Calendar
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <div className="leftly-calendar-stat">
          <p className="leftly-calendar-stat-label">Pay period</p>
          <p className="leftly-calendar-stat-value">{dayCount} days</p>
        </div>
        <div className="leftly-calendar-stat">
          <p className="leftly-calendar-stat-label">Bills</p>
          <p className="leftly-calendar-stat-value">{billCount}</p>
        </div>
        <div className="leftly-calendar-stat">
          <p className="leftly-calendar-stat-label">Expenses</p>
          <p className="leftly-calendar-stat-value">{expenseCount}</p>
        </div>
        <div className="leftly-calendar-stat">
          <p className="leftly-calendar-stat-label">Set-asides</p>
          <p className="leftly-calendar-stat-value">{setAsideCount}</p>
        </div>
      </div>

      <div className="mt-3 leftly-shell-soft p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              {agendaIsActive ? 'Agenda focus' : 'Calendar focus'}
            </p>
            <p className="mt-1 text-sm font-semibold text-white">
              {nextScheduledDay
                ? `Next scheduled day: ${longDateFormatter.format(nextScheduledDay.date)}`
                : 'No scheduled items in this pay period yet'}
            </p>
            <p className="mt-1 text-[11px] leading-5 text-slate-400">
              {agendaIsActive
                ? 'Grouped rows keep upcoming bills and spending readable on phone screens.'
                : 'Tap a day to inspect the items scheduled there.'}
            </p>
          </div>
          {selectedDay ? (
            <div className="flex flex-wrap gap-2 text-[11px]">
              <span className="leftly-chip leftly-chip-muted px-2.5 py-1">Selected {selectedDay.shortLabel}</span>
              <span className="leftly-chip leftly-chip-muted px-2.5 py-1">
                {selectedDay.items.length} item{selectedDay.items.length === 1 ? '' : 's'}
              </span>
            </div>
          ) : null}
        </div>
      </div>

      {hasScheduledItems ? null : (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-700 bg-slate-950/45 px-4 py-3 text-sm leading-6 text-slate-400">
          Nothing scheduled yet. Add a bill, log spending, or apply Bill Plan.
        </div>
      )}

      {agendaIsActive ? (
        <div className="mt-4 grid gap-3">
          {agendaEntries.map((entry) =>
            entry.kind === 'gap' ? (
              <AgendaGapRow key={`${entry.startLabel}-${entry.endLabel}`} start={entry.startLabel} end={entry.endLabel} />
            ) : (
              <AgendaDaySection
                key={entry.day.isoDate}
                day={entry.day}
                expanded={agendaExpandedIsoDate === entry.day.isoDate}
                onToggle={() =>
                  setAgendaExpandedIsoDate((current) => (current === entry.day.isoDate ? null : entry.day.isoDate))
                }
              />
            ),
          )}
        </div>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
            {days.map((day) => (
              <DayCard key={day.isoDate} day={day} selected={day.isoDate === selectedDay?.isoDate} onSelect={() => setSelectedIsoDate(day.isoDate)} />
            ))}
          </div>

          <div className="mt-4 hidden rounded-[1.35rem] border border-slate-800/80 bg-slate-950/70 p-3 lg:block sm:p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.22em] text-slate-500">Selected day</p>
                <h4 className="mt-1 text-lg font-semibold text-white sm:text-xl">{selectedDay ? longDateFormatter.format(selectedDay.date) : 'No day selected'}</h4>
              </div>
              {selectedDay ? (
                <div className="flex flex-wrap gap-2 text-xs">
                  {selectedDay.isToday ? (
                    <span className="rounded-full border border-cyan-400/25 bg-cyan-400/10 px-3 py-1.5 text-cyan-100">Today</span>
                  ) : null}
                  <span className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1.5 text-slate-300">
                    {selectedDay.items.length} item{selectedDay.items.length === 1 ? '' : 's'}
                  </span>
                </div>
              ) : null}
            </div>

            {selectedDay ? (
              <div className="mt-3 grid gap-3">
                {visibleGroups.income.length > 0 ? (
                  <div className="grid gap-1.5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-200/80">Income</p>
                    {visibleGroups.income.map((item) => (
                      <DetailItem key={item.id} item={item} />
                    ))}
                  </div>
                ) : null}

                {visibleGroups.bills.length > 0 ? (
                  <div className="grid gap-1.5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-200/80">Bills</p>
                    {visibleGroups.bills.map((item) => (
                      <DetailItem key={item.id} item={item} />
                    ))}
                  </div>
                ) : null}

                {visibleGroups.setAsides.length > 0 ? (
                  <div className="grid gap-1.5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-200/80">Set-asides</p>
                    {visibleGroups.setAsides.map((item) => (
                      <DetailItem key={item.id} item={item} />
                    ))}
                  </div>
                ) : null}

                {visibleGroups.expenses.length > 0 ? (
                  <div className="grid gap-1.5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-200/80">Expenses</p>
                    {visibleGroups.expenses.map((item) => (
                      <DetailItem key={item.id} item={item} />
                    ))}
                  </div>
                ) : null}

                {selectedDay.items.length > 5 ? (
                  <button
                    type="button"
                    onClick={() => setShowAllSelectedItems((current) => !current)}
                    className="inline-flex w-fit items-center rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1.5 text-xs font-semibold text-slate-200"
                  >
                    {showAllSelectedItems ? 'Show less' : `Show all ${selectedDay.items.length} items`}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </>
      )}
    </section>
  )
}
