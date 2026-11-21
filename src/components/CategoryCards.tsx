// Category screen cards and target progress.
import {
  type Bill,
  type Expense,
} from '../types/budget'
import { formatDateLabel } from '../lib/dateLabels'
import type { CategoryTargetProgress, CategorySummary } from '../types/app'
import { MiniTargetStat, Badge, Field, EmptyState } from './ui'

export function TargetProgressCard({
  progress,
  formatCurrency,
  compact = false,
}: {
  progress: CategoryTargetProgress
  formatCurrency: (value: number) => string
  compact?: boolean
}) {
  const overAmount = Math.max(0, -progress.remaining)
  const percentLabel = Number.isFinite(progress.percentUsed) ? `${progress.percentUsed.toFixed(0)}% used` : 'Over target'
  const toneClass =
    progress.status === 'Over target'
      ? 'border-rose-500/25 bg-rose-500/10'
      : progress.status === 'At target'
        ? 'border-emerald-400/25 bg-emerald-400/10'
        : progress.status === 'Getting close'
          ? 'border-amber-400/25 bg-amber-400/10'
          : 'border-slate-800/70 bg-slate-950/60'

  return (
    <div className={`rounded-2xl border p-3 ${toneClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{progress.category}</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            {progress.status} · {percentLabel}
          </p>
        </div>
        <p className="shrink-0 text-sm font-semibold text-white">{formatCurrency(progress.spent)}</p>
      </div>

      <div
        className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800/80"
        role="progressbar"
        aria-label={`${progress.category} target progress: ${progress.status}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress.progressValue)}
      >
        <div
          className={`h-full rounded-full ${
            progress.status === 'Over target'
              ? 'bg-rose-400'
              : progress.status === 'Getting close'
                ? 'bg-amber-300'
                : 'bg-gradient-to-r from-cyan-400 to-emerald-400'
          }`}
          style={{ width: `${progress.progressValue}%` }}
        />
      </div>

      <div className={`mt-3 grid gap-2 ${compact ? 'grid-cols-3' : 'grid-cols-1 sm:grid-cols-3'}`}>
        <MiniTargetStat label="Target" value={formatCurrency(progress.target)} />
        <MiniTargetStat label="Spent" value={formatCurrency(progress.spent)} />
        <MiniTargetStat
          label={progress.remaining < 0 ? 'Over' : 'Remaining'}
          value={progress.remaining < 0 ? formatCurrency(overAmount) : formatCurrency(progress.remaining)}
        />
      </div>
    </div>
  )
}

export function CategoryCard({
  summary,
  targetProgress,
  targetEditing,
  targetDraft,
  rank,
  expanded,
  onToggle,
  onMoveUp,
  onMoveDown,
  onStartEditingTarget,
  onTargetDraftChange,
  onSaveTarget,
  onRemoveTarget,
  onCancelTargetEdit,
  onDeleteBill,
  onDeleteExpense,
  onToggleBillPaid,
  onEditBill,
  onEditExpense,
  formatCurrency,
  canMoveUp,
  canMoveDown,
}: {
  summary: CategorySummary
  targetProgress: CategoryTargetProgress | null
  targetEditing: boolean
  targetDraft: string
  rank: number
  expanded: boolean
  onToggle: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onStartEditingTarget: () => void
  onTargetDraftChange: (value: string) => void
  onSaveTarget: () => void
  onRemoveTarget: () => void
  onCancelTargetEdit: () => void
  onDeleteBill: (id: string) => void
  onDeleteExpense: (id: string) => void
  onToggleBillPaid: (id: string) => void
  onEditBill: (bill: Bill) => void
  onEditExpense: (expense: Expense) => void
  formatCurrency: (value: number) => string
  canMoveUp: boolean
  canMoveDown: boolean
}) {
  const highlightClass =
    rank === 1
      ? 'border-emerald-400/30 bg-emerald-400/10'
      : rank <= 3
        ? 'border-cyan-400/25 bg-cyan-400/10'
        : 'border-slate-800/80 bg-slate-950/70'

  return (
    <article className={`leftly-shell-soft p-4 shadow-lg shadow-slate-950/20 ${highlightClass}`}>
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <button type="button" onClick={onToggle} className="min-w-0 flex-1 text-left">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-white">{summary.category}</h3>
              {rank <= 3 ? <Badge>{rank === 1 ? 'Highest cost' : `Top ${rank}`}</Badge> : null}
            </div>
            <p className="mt-1 text-sm text-slate-400">
              {summary.total > 0 ? formatCurrency(summary.total) : 'No spending yet'}
            </p>
          </button>

          <div className="flex shrink-0 flex-col items-end gap-2">
            <button
              type="button"
              onClick={onToggle}
              className="text-xs uppercase tracking-[0.22em] text-slate-500 transition hover:text-slate-300"
            >
              {expanded ? 'Collapse' : 'Expand'}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge muted>{summary.billCount} bill{summary.billCount === 1 ? '' : 's'}</Badge>
          <Badge muted>{summary.expenseCount} expense{summary.expenseCount === 1 ? '' : 's'}</Badge>
          {summary.manualExpenseCount > 0 ? <Badge muted>{summary.manualExpenseCount} manual</Badge> : null}
          {targetProgress ? <Badge muted>{targetProgress.status}</Badge> : null}
        </div>

        {targetProgress ? (
          <TargetProgressCard progress={targetProgress} formatCurrency={formatCurrency} />
        ) : null}

        {targetEditing ? (
          <div className="leftly-shell-faint grid gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
            <Field label="Category target">
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={targetDraft}
                onChange={(event) => onTargetDraftChange(event.target.value)}
                placeholder="250.00"
              />
            </Field>
            <button type="button" onClick={onSaveTarget} className="button-primary w-full self-end sm:w-auto">
              Save
            </button>
            <button type="button" onClick={onCancelTargetEdit} className="button-secondary w-full self-end sm:w-auto">
              Cancel
            </button>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={!canMoveUp}
            aria-label={`Move ${summary.category} up`}
            className="inline-flex h-10 flex-1 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/80 text-slate-200 transition hover:border-cyan-400/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none sm:w-10"
          >
            ▲
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={!canMoveDown}
            aria-label={`Move ${summary.category} down`}
            className="inline-flex h-10 flex-1 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/80 text-slate-200 transition hover:border-cyan-400/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none sm:w-10"
          >
            ▼
          </button>
          <div className="min-w-0 flex-1 text-right">
            <p className="text-lg font-semibold text-white">{formatCurrency(summary.total)}</p>
            <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Current total</p>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={onStartEditingTarget} className="button-secondary w-full sm:w-auto">
            {targetProgress ? 'Edit target' : 'Set target'}
          </button>
          {targetProgress ? (
            <button type="button" onClick={onRemoveTarget} className="button-secondary w-full sm:w-auto">
              Remove target
            </button>
          ) : null}
        </div>
      </div>

      {expanded ? (
        <div className="mt-4 space-y-2 border-t border-slate-800/70 pt-4">
          {summary.items.length === 0 ? (
            <EmptyState title="Nothing here yet" text="Add a bill or expense and it will appear in this category." compact />
          ) : (
            summary.items.map((item) => (
              <div
                key={item.id}
                className="leftly-shell-soft flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium text-white">{item.name}</p>
                    {item.source === 'recurring' ? (
                      <Badge muted={Boolean(item.setAsideForTemplateId)}>
                        {item.setAsideForTemplateId ? 'Set-aside' : item.isPlanned ? 'Planned spending' : 'Bill Plan'}
                      </Badge>
                    ) : null}
                    {item.kind === 'bill' && item.carriedOverFromPayPeriodId ? <Badge muted>Carried over</Badge> : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    <Badge muted>{item.kind}</Badge>
                    {item.kind === 'bill' ? <Badge muted>Due {formatDateLabel(item.dueDate)}</Badge> : <Badge muted>{formatDateLabel(item.date)}</Badge>}
                    {item.kind === 'bill' && item.paidDate ? <Badge success>Paid {formatDateLabel(item.paidDate)}</Badge> : null}
                  </div>
                  <p className="text-xs leading-5 text-slate-400">
                    {item.kind === 'bill'
                      ? item.isPaid
                        ? 'Marked paid in this pay period.'
                        : 'Open bill for this pay period.'
                      : item.source === 'recurring'
                        ? 'Recurring expense or set-aside.'
                        : 'Manual expense logged this pay period.'}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  {item.kind === 'bill' ? (
                    <label className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2 text-sm text-slate-300">
                      <input
                        type="checkbox"
                        checked={Boolean(item.isPaid)}
                        onChange={() => onToggleBillPaid(item.id)}
                        className="h-4 w-4 rounded border-slate-700 bg-slate-950 text-cyan-400 focus:ring-cyan-400"
                      />
                      Paid
                    </label>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => (item.kind === 'bill' ? onEditBill(item as Bill) : onEditExpense(item as Expense))}
                    className="button-secondary w-full sm:w-auto"
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    onClick={() => (item.kind === 'bill' ? onDeleteBill(item.id) : onDeleteExpense(item.id))}
                    className="button-secondary w-full sm:w-auto"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      ) : null}
    </article>
  )
}
