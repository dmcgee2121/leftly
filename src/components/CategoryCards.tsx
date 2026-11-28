// Category screen cards and target progress.
import {
  type Bill,
  type Expense,
} from '../types/budget'
import { useId } from 'react'
import { formatDateLabel } from '../lib/dateLabels'
import type { CategoryTargetProgress, CategorySummary } from '../types/app'
import { MiniTargetStat, Field, EmptyState } from './ui'
import { ItemRow, PaidToggle } from './ItemRow'

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
  targetError,
  expanded,
  onToggle,
  onMoveUp,
  onMoveDown,
  onStartEditingTarget,
  onTargetDraftChange,
  onSaveTarget,
  onRemoveTarget,
  onCancelTargetEdit,
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
  targetError: string
  expanded: boolean
  onToggle: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onStartEditingTarget: () => void
  onTargetDraftChange: (value: string) => void
  onSaveTarget: () => void
  onRemoveTarget: () => void
  onCancelTargetEdit: () => void
  onToggleBillPaid: (id: string) => void
  onEditBill: (bill: Bill) => void
  onEditExpense: (expense: Expense) => void
  formatCurrency: (value: number) => string
  canMoveUp: boolean
  canMoveDown: boolean
}) {
  const detailsId = useId()
  const itemCount = summary.items.length
  const subtitleParts = [itemCount === 0 ? 'No items' : `${itemCount} item${itemCount === 1 ? '' : 's'}`]
  if (targetProgress) {
    subtitleParts.push(`${targetProgress.status} · ${formatCurrency(targetProgress.target)} target`)
  }
  const barClass =
    targetProgress?.status === 'Over target'
      ? 'bg-rose-400'
      : targetProgress?.status === 'Getting close'
        ? 'bg-amber-300'
        : 'bg-gradient-to-r from-cyan-400 to-emerald-400'

  return (
    <article className={`leftly-category-row ${expanded ? 'leftly-category-row-open' : ''}`}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={detailsId}
        className="leftly-category-row-header"
      >
        <span className="min-w-0 flex-1 text-left">
          <span className="block truncate text-sm font-semibold text-white">{summary.category}</span>
          <span className="mt-0.5 block truncate text-xs leading-5 text-slate-400">{subtitleParts.join(' · ')}</span>
        </span>
        <span className="shrink-0 text-sm font-semibold text-white">{formatCurrency(summary.total)}</span>
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={`shrink-0 text-slate-500 transition-transform ${expanded ? 'rotate-90' : ''}`}
        >
          <path d="m9 6 6 6-6 6" />
        </svg>
      </button>

      {targetProgress ? (
        <div
          className="mx-3.5 mb-3 h-1.5 overflow-hidden rounded-full bg-slate-800/80"
          role="progressbar"
          aria-label={`${summary.category} target progress: ${targetProgress.status}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(targetProgress.progressValue)}
        >
          <div className={`h-full rounded-full ${barClass}`} style={{ width: `${targetProgress.progressValue}%` }} />
        </div>
      ) : null}

      {expanded ? (
        <div id={detailsId} className="grid gap-3 border-t border-slate-800/70 p-3">
          {targetProgress ? <TargetProgressCard progress={targetProgress} formatCurrency={formatCurrency} compact /> : null}

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
              {targetError ? (
                <p className="leftly-banner-danger sm:col-span-3" role="alert">
                  {targetError}
                </p>
              ) : null}
            </div>
          ) : null}

          {itemCount === 0 ? (
            <EmptyState title="Nothing here yet" text="Add a bill or expense and it will appear in this category." compact />
          ) : (
            <div className="grid gap-2">
              {summary.items.map((item) => {
                const tag =
                  item.source === 'recurring'
                    ? item.setAsideForTemplateId
                      ? 'Set-aside'
                      : item.isPlanned
                        ? 'Planned'
                        : 'Bill Plan'
                    : item.kind === 'bill' && item.carriedOverFromPayPeriodId
                      ? 'Carried over'
                      : null
                if (item.kind === 'bill') {
                  const bill = item as Bill
                  return (
                    <ItemRow
                      key={item.id}
                      title={bill.name}
                      subtitle={`Bill · Due ${formatDateLabel(bill.dueDate)}${tag ? ` · ${tag}` : ''}`}
                      amount={formatCurrency(bill.amount)}
                      status={bill.isPaid ? (bill.paidDate ? `Paid ${formatDateLabel(bill.paidDate)}` : 'Paid') : 'Unpaid'}
                      statusTone={bill.isPaid ? 'success' : 'warning'}
                      onOpen={() => onEditBill(bill)}
                      openLabel={`Edit bill ${bill.name}`}
                      quickAction={<PaidToggle isPaid={bill.isPaid} name={bill.name} onToggle={() => onToggleBillPaid(bill.id)} />}
                    />
                  )
                }
                const expense = item as Expense
                return (
                  <ItemRow
                    key={item.id}
                    title={expense.name}
                    subtitle={`Expense · ${formatDateLabel(expense.date)}${tag ? ` · ${tag}` : ''}`}
                    amount={formatCurrency(expense.amount)}
                    onOpen={() => onEditExpense(expense)}
                    openLabel={`Edit expense ${expense.name}`}
                  />
                )
              })}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {!targetEditing ? (
              <button type="button" onClick={onStartEditingTarget} className="button-secondary flex-1 sm:flex-none">
                {targetProgress ? 'Edit target' : 'Set target'}
              </button>
            ) : null}
            {targetProgress && !targetEditing ? (
              <button type="button" onClick={onRemoveTarget} className="button-secondary flex-1 sm:flex-none">
                Remove target
              </button>
            ) : null}
            <div className="ml-auto flex gap-2">
              <button
                type="button"
                onClick={onMoveUp}
                disabled={!canMoveUp}
                aria-label={`Move ${summary.category} up`}
                className="leftly-icon-button"
              >
                ▲
              </button>
              <button
                type="button"
                onClick={onMoveDown}
                disabled={!canMoveDown}
                aria-label={`Move ${summary.category} down`}
                className="leftly-icon-button"
              >
                ▼
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </article>
  )
}
