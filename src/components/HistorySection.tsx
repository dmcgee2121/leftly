// History screen: saved pay periods, search and insights.
import { useMemo, useState } from 'react'
import {
  type PayPeriodSnapshot,
} from '../types/budget'
import { type InsightBillMeasure, type InsightComparison, type InsightRange, type PayPeriodInsights } from '../lib/insights'
import { searchHistoryActivity } from '../lib/historySearch'
import { formatDateLabel, formatDateRangeLabel } from '../lib/dateLabels'
import { formatHistoryPeriodLabel, getSnapshotCarriedOverSummary, getSnapshotTopExpenseCategories, calculateCategoryTargetProgress, getSnapshotLeftlyStatus, formatArchivedDate, getSnapshotStartingIncome } from '../lib/appHelpers'
import type { HistorySort } from '../types/app'
import { TargetProgressCard } from './CategoryCards'
import { OverviewSectionHeader } from './OverviewCards'
import { Badge, MiniStat, EmptyState } from './ui'

export function HistorySection({
  snapshots,
  selectedSnapshot,
  onSelectSnapshot,
  onUseAsStartingPoint,
  onExportSnapshotCsv,
  onBackToList,
  onDeleteSnapshot,
  formatCurrency,
}: {
  snapshots: PayPeriodSnapshot[]
  selectedSnapshot: PayPeriodSnapshot | null
  onSelectSnapshot: (id: string) => void
  onUseAsStartingPoint: (snapshot: PayPeriodSnapshot) => void
  onExportSnapshotCsv: (snapshot: PayPeriodSnapshot) => void
  onBackToList: () => void
  onDeleteSnapshot: (id: string) => void
  formatCurrency: (value: number) => string
}) {
  const [showAllExpenses, setShowAllExpenses] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [historySort, setHistorySort] = useState<HistorySort>('newest')

  const filteredSnapshots = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase()
    const matchingSnapshots = snapshots.filter((snapshot) => {
      if (!query) return true
      const periodText = formatHistoryPeriodLabel(snapshot.startDate, snapshot.endDate)
      return [snapshot.label, snapshot.startDate, snapshot.endDate, snapshot.cadence, periodText]
        .join(' ')
        .toLocaleLowerCase()
        .includes(query)
    })
    return matchingSnapshots
      .map((snapshot, index) => ({ snapshot, index }))
      .sort((left, right) => {
        const comparison = historySort === 'highest-leftly' || historySort === 'lowest-leftly'
          ? (historySort === 'highest-leftly' ? right.snapshot.totals.leftover - left.snapshot.totals.leftover : left.snapshot.totals.leftover - right.snapshot.totals.leftover)
          : (() => {
              const leftDate = Date.parse(left.snapshot.archivedAt)
              const rightDate = Date.parse(right.snapshot.archivedAt)
              const safeLeft = Number.isFinite(leftDate) ? leftDate : historySort === 'newest' ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY
              const safeRight = Number.isFinite(rightDate) ? rightDate : historySort === 'newest' ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY
              const dateComparison = safeLeft - safeRight
              return historySort === 'newest' ? -dateComparison : dateComparison
            })()
        return comparison || left.index - right.index
      })
      .map(({ snapshot }) => snapshot)
  }, [historySort, searchQuery, snapshots])

  const activitySearch = useMemo(() => searchHistoryActivity(snapshots, searchQuery), [searchQuery, snapshots])

  if (selectedSnapshot) {
    const billItems = selectedSnapshot.bills
    const expenseItems = selectedSnapshot.expenses
    const carriedOverSummary = getSnapshotCarriedOverSummary(billItems)
    const topExpenseCategories = getSnapshotTopExpenseCategories(expenseItems)
    const snapshotCategories = Array.from(new Set([...billItems.map((bill) => bill.category), ...expenseItems.map((expense) => expense.category), ...Object.keys(selectedSnapshot.categoryTargets)]))
    const snapshotTargetProgress = calculateCategoryTargetProgress(selectedSnapshot.categoryTargets, expenseItems, snapshotCategories)
    const rolloverAmount = typeof selectedSnapshot.rolloverAmount === 'number' && selectedSnapshot.rolloverAmount > 0 ? selectedSnapshot.rolloverAmount : 0
    const rolloverApplied = typeof selectedSnapshot.rolloverApplied === 'boolean' ? selectedSnapshot.rolloverApplied : null
    const visibleExpenses = showAllExpenses || expenseItems.length <= 5 ? expenseItems : expenseItems.slice(0, 5)
    const finalLeftlyStatus = getSnapshotLeftlyStatus(selectedSnapshot.totals.leftover)

    return (
    <div className="grid gap-3 sm:gap-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 sm:text-sm">Archived pay period</p>
            <h3 className="mt-1 text-lg font-semibold text-white sm:text-xl">{selectedSnapshot.label}</h3>
            <p className="mt-1 text-xs leading-5 text-slate-400 sm:text-sm">
              Archived {formatArchivedDate(selectedSnapshot.archivedAt)} · {selectedSnapshot.cadence}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] sm:mt-3 sm:gap-2 sm:text-[11px]">
              <Badge muted>{selectedSnapshot.cadence}</Badge>
              {rolloverAmount > 0 ? <Badge success>Rollover {formatCurrency(rolloverAmount)}</Badge> : null}
              {rolloverApplied !== null ? <Badge muted>{rolloverApplied ? 'Rollover applied' : 'Rollover not applied'}</Badge> : null}
              {carriedOverSummary.count > 0 ? <Badge muted>{carriedOverSummary.count} carried over</Badge> : null}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <button type="button" onClick={() => onUseAsStartingPoint(selectedSnapshot)} className="button-primary w-full sm:w-auto">
              Use as starting point
            </button>
            <button type="button" onClick={() => onExportSnapshotCsv(selectedSnapshot)} className="button-secondary w-full sm:w-auto">
              Export CSV
            </button>
            <button type="button" onClick={onBackToList} className="button-secondary w-full sm:w-auto">
              Back
            </button>
            <button
              type="button"
              onClick={() => onDeleteSnapshot(selectedSnapshot.id)}
              className="button-danger sm:w-auto"
            >
              Delete snapshot
            </button>
          </div>
        </div>

        <div className="leftly-shell-accent grid gap-3 p-3 sm:p-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100/70">Final Leftly</p>
              <p className={`mt-1 text-2xl font-semibold tracking-[-0.04em] sm:text-3xl ${selectedSnapshot.totals.leftover < 0 ? 'text-rose-200' : 'text-cyan-50'}`}>
                {formatCurrency(selectedSnapshot.totals.leftover)}
              </p>
              <p className="mt-1 text-sm text-slate-300">{finalLeftlyStatus}</p>
            </div>
            <div className="text-right text-xs leading-5 text-slate-400 sm:text-sm">
              <p>{selectedSnapshot.label}</p>
              <p>Archived {formatArchivedDate(selectedSnapshot.archivedAt)} · {selectedSnapshot.cadence}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <MiniStat label="Starting income" value={formatCurrency(getSnapshotStartingIncome(selectedSnapshot))} dense />
            <MiniStat label="Total bills" value={formatCurrency(selectedSnapshot.totals.totalBills)} dense />
            <MiniStat label="Paid bills" value={formatCurrency(selectedSnapshot.totals.paidBills)} dense />
            <MiniStat label="Unpaid bills" value={formatCurrency(selectedSnapshot.totals.unpaidBills)} dense />
            <MiniStat label="Total expenses" value={formatCurrency(selectedSnapshot.totals.totalExpenses)} dense />
          </div>
        </div>

        {rolloverAmount > 0 || carriedOverSummary.count > 0 ? (
          <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
            {rolloverAmount > 0 ? (
              <div className="leftly-shell p-3 sm:p-4">
                <p className="text-sm font-semibold text-white">Rollover</p>
                <p className="mt-2 text-base font-semibold text-slate-100 sm:text-lg">{formatCurrency(rolloverAmount)}</p>
                <p className="mt-1 text-xs leading-5 text-slate-400">
                  {rolloverApplied !== null ? (rolloverApplied ? 'Applied to the next pay period.' : 'Not applied to the next pay period.') : 'Rollover metadata available.'}
                </p>
              </div>
            ) : null}
            {carriedOverSummary.count > 0 ? (
              <div className="leftly-shell p-3 sm:p-4">
                <p className="text-sm font-semibold text-white">Carried over bills</p>
                <p className="mt-2 text-base font-semibold text-slate-100 sm:text-lg">
                  {carriedOverSummary.count} unpaid bill{carriedOverSummary.count === 1 ? '' : 's'} · {formatCurrency(carriedOverSummary.amount)}
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-400">These were moved forward from the previous pay period.</p>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="grid gap-3 xl:grid-cols-2">
          <div className="leftly-shell p-3 sm:p-4">
            <p className="text-sm font-semibold text-white">Bills</p>
            <div className="mt-3 grid gap-2">
              {billItems.length > 0 ? (
                billItems.map((bill) => (
                  <div
                    key={bill.id}
                    className={`flex flex-col gap-2 rounded-2xl border p-2.5 sm:flex-row sm:items-center sm:justify-between sm:p-3 ${
                      bill.isPaid ? 'border-slate-800/70 bg-slate-950/60' : 'border-rose-500/25 bg-rose-500/8'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-medium text-white">{bill.name}</p>
                        {bill.source === 'recurring' ? <Badge muted>Bill Plan</Badge> : null}
                        {bill.carriedOverFromPayPeriodId ? <Badge muted>Carried over</Badge> : null}
                        {bill.isPaid ? <Badge success>Paid</Badge> : <Badge muted>Unpaid</Badge>}
                      </div>
                      <p className="mt-1 text-[11px] leading-5 text-slate-400 sm:text-xs">
                        {bill.category} · Due {formatDateLabel(bill.dueDate)}
                        {bill.source === 'recurring' ? ' · generated from Bill Plan' : ''}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-white sm:text-base">{formatCurrency(bill.amount)}</p>
                  </div>
                ))
              ) : (
                <EmptyState title="No bills in this period" text="This archived pay period did not include any bills." compact />
              )}
            </div>
          </div>

          <div className="leftly-shell p-3 sm:p-4">
            <p className="text-sm font-semibold text-white">Expenses</p>
            <div className="mt-3 grid gap-2">
              {expenseItems.length > 0 ? (
                visibleExpenses.map((expense) => (
                  <div
                    key={expense.id}
                    className="flex flex-col gap-2 leftly-shell-soft p-2.5 sm:flex-row sm:items-center sm:justify-between sm:p-3"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-medium text-white">{expense.name}</p>
                        {expense.source === 'recurring' ? (
                          <Badge muted>{expense.setAsideForTemplateId ? 'Set-aside' : expense.isPlanned ? 'Planned spending' : 'Bill Plan'}</Badge>
                        ) : null}
                      </div>
                      <p className="mt-1 text-[11px] leading-5 text-slate-400 sm:text-xs">
                        {expense.category} · {formatDateLabel(expense.date)}
                        {expense.setAsideForTemplateId ? ' · reserves money before the bill is due' : ''}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-white sm:text-base">{formatCurrency(expense.amount)}</p>
                  </div>
                ))
              ) : (
                <EmptyState title="No expenses in this period" text="This archived pay period did not include any expenses." compact />
              )}
            </div>
            {expenseItems.length > 5 ? (
              <button
                type="button"
                onClick={() => setShowAllExpenses((current) => !current)}
                className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-slate-700 hover:bg-slate-900"
              >
                {showAllExpenses ? 'Show less expenses' : `Show more expenses (+${expenseItems.length - 5})`}
              </button>
            ) : null}
          </div>
        </div>

        <div className="leftly-shell p-3 sm:p-4">
          <p className="text-sm font-semibold text-white">Top spending categories</p>
          {topExpenseCategories.length > 0 ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {topExpenseCategories.map((summary) => (
                <div key={summary.category} className="leftly-shell-soft px-3 py-2.5">
                  <p className="text-sm font-medium text-white">{summary.category}</p>
                  <p className="mt-1 text-[11px] leading-5 text-slate-400 sm:text-xs">
                    {formatCurrency(summary.total)} · {summary.count} item{summary.count === 1 ? '' : 's'}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm leading-6 text-slate-400">No spending categories for this archived pay period.</p>
          )}
        </div>

        {snapshotTargetProgress.length > 0 ? (
          <div className="leftly-shell p-3 sm:p-4">
            <p className="text-sm font-semibold text-white">Category target results</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {snapshotTargetProgress.map((progress) => (
                <TargetProgressCard key={progress.category} progress={progress} formatCurrency={formatCurrency} compact />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className="grid gap-4">
      {snapshots.length > 0 ? (
        <div className="grid gap-3 rounded-2xl border border-slate-800/70 bg-slate-950/40 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:p-4">
          <label className="leftly-field">
            <span>Search History</span>
            <span className="leftly-input-shell"><input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Walmart, Food, June, biweekly…" /></span>
          </label>
          <label className="leftly-field sm:min-w-56">
            <span>Sort history</span>
            <span className="leftly-input-shell">
              <select value={historySort} onChange={(event) => setHistorySort(event.target.value as HistorySort)}>
                <option value="newest">Newest archived first</option>
                <option value="oldest">Oldest archived first</option>
                <option value="highest-leftly">Highest Final Leftly</option>
                <option value="lowest-leftly">Lowest Final Leftly</option>
              </select>
            </span>
          </label>
        </div>
      ) : null}
      {activitySearch.results.length > 0 ? (
        <section className="grid gap-2.5 sm:gap-3" aria-labelledby="matching-history-activity-title">
          <div>
            <h3 id="matching-history-activity-title" className="text-base font-semibold text-white">Matching activity</h3>
            <p className="mt-1 text-sm leading-6 text-slate-400">Archived bills and expenses matching your search.</p>
          </div>
          {activitySearch.results.map((result) => (
            <button
              key={result.key}
              type="button"
              onClick={() => onSelectSnapshot(result.snapshotId)}
              aria-label={`Open archived period ${result.snapshotLabel} for ${result.kind} ${result.name}`}
              className="leftly-shell grid min-h-11 gap-2 p-3 text-left transition hover:border-slate-700 focus:outline-none focus:ring-4 focus:ring-cyan-400/20 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-4"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="min-w-0 break-words text-sm font-semibold text-white sm:text-base">{result.name}</p>
                  <span className="text-xs font-medium text-slate-300">{result.kind === 'bill' ? 'Bill' : 'Expense'}</span>
                </div>
                <p className="mt-1 break-words text-xs leading-5 text-slate-400 sm:text-sm">{result.category} · {result.date ?? 'Date unavailable'} · {result.snapshotLabel}</p>
                {result.context.length > 0 ? <p className="mt-1 break-words text-xs leading-5 text-slate-400">{result.context.join(' · ')}</p> : null}
              </div>
              <span className="shrink-0 text-sm font-semibold text-white sm:text-base">{formatCurrency(result.amount)}</span>
            </button>
          ))}
          {activitySearch.isLimited ? <p className="text-sm leading-6 text-slate-400">Showing the first 50 matching activity results. Refine your search to see fewer results.</p> : null}
        </section>
      ) : null}
      {snapshots.length > 0 && filteredSnapshots.length === 0 && activitySearch.results.length === 0 ? (
        <EmptyState title="No archived periods match" text="Try a different search term or clear the search field." />
      ) : snapshots.length > 0 ? (
        <div className="grid gap-2.5 sm:gap-3">
          {filteredSnapshots.map((snapshot) => (
            <article key={snapshot.id} className="leftly-shell p-3 sm:p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <button type="button" onClick={() => onSelectSnapshot(snapshot.id)} aria-label={`Open details for ${snapshot.label}`} className="min-w-0 flex-1 rounded-xl text-left focus:outline-none focus:ring-4 focus:ring-cyan-400/20">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                    <h3 className="min-w-0 text-sm font-semibold text-white sm:text-base">{snapshot.label}</h3>
                    <Badge muted>{snapshot.cadence}</Badge>
                    {snapshot.rolloverAmount && snapshot.rolloverAmount > 0 ? (
                      <Badge success>
                        Rollover {formatCurrency(snapshot.rolloverAmount)}
                        {snapshot.rolloverApplied === false ? ' not applied' : ''}
                      </Badge>
                    ) : null}
                    {getSnapshotCarriedOverSummary(snapshot.bills).count > 0 ? <Badge muted>{getSnapshotCarriedOverSummary(snapshot.bills).count} carried over</Badge> : null}
                  </div>
                  <p className="mt-1 text-[11px] leading-5 text-slate-400 sm:text-sm">Archived {formatArchivedDate(snapshot.archivedAt)} · {formatDateRangeLabel(snapshot.startDate, snapshot.endDate)}</p>
                  <div className="mt-3 flex items-end justify-between gap-3 border-t border-slate-800/70 pt-3">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Final Leftly</span>
                    <span className={`text-right text-base font-semibold sm:text-lg ${snapshot.totals.leftover < 0 ? 'text-rose-200' : 'text-cyan-50'}`}>
                      {formatCurrency(snapshot.totals.leftover)}
                      <span className="mt-0.5 block text-[11px] font-medium text-slate-400">{getSnapshotLeftlyStatus(snapshot.totals.leftover)}</span>
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => onDeleteSnapshot(snapshot.id)}
                  className="button-danger sm:self-start"
                >
                  Delete
                </button>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-slate-800/70 pt-3 sm:grid-cols-4">
                <MiniStat label="Starting income" value={formatCurrency(getSnapshotStartingIncome(snapshot))} dense />
                <MiniStat label="Total bills" value={formatCurrency(snapshot.totals.totalBills)} dense />
                <MiniStat label="Total expenses" value={formatCurrency(snapshot.totals.totalExpenses)} dense />
                <MiniStat label="Paid / unpaid" value={`${formatCurrency(snapshot.totals.paidBills)} paid · ${formatCurrency(snapshot.totals.unpaidBills)} unpaid`} dense />
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState title="No paycheck history yet" text="Start your next paycheck and Leftly will save the current one here." />
      )}
    </div>
  )
}

export function HistoryInsightsSummaryCard({
  insights,
  formatCurrency,
  onViewInsights,
}: {
  insights: PayPeriodInsights
  formatCurrency: (value: number) => string
  onViewInsights: () => void
}) {
  return (
    <section className="leftly-overview-section mb-5" aria-label="Pay period insights summary">
      <OverviewSectionHeader
        title="Pay period insights"
        description="Descriptive summaries from archived pay periods. The active period is not included."
        aside={<Badge muted>{insights.availableSnapshots} analyzed · {insights.totalArchivedSnapshots} archived</Badge>}
      />
      {insights.availableSnapshots === 0 ? (
        <EmptyState title="Insights will appear after archiving a pay period" text="Start a new pay period to save the current period in History, then review its recorded income, bills, spending, and leftover." compact />
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="min-w-0">
            <p className="text-xs text-slate-400">Selected range: {insights.rangeLabel}</p>
            <p className="mt-1 text-xs text-slate-500">Based on {insights.selectedCount} archived pay period{insights.selectedCount === 1 ? '' : 's'}.</p>
            {insights.excludedSnapshotCount > 0 ? <p className="mt-1 text-xs leading-5 text-slate-500">{insights.excludedSnapshotCount} archived record{insights.excludedSnapshotCount === 1 ? '' : 's'} excluded because required dates or amounts were unavailable.</p> : null}
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <MiniStat label="Average leftover" value={formatCurrency(insights.averages.leftover)} dense />
              <MiniStat label="Average income" value={formatCurrency(insights.averages.income)} dense />
              <MiniStat label="Average bills" value={formatCurrency(insights.averages.bills)} dense />
              <MiniStat label="Average spending excluding set-asides" value={formatCurrency(insights.averages.spendingExcludingSetAsides)} dense />
            </div>
            {insights.selectedCount === 1 ? <p className="mt-3 text-xs leading-5 text-slate-400">This is a descriptive summary. Comparisons require at least two archived periods.</p> : null}
          </div>
          <button type="button" className="button-secondary w-full sm:w-auto" onClick={onViewInsights} aria-label="View pay period insights details">View insights</button>
        </div>
      )}
    </section>
  )
}

export function PayPeriodInsightsPanel({
  insights,
  onRangeChange,
  formatCurrency,
}: {
  insights: PayPeriodInsights
  onRangeChange: (range: InsightRange) => void
  formatCurrency: (value: number) => string
}) {
  if (insights.availableSnapshots === 0 || insights.selectedCount === 0) {
    return <EmptyState title="No insights available" text="Insights use archived pay periods only. Archive a pay period to begin building this descriptive history." />
  }

  const followThroughRows: Array<[string, InsightBillMeasure]> = [
    ['Paid on or before due date', insights.billFollowThrough.paidOnOrBeforeDue],
    ['Paid after due date', insights.billFollowThrough.paidAfterDue],
    ['Paid date unavailable', insights.billFollowThrough.paidDateUnavailable],
    ['Timing date unavailable', insights.billFollowThrough.timingDateUnavailable],
    ['Unpaid at archive', insights.billFollowThrough.unpaidAtArchive],
    ['Carried over', insights.billFollowThrough.carriedOver],
  ]

  return (
    <div className="grid gap-5">
      <div className="leftly-shell-soft grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:p-5">
        <div>
          <label className="leftly-field sm:max-w-xs">
            <span>Temporary range</span>
            <span className="leftly-input-shell">
              <select value={insights.range} onChange={(event) => onRangeChange(event.target.value === 'all' ? 'all' : Number(event.target.value) as InsightRange)}>
                <option value="3">Last 3 archived periods</option>
                <option value="6">Last 6 archived periods</option>
                <option value="12">Last 12 archived periods</option>
                <option value="all">All archived periods</option>
              </select>
            </span>
          </label>
          <p className="mt-2 text-sm leading-6 text-slate-400">Analyzing {insights.selectedCount} archived pay period{insights.selectedCount === 1 ? '' : 's'}: {insights.rangeLabel}.</p>
          {insights.excludedSnapshotCount > 0 ? <p className="mt-1 text-xs leading-5 text-amber-100/80">{insights.excludedSnapshotCount} archived record{insights.excludedSnapshotCount === 1 ? '' : 's'} excluded because required dates or amounts were unavailable.</p> : null}
        </div>
        <Badge muted>{insights.state === 'single' ? 'Descriptive summary' : insights.state === 'comparison' ? 'Two-period comparison' : 'Range summary'}</Badge>
      </div>

      <section aria-labelledby="insights-summary-title">
        <h3 id="insights-summary-title" className="text-base font-semibold text-white">Summary averages</h3>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <MiniStat label="Average income" value={formatCurrency(insights.averages.income)} dense />
          <MiniStat label="Average bills" value={formatCurrency(insights.averages.bills)} dense />
          <MiniStat label="Average spending excluding set-asides" value={formatCurrency(insights.averages.spendingExcludingSetAsides)} dense />
          <MiniStat label="Average set-asides" value={formatCurrency(insights.averages.setAsides)} dense />
          <MiniStat label="Average leftover" value={formatCurrency(insights.averages.leftover)} dense />
        </div>
        <p className="mt-3 text-xs leading-5 text-slate-400">Totals across selected periods: income {formatCurrency(insights.totals.income)}, bills {formatCurrency(insights.totals.bills)}, spending {formatCurrency(insights.totals.spendingExcludingSetAsides)}, set-asides {formatCurrency(insights.totals.setAsides)}, leftover {formatCurrency(insights.totals.leftover)}.</p>
      </section>

      {insights.comparison ? (
        <section aria-labelledby="insights-comparison-title">
          <h3 id="insights-comparison-title" className="text-base font-semibold text-white">Latest versus previous</h3>
          <p className="mt-1 text-sm leading-6 text-slate-400">{insights.comparison.periodsLabel}</p>
          <div className="mt-3 grid gap-2">
            {([
              ['Income', insights.comparison.metrics.income],
              ['Bills', insights.comparison.metrics.bills],
              ['Spending excluding set-asides', insights.comparison.metrics.spendingExcludingSetAsides],
              ['Set-asides', insights.comparison.metrics.setAsides],
              ['Leftover', insights.comparison.metrics.leftover],
            ] as Array<[string, InsightComparison]>).map(([label, metric]) => <InsightComparisonRow key={label} label={label} metric={metric} formatCurrency={formatCurrency} />)}
          </div>
        </section>
      ) : <EmptyState title="Comparison not available" text="At least two valid archived pay periods are needed for a direct comparison." compact />}

      <section aria-labelledby="insights-categories-title">
        <h3 id="insights-categories-title" className="text-base font-semibold text-white">Category spending</h3>
        <p className="mt-1 text-sm leading-6 text-slate-400">Archived expenses excluding set-asides, sorted by total across the selected range.</p>
        {insights.categories.length > 0 ? <div className="mt-3 grid gap-2">{insights.categories.map((category) => <div key={category.category} className="leftly-shell-soft p-3"><div className="flex items-start justify-between gap-3"><p className="min-w-0 break-words text-sm font-semibold text-white">{category.category}</p><p className="shrink-0 text-sm font-semibold text-white">{formatCurrency(category.total)}</p></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800" role="progressbar" aria-label={`${category.category}: ${formatCurrency(category.total)} across selected periods`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(category.share * 100)}><div className="h-full rounded-full bg-cyan-400/70" style={{ width: `${Math.min(100, category.share * 100)}%` }} /></div><p className="mt-2 text-xs leading-5 text-slate-400">{formatCurrency(category.average)} average per period · {(category.share * 100).toFixed(1)}% of selected spending · {category.count} entr{category.count === 1 ? 'y' : 'ies'}</p></div>)}</div> : <p className="mt-2 text-sm leading-6 text-slate-400">No non-set-aside expenses were recorded in the selected periods.</p>}
      </section>

      <section aria-labelledby="insights-bills-title">
        <h3 id="insights-bills-title" className="text-base font-semibold text-white">Bill follow-through</h3>
        <p className="mt-1 text-sm leading-6 text-slate-400">Recorded bill statuses across the selected archived periods. Carried over is counted separately.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">{followThroughRows.map(([label, measure]) => <div key={label} className="leftly-shell-soft flex items-center justify-between gap-3 p-3"><span className="min-w-0 break-words text-sm text-slate-300">{label}</span><span className="shrink-0 text-right text-sm font-semibold text-white">{measure.count} · {formatCurrency(measure.amount)}</span></div>)}</div>
      </section>

      <section aria-labelledby="insights-patterns-title">
        <h3 id="insights-patterns-title" className="text-base font-semibold text-white">Repeated bill-attention patterns</h3>
        {insights.repeatedBillAttention.length > 0 ? <div className="mt-3 grid gap-2">{insights.repeatedBillAttention.map((pattern) => <div key={pattern.label} className="leftly-shell-soft p-3"><p className="break-words text-sm font-semibold text-white">{pattern.label}</p><p className="mt-1 text-xs leading-5 text-slate-400">Repeated attention · appeared in {pattern.appearances} periods · {pattern.latePaid} late payment{pattern.latePaid === 1 ? '' : 's'} · {pattern.unpaidAtArchive} unpaid at archive · {pattern.carriedOver} carryover{pattern.carriedOver === 1 ? '' : 's'}</p></div>)}</div> : <p className="mt-2 text-sm leading-6 text-slate-400">No repeated bill-attention pattern appears in the selected history.</p>}
      </section>

      <section className="leftly-shell-soft p-4" aria-labelledby="insights-methodology-title">
        <h3 id="insights-methodology-title" className="text-base font-semibold text-white">Methodology and definitions</h3>
        <ul className="mt-2 grid gap-1 text-sm leading-6 text-slate-400">
          <li>Insights use archived pay periods only; the active period is not included in averages.</li>
          <li>Spending excludes set-asides. Bills and spending are separate measures.</li>
          <li>A late payment requires a recorded paid date after the due date. Paid bills without a paid date are not classified as on-time or late.</li>
          <li>A paid bill with an unavailable due date is shown separately as timing date unavailable.</li>
          <li>Carryover is counted separately, and results describe recorded history only.</li>
          <li>These insights are not financial advice or a guarantee about future periods.</li>
        </ul>
      </section>
    </div>
  )
}

export function InsightComparisonRow({
  label,
  metric,
  formatCurrency,
}: {
  label: string
  metric: InsightComparison
  formatCurrency: (value: number) => string
}) {
  return <div className="leftly-shell-soft grid gap-2 p-3 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] sm:items-center"><p className="min-w-0 break-words text-sm font-semibold text-white">{label}</p><span className="text-xs text-slate-400">Latest {formatCurrency(metric.latest)}</span><span className="text-xs text-slate-400">Previous {formatCurrency(metric.previous)}</span><span className="text-xs font-semibold text-slate-200">{metric.direction === 'unchanged' ? 'Unchanged' : `${metric.direction === 'up' ? 'Up' : 'Down'} ${formatCurrency(Math.abs(metric.difference))}`}</span></div>
}
