// Overview screen cards: Safe to Spend, forecast, allocation, bills and list rows.
import type { ReactNode } from 'react'
import {
  type BudgetPeriod,
} from '../types/budget'
import { type ForecastViewModel } from '../lib/forecast'
import { formatDateLabel, formatDateRangeLabel } from '../lib/dateLabels'
import { forecastStatusClass, forecastStatusLabel, formatHistoryPeriodLabel, getSafePercent } from '../lib/appHelpers'
import type { OverviewTotals, BillPaymentSummary, DueSoonBillRow } from '../types/app'
import { EmptyState, Field, Badge } from './ui'

export function FinancialPulseHero({
  payPeriod,
  totals,
  formatCurrency,
}: {
  payPeriod: BudgetPeriod | null
  totals: OverviewTotals
  formatCurrency: (value: number) => string
}) {
  const leftoverStatus =
    totals.leftover < 0
      ? 'Over budget'
      : totals.leftover === 0
        ? 'Fully allocated'
        : 'Available after bills and spending'
  const leftoverTone = totals.leftover < 0 ? 'warning' : totals.leftover === 0 ? 'neutral' : 'positive'
  const rangeLabel = payPeriod ? formatDateRangeLabel(payPeriod.startDate, payPeriod.endDate) : 'No active pay period'

  return (
    <section className={`leftly-financial-pulse leftly-financial-pulse-${leftoverTone}`} aria-labelledby="financial-pulse-title">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p id="financial-pulse-title" className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-100/80">Safe to spend</p>
          <span className="text-xs text-slate-400">{rangeLabel}</span>
        </div>
        <p className={`mt-3 break-words text-[clamp(2.8rem,15vw,5rem)] font-semibold leading-[0.95] tracking-[-0.04em] ${totals.safeToSpend < 0 ? 'text-rose-100' : 'text-white'}`}>
          {formatCurrency(totals.safeToSpend)}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
          {totals.leftover !== totals.safeToSpend ? (
            <span>Left after all activity: <strong className="text-slate-200">{formatCurrency(totals.leftover)}</strong></span>
          ) : null}
          <span>{leftoverStatus}</span>
          {payPeriod?.rolloverAmount && payPeriod.rolloverAmount > 0 ? <span>Rollover {formatCurrency(payPeriod.rolloverAmount)}</span> : null}
        </div>
      </div>
    </section>
  )
}

export function NextPaycheckForecastCard({
  forecast,
  formatCurrency,
  onView,
}: {
  forecast: ForecastViewModel
  formatCurrency: (value: number) => string
  onView: () => void
}) {
  return (
    <section className="leftly-overview-section leftly-overview-section-quiet" aria-label="Next paycheck forecast">
      <OverviewSectionHeader
        title="Next paycheck"
        description="Forecast estimate"
      />
      {!forecast.available ? (
        <p className="mt-3 text-sm text-slate-400">Forecast unavailable.</p>
      ) : (
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-xl font-semibold tracking-[-0.03em] text-white">{formatCurrency(forecast.projectedLeft)}</p>
            <p className={`mt-1 text-xs font-semibold ${forecastStatusClass(forecast.status)}`}>{forecastStatusLabel(forecast.status)}</p>
          </div>
          <button type="button" className="button-secondary w-full sm:w-auto" onClick={onView} aria-label="View next paycheck forecast details">
            View forecast
          </button>
        </div>
      )}
    </section>
  )
}

export function ForecastDetail({
  forecast,
  incomeDraft,
  incomeError,
  includeCarryover,
  defaultIncome,
  formatCurrency,
  onIncomeChange,
  onCarryoverChange,
  onReset,
}: {
  forecast: ForecastViewModel
  incomeDraft: string
  incomeError: string
  includeCarryover: boolean
  defaultIncome: number
  formatCurrency: (value: number) => string
  onIncomeChange: (value: string) => void
  onCarryoverChange: (value: boolean) => void
  onReset: () => void
}) {
  if (!forecast.available) {
    return <EmptyState title="Forecast unavailable" text={forecast.unavailableReason ?? 'Set a valid active pay period before opening a forecast.'} />
  }

  return (
    <div className="grid gap-5">
      <div className="leftly-shell-soft grid gap-3 p-4 sm:grid-cols-3 sm:p-5">
        <div><p className="leftly-panel-label">Estimated period</p><p className="mt-1 text-sm font-semibold text-white">{formatHistoryPeriodLabel(forecast.forecastStart, forecast.forecastEnd)}</p></div>
        <div><p className="leftly-panel-label">Projected result</p><p className={`mt-1 break-words text-xl font-semibold ${forecastStatusClass(forecast.status)}`}>{formatCurrency(forecast.projectedLeft)}</p><p className="mt-1 text-xs text-slate-400">{forecastStatusLabel(forecast.status)}</p></div>
        <div><p className="leftly-panel-label">Default income</p><p className="mt-1 text-sm font-semibold text-white">{formatCurrency(defaultIncome)}</p></div>
      </div>

      <div className="leftly-shell-soft grid gap-4 p-4 sm:p-5">
        <div><p className="leftly-panel-label">What-if income</p><p className="leftly-panel-copy">Temporarily test a different next paycheck. This is not saved.</p></div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field label="Expected income">
            <input
              type="text"
              inputMode="decimal"
              value={incomeDraft}
              onChange={(event) => onIncomeChange(event.target.value)}
              aria-invalid={Boolean(incomeError)}
              aria-describedby={incomeError ? 'forecast-income-error' : undefined}
            />
          </Field>
          <button type="button" className="button-secondary w-full sm:w-auto" onClick={onReset}>Reset</button>
        </div>
        {incomeError ? <p id="forecast-income-error" className="text-sm text-rose-200" role="alert">{incomeError}</p> : null}
      </div>

      <div className="leftly-shell-soft grid gap-3 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <input id="forecast-carryover" type="checkbox" checked={includeCarryover} onChange={(event) => onCarryoverChange(event.target.checked)} className="mt-1 h-4 w-4 rounded border-slate-600 bg-slate-900 text-cyan-400 focus:ring-cyan-400" />
          <div><label htmlFor="forecast-carryover" className="font-semibold text-white">Include potential carryover</label><p className="mt-1 text-sm leading-6 text-slate-400">Subtract currently unpaid active-period bills as a scenario only. This does not change closeout or bill status.</p></div>
        </div>
        <div className="flex items-center justify-between gap-3 text-sm"><span className="text-slate-400">Potential unpaid carryover</span><strong className="text-amber-100">{formatCurrency(forecast.potentialCarryoverTotal)}</strong></div>
      </div>

      <section aria-labelledby="forecast-bills-title">
        <h3 id="forecast-bills-title" className="text-base font-semibold text-white">Scheduled Bill Plan items</h3>
        {forecast.projectedBills.length === 0 ? <p className="mt-2 text-sm leading-6 text-slate-400">No scheduled Bill Plan items fall in this estimated period.</p> : (
          <ul className="mt-3 grid gap-2" aria-label="Projected Bill Plan bills">
            {forecast.projectedBills.map((bill) => <li key={`${bill.templateId}:${bill.dueDate}`} className="leftly-compact-list-card"><div className="min-w-0"><p className="break-words text-sm font-semibold text-white">{bill.name}</p><p className="mt-1 text-xs text-slate-400">{formatDateLabel(bill.dueDate)} · {bill.category}</p></div><p className="shrink-0 text-sm font-semibold text-white">{formatCurrency(bill.amount)}</p></li>)}
          </ul>
        )}
      </section>

      <div className="grid gap-2 text-sm leading-6 text-slate-400">
        <p><strong className="text-slate-200">Formula:</strong> {formatCurrency(forecast.expectedIncome)} − {formatCurrency(forecast.scheduledBillTotal)}{includeCarryover ? ` − ${formatCurrency(forecast.potentialCarryoverTotal)}` : ''} = {formatCurrency(forecast.projectedLeft)}.</p>
        <p><strong className="text-slate-200">Assumptions:</strong> current-period income, the current period&apos;s inclusive date length, enabled Bill Plan bills in this range, and potential unpaid carryover only when enabled.</p>
        <p><strong className="text-slate-200">Not included:</strong> unplanned spending, new bills, unentered income changes, bank balances, pending transactions, or a guaranteed future result.</p>
      </div>
    </div>
  )
}

export function PaycheckAllocation({
  totals,
  formatCurrency,
}: {
  totals: OverviewTotals
  formatCurrency: (value: number) => string
}) {
  const otherExpenses = Math.max(0, totals.totalExpenses - totals.totalSetAside)
  const remaining = Math.max(0, totals.leftover)
  const overBudget = Math.max(0, -totals.leftover)
  const buckets = [
    { key: 'bills', label: 'Planned bills', amount: totals.totalPlannedBills, className: 'leftly-allocation-bills' },
    { key: 'set-asides', label: 'Set-asides', amount: totals.totalSetAside, className: 'leftly-allocation-setaside' },
    { key: 'expenses', label: 'Other expenses', amount: otherExpenses, className: 'leftly-allocation-expenses' },
    { key: 'remaining', label: 'Remaining', amount: remaining, className: 'leftly-allocation-remaining' },
  ].filter((bucket) => bucket.amount > 0)
  const allocated = totals.totalPlannedBills + totals.totalSetAside + otherExpenses
  const visualTotal = Math.max(totals.income, allocated + remaining)
  const canShowBar = totals.income > 0 && visualTotal > 0

  return (
    <section className="leftly-overview-section">
      <OverviewSectionHeader
        title="Paycheck allocation"
        description="Planned bills, set-asides, other expenses, and what remains from this pay period."
        aside={overBudget > 0 ? <span className="leftly-chip leftly-chip-warning px-2.5 py-1 text-[10px]">Over by {formatCurrency(overBudget)}</span> : undefined}
      />

      {canShowBar ? (
        <>
          <div className="sr-only">
            Paycheck allocation: {buckets.map((bucket) => `${bucket.label} ${formatCurrency(bucket.amount)}`).join(', ')}
            {overBudget > 0 ? `, over budget by ${formatCurrency(overBudget)}` : ''}
          </div>
          <div className="leftly-allocation-bar mt-4" aria-hidden="true">
            {buckets.map((bucket) => (
              <div
                key={bucket.key}
                className={`leftly-allocation-segment ${bucket.className}`}
                style={{ width: `${getSafePercent(bucket.amount, visualTotal)}%` }}
              />
            ))}
          </div>
        </>
      ) : (
        <div className="mt-4 rounded-[1.1rem] border border-dashed border-slate-700/90 bg-slate-950/45 px-3 py-3 text-sm leading-6 text-slate-400">
          Allocation appears after income is set. Exact bill, set-aside, and expense amounts are still listed below.
        </div>
      )}

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ...buckets,
          ...(overBudget > 0 ? [{ key: 'over', label: 'Over budget', amount: overBudget, className: 'leftly-allocation-over' }] : []),
        ].map((bucket) => (
          <div key={bucket.key} className="leftly-allocation-legend-item">
            <span className={`leftly-allocation-dot ${bucket.className}`} aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white">{bucket.label}</p>
              <p className="mt-1 break-words text-xs text-slate-400">{formatCurrency(bucket.amount)}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

export function BillPaymentProgress({
  summary,
  formatCurrency,
}: {
  summary: BillPaymentSummary
  formatCurrency: (value: number) => string
}) {
  const progress = getSafePercent(summary.paidAmount, summary.totalAmount)
  const progressLabel = summary.totalAmount > 0 ? `${Math.round(progress)}% paid by amount` : 'No bills yet'

  return (
    <section className="leftly-overview-section leftly-overview-section-quiet" aria-labelledby="bill-payment-progress-title">
      <OverviewSectionHeader title="Bills" description="Payment progress" />
      <div className="mt-3">
        <div className="flex items-center justify-between gap-3">
          <p id="bill-payment-progress-title" className="text-sm font-semibold text-white">{progressLabel}</p>
          <span className="text-xs text-slate-400">{summary.paidCount} of {summary.totalCount} paid</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800/90" role="progressbar" aria-label="Bill payment progress by amount" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}>
          <div className="leftly-progress-fill leftly-progress-emerald" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-2 text-xs text-slate-400">{formatCurrency(summary.unpaidAmount)} unpaid</p>
      </div>
    </section>
  )
}

export function OverviewSectionHeader({
  title,
  description,
  aside,
}: {
  title: string
  description: string
  aside?: ReactNode
}) {
  return (
    <div className="leftly-card-heading">
      <div className="min-w-0">
        <p className="leftly-card-title">{title}</p>
        <p className="mt-1 leftly-card-helper">{description}</p>
      </div>
      {aside ? <div className="shrink-0">{aside}</div> : null}
    </div>
  )
}

export function OverviewActionCard({
  eyebrow,
  title,
  helper,
  onClick,
  disabled = false,
  tone = 'default',
  wide = false,
}: {
  eyebrow: string
  title: string
  helper: string
  onClick: () => void
  disabled?: boolean
  tone?: 'default' | 'accent'
  wide?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`leftly-overview-action-card ${tone === 'accent' ? 'leftly-overview-action-card-accent' : ''} ${wide ? 'sm:col-span-2' : ''} disabled:cursor-not-allowed disabled:opacity-50`}
    >
      <div className="min-w-0">
        <p className="hidden text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 sm:block">{eyebrow}</p>
        <p className="text-sm font-semibold tracking-[-0.02em] text-white sm:mt-1">{title}</p>
        <p className="sr-only sm:not-sr-only sm:mt-1 sm:block sm:text-[11px] sm:leading-5 sm:text-slate-400">{helper}</p>
      </div>
      <span className="shrink-0 text-sm text-slate-500">›</span>
    </button>
  )
}

export function DueSoonStatusBadge({ status, tone }: { status: DueSoonBillRow['status']; tone: DueSoonBillRow['statusTone'] }) {
  const className =
    tone === 'rose'
      ? 'border-rose-500/20 bg-rose-500/10 text-rose-100'
      : tone === 'cyan'
        ? 'border-cyan-400/20 bg-cyan-400/10 text-cyan-100'
        : 'border-amber-500/20 bg-amber-500/10 text-amber-100'

  return <span className={`leftly-chip px-2.5 py-1 text-[10px] ${className}`}>{status}</span>
}

export function BillPaymentSummaryBlock({
  summary,
  formatCurrency,
  label,
}: {
  summary: BillPaymentSummary
  formatCurrency: (value: number) => string
  label: string
}) {
  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-950/50 px-3 py-3 sm:px-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">
            {summary.paidCount} of {summary.totalCount} bill{summary.totalCount === 1 ? '' : 's'} paid
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            {formatCurrency(summary.paidAmount)} paid · {formatCurrency(summary.unpaidAmount)} remaining
          </p>
        </div>
        <Badge muted>{label}</Badge>
      </div>
    </div>
  )
}

export function OverviewListRow({
  title,
  badges,
  meta,
  amount,
  actions,
}: {
  title: string
  badges?: ReactNode
  meta: ReactNode
  amount: string
  actions?: ReactNode
}) {
  return (
    <article className="leftly-overview-list-row">
      <div className="leftly-overview-list-main">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-medium text-white">{title}</p>
          {badges}
        </div>
        <div className="text-[11px] leading-5 text-slate-400">{meta}</div>
      </div>
      <div className="leftly-overview-list-side">
        <p className="text-sm font-semibold text-white">{amount}</p>
        {actions ? <div className="leftly-overview-inline-actions">{actions}</div> : null}
      </div>
    </article>
  )
}
