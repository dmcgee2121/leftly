import type { PlanningHorizon, PlanningHorizonLength, PlanningOccurrence, PlanningPlanFilter } from '../lib/planningHorizon'

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}

function formatRange(startDate: string, endDate: string) {
  return `${formatDate(startDate)}–${formatDate(endDate)}`
}

function occurrenceTypeLabel(type: PlanningOccurrence['type']) {
  return type === 'bill' ? 'Bill' : type === 'set-aside' ? 'Set-aside' : 'Planned expense'
}

export function PlanningHorizonSummary({
  horizon,
  formatCurrency,
  onView,
}: {
  horizon: PlanningHorizon
  formatCurrency: (value: number) => string
  onView: () => void
}) {
  return (
    <section className="leftly-shell-soft mb-4 grid gap-3 border-cyan-400/15 bg-cyan-400/5 p-4" aria-labelledby="planning-horizon-summary-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 id="planning-horizon-summary-title" className="text-sm font-semibold text-white">Planning horizon</h2>
          <p className="mt-1 text-sm leading-6 text-slate-400">Projected from active Bill Plan items across future estimated pay periods. Viewing this does not add anything to your data.</p>
        </div>
        <button type="button" onClick={onView} className="button-secondary w-full shrink-0 sm:w-auto">View planning horizon</button>
      </div>

      {!horizon.available ? (
        <div className="leftly-empty-compact">
          <p className="text-sm font-medium text-white">Planning horizon unavailable</p>
          <p className="mt-1 text-sm leading-6 text-slate-400">{horizon.unavailableReason}</p>
        </div>
      ) : horizon.emptyReason ? (
        <div className="leftly-empty-compact">
          <p className="text-sm font-medium text-white">No active Bill Plan items</p>
          <p className="mt-1 text-sm leading-6 text-slate-400">Add or activate recurring items to see projected schedules here.</p>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryStat label={horizon.horizonLabel} value={`${horizon.activeTemplateCount} active template${horizon.activeTemplateCount === 1 ? '' : 's'}`} />
          <SummaryStat label="Scheduled from Bill Plan" value={formatCurrency(horizon.totalProjectedAmount)} />
          <SummaryStat label="Projected bills" value={formatCurrency(horizon.billsTotal)} />
          <SummaryStat label="Planned expenses" value={formatCurrency(horizon.plannedExpensesTotal)} />
          <SummaryStat label="Set-asides" value={formatCurrency(horizon.setAsidesTotal)} />
          <SummaryStat label="Projected occurrences" value={String(horizon.occurrenceCount)} />
        </div>
      )}
    </section>
  )
}

export function PlanningHorizonDetail({
  horizon,
  planNames,
  planFilter,
  horizonLength,
  formatCurrency,
  onPlanFilterChange,
  onHorizonLengthChange,
}: {
  horizon: PlanningHorizon
  planNames: string[]
  planFilter: PlanningPlanFilter
  horizonLength: PlanningHorizonLength
  formatCurrency: (value: number) => string
  onPlanFilterChange: (value: PlanningPlanFilter) => void
  onHorizonLengthChange: (value: PlanningHorizonLength) => void
}) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="leftly-field">
          <span>Horizon range</span>
          <select value={horizonLength} onChange={(event) => onHorizonLengthChange(Number(event.target.value) as PlanningHorizonLength)} className="leftly-input-shell">
            <option value="3">Next 3 estimated pay periods</option>
            <option value="6">Next 6 estimated pay periods</option>
          </select>
        </label>
        {planNames.length > 1 ? (
          <label className="leftly-field">
            <span>Bill Plan filter</span>
            <select value={planFilter} onChange={(event) => onPlanFilterChange(event.target.value)} className="leftly-input-shell">
              <option value="all">All plans</option>
              {planNames.map((planName) => <option key={planName} value={planName}>{planName}</option>)}
            </select>
          </label>
        ) : null}
      </div>

      {!horizon.available || horizon.emptyReason ? (
        <div className="leftly-empty">
          <p className="text-sm font-semibold text-white">{horizon.emptyReason ? 'No active Bill Plan items' : 'Planning horizon unavailable'}</p>
          <p className="mt-1 text-sm leading-6 text-slate-400">{horizon.emptyReason ? 'The horizon will appear after active recurring items are added.' : horizon.unavailableReason}</p>
        </div>
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <SummaryStat label="Scheduled from Bill Plan" value={formatCurrency(horizon.totalProjectedAmount)} />
            <SummaryStat label="Bills total" value={formatCurrency(horizon.billsTotal)} />
            <SummaryStat label="Planned expenses total" value={formatCurrency(horizon.plannedExpensesTotal)} />
            <SummaryStat label="Set-asides total" value={formatCurrency(horizon.setAsidesTotal)} />
            <SummaryStat label="Projected occurrences" value={String(horizon.occurrenceCount)} />
          </div>

          {horizon.planTotals.length > 1 ? (
            <section className="leftly-shell-faint grid gap-2 p-3" aria-labelledby="planning-plan-totals-title">
              <h3 id="planning-plan-totals-title" className="text-sm font-semibold text-white">Projected totals by plan</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {horizon.planTotals.map((plan) => <div key={plan.planName} className="flex min-w-0 items-start justify-between gap-3 text-sm"><span className="break-words text-slate-400">{plan.planName} · {plan.occurrenceCount} occurrence{plan.occurrenceCount === 1 ? '' : 's'}</span><strong className="shrink-0 text-slate-200">{formatCurrency(plan.total)}</strong></div>)}
              </div>
            </section>
          ) : null}

          <div className="leftly-shell-faint grid gap-2 p-3 text-sm leading-6 text-slate-400">
            <p><strong className="text-slate-200">Projected occurrence:</strong> a schedule generated from an active Bill Plan template for an estimated future period.</p>
            <p>This view excludes manual one-time bills not in Bill Plan, future manual spending, income changes, unpaid carryover, bank activity, and items added later. Phase 7 separately handles expected next-paycheck income and optional current unpaid carryover.</p>
          </div>

          <div className="grid gap-4">
            {horizon.periods.map((period) => (
              <section key={`${period.startDate}:${period.endDate}`} className="leftly-shell-soft grid gap-3 p-3 sm:p-4" aria-labelledby={`planning-period-${period.index}`}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h3 id={`planning-period-${period.index}`} className="text-base font-semibold text-white">Estimated pay period {period.index + 1}</h3>
                    <p className="mt-1 text-sm leading-6 text-slate-400">{formatRange(period.startDate, period.endDate)}</p>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-sm font-semibold text-white">{formatCurrency(period.total)}</p>
                    <p className="mt-1 text-xs text-slate-500">Projected Bill Plan total for this period.</p>
                  </div>
                </div>
                <div className="grid gap-2 text-sm sm:grid-cols-4">
                  <PeriodStat label="Bills" value={formatCurrency(period.billsTotal)} />
                  <PeriodStat label="Planned expenses" value={formatCurrency(period.plannedExpensesTotal)} />
                  <PeriodStat label="Set-asides" value={formatCurrency(period.setAsidesTotal)} />
                  <PeriodStat label="Occurrences" value={String(period.occurrenceCount)} />
                </div>
                {period.occurrences.length > 0 ? (
                  <div className="grid gap-2" aria-label={`Projected occurrences for ${formatRange(period.startDate, period.endDate)}`}>
                    {period.occurrences.map((occurrence) => <OccurrenceRow key={occurrence.id} occurrence={occurrence} formatCurrency={formatCurrency} />)}
                  </div>
                ) : (
                  <p className="leftly-empty-compact text-sm leading-6 text-slate-400">No projected occurrences fall in this estimated pay period. The period remains shown so the selected horizon is clear.</p>
                )}
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function OccurrenceRow({ occurrence, formatCurrency }: { occurrence: PlanningOccurrence; formatCurrency: (value: number) => string }) {
  return (
    <article className="leftly-compact-list-card">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="break-words text-sm font-semibold text-white">{occurrence.name}</p>
          <span className="leftly-chip leftly-chip-muted px-2.5 py-1 text-[10px]">{occurrenceTypeLabel(occurrence.type)}</span>
        </div>
        <p className="mt-1 break-words text-xs leading-5 text-slate-400">{formatDate(occurrence.projectedDate)} · {occurrence.category} · {occurrence.planName}</p>
        <p className="mt-1 break-words text-xs leading-5 text-slate-500">{occurrence.scheduleLabel} · Projected from Bill Plan</p>
      </div>
      <p className="shrink-0 text-sm font-semibold text-white">{formatCurrency(occurrence.amount)}</p>
    </article>
  )
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return <div className="leftly-data-stat"><p className="leftly-data-stat-label">{label}</p><p className="leftly-data-stat-value break-words">{value}</p></div>
}

function PeriodStat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-slate-800/70 bg-slate-950/45 px-3 py-2"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 break-words text-sm font-semibold text-slate-200">{value}</p></div>
}
