import { useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import type { BudgetPeriod, PayCadence, RecurringItemTemplate } from '../types/budget'
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

type PanelMode = 'edit' | 'review'

export function StartNewPayPeriodPanel({
  currentPayPeriod,
  templates,
  isOpen,
  onClose,
  onSubmit,
}: {
  currentPayPeriod: BudgetPeriod | null
  templates: RecurringItemTemplate[]
  isOpen: boolean
  onClose: () => void
  onSubmit: (period: BudgetPeriod, options: { generateRecurring: boolean }) => void
}) {
  const [draft, setDraft] = useState<StartNewPeriodDraft>({
    income: currentPayPeriod ? String(currentPayPeriod.income) : '',
    cadence: currentPayPeriod?.cadence ?? 'biweekly',
    startDate: currentPayPeriod?.startDate ?? '',
    endDate: currentPayPeriod?.endDate ?? '',
    generateRecurring: templates.length > 0,
  })
  const [mode, setMode] = useState<PanelMode>('edit')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen) {
      return
    }

    setDraft({
      income: currentPayPeriod ? String(currentPayPeriod.income) : '',
      cadence: currentPayPeriod?.cadence ?? 'biweekly',
      startDate: '',
      endDate: '',
      generateRecurring: templates.length > 0,
    })
    setMode('edit')
    setError('')
  }, [currentPayPeriod, isOpen, templates.length])

  const preview = useMemo(() => {
    if (!draft.generateRecurring || !draft.startDate || !draft.endDate) {
      return { bills: [], plannedExpenses: [], total: 0 }
    }

    const income = Number(draft.income)
    if (!Number.isFinite(income) || income <= 0 || draft.endDate < draft.startDate) {
      return { bills: [], plannedExpenses: [], total: 0 }
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
  const plannedExpensesAmount = preview.plannedExpenses.reduce((sum, item) => sum + item.amount, 0)
  const estimatedSafeToSpendImpact = recurringBillsAmount + plannedExpensesAmount

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

    onSubmit(
      {
        cadence: draft.cadence,
        income: Number(draft.income),
        startDate: draft.startDate,
        endDate: draft.endDate,
      },
      {
        generateRecurring: draft.generateRecurring,
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
            Replace the active period, clear old generated recurring items, and clear manual expenses unless you choose not to generate recurring items.
          </p>
        </div>
        <button type="button" onClick={onClose} className={buttonStyles.secondary}>
          Cancel
        </button>
      </div>

      {mode === 'edit' ? (
        <form className="mt-4 grid gap-4" onSubmit={(event) => event.preventDefault()}>
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
              <span className="block font-semibold">Generate recurring items for this pay period</span>
              <span className="mt-1 block text-sm leading-6 text-slate-400">
                {templates.length > 0
                  ? 'Checked by default because recurring templates are saved.'
                  : 'No recurring templates are saved yet.'}
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
            <SummaryCard label="Pay period" value={`${draft.startDate} to ${draft.endDate}`} />
            <SummaryCard label="Income" value={formatCurrency(Number(draft.income))} />
            <SummaryCard label="Cadence" value={draft.cadence} />
            <SummaryCard label="Recurring generation" value={draft.generateRecurring ? 'Enabled' : 'Disabled'} />
          </div>

          <div className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-semibold text-white">Recurring preview</p>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{preview.total} item{preview.total === 1 ? '' : 's'}</p>
            </div>

            {draft.generateRecurring ? (
              <div className="mt-4 grid gap-4">
                <SummaryStats
                  billsCount={preview.bills.length}
                  billsAmount={recurringBillsAmount}
                  plannedCount={preview.plannedExpenses.length}
                  plannedAmount={plannedExpensesAmount}
                  safeToSpendImpact={estimatedSafeToSpendImpact}
                />

                {preview.total > 0 ? (
                  <>
                    <PreviewGroup title="Bills" items={preview.bills} emptyLabel="No recurring bills fall inside this pay period." />
                    <PreviewGroup title="Planned expenses" items={preview.plannedExpenses} emptyLabel="No recurring planned expenses fall inside this pay period." />
                  </>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/45 p-4">
                    <p className="text-sm font-medium text-white">No recurring items fall inside this pay period.</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-700 bg-slate-950/45 p-4">
                <p className="text-sm font-medium text-white">No recurring items fall inside this pay period.</p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => setMode('edit')} className={buttonStyles.secondary}>
              Back to edit
            </button>
            <button type="button" onClick={() => handleSubmit()} className={buttonStyles.primary}>
              Start pay period
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-semibold text-white">{value}</p>
    </div>
  )
}

function SummaryStats({
  billsCount,
  billsAmount,
  plannedCount,
  plannedAmount,
  safeToSpendImpact,
}: {
  billsCount: number
  billsAmount: number
  plannedCount: number
  plannedAmount: number
  safeToSpendImpact: number
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Stat label="Recurring bills" value={`${billsCount}`} detail={formatCurrency(billsAmount)} />
      <Stat label="Planned expenses" value={`${plannedCount}`} detail={formatCurrency(plannedAmount)} />
      <Stat label="Total items" value={`${billsCount + plannedCount}`} detail="preview only" />
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
                  <Badge>{item.isSetAside ? 'Set-aside' : 'Recurring'}</Badge>
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
