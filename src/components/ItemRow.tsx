import type { ReactNode } from 'react'

// One slim list row: tap anywhere on the main part to open/edit the item.
// Optional status chip and one optional quick action (e.g. "mark paid") on the right.

export type ItemRowTone = 'default' | 'success' | 'warning' | 'muted'

export function ItemRow({
  title,
  subtitle,
  amount,
  status,
  statusTone = 'muted',
  dimmed = false,
  onOpen,
  openLabel,
  quickAction,
}: {
  title: string
  subtitle?: ReactNode
  amount: string
  status?: string
  statusTone?: ItemRowTone
  dimmed?: boolean
  onOpen: () => void
  openLabel: string
  quickAction?: ReactNode
}) {
  return (
    <div className={`leftly-item-row ${dimmed ? 'leftly-item-row-dimmed' : ''}`}>
      <button type="button" onClick={onOpen} className="leftly-item-row-main" aria-label={openLabel}>
        <span className="min-w-0 flex-1 text-left">
          <span className="block truncate text-sm font-semibold text-white">{title}</span>
          {subtitle ? <span className="mt-0.5 block truncate text-xs leading-5 text-slate-400">{subtitle}</span> : null}
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-sm font-semibold text-white">{amount}</span>
          {status ? <span className={`leftly-item-row-status leftly-item-row-status-${statusTone}`}>{status}</span> : null}
        </span>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 text-slate-500">
          <path d="m9 6 6 6-6 6" />
        </svg>
      </button>
      {quickAction ? <div className="flex shrink-0 items-center pr-2">{quickAction}</div> : null}
    </div>
  )
}

// Round check button used as the quick "paid" toggle on bill rows.
export function PaidToggle({ isPaid, name, onToggle }: { isPaid: boolean; name: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={isPaid}
      aria-label={isPaid ? `Mark ${name} unpaid` : `Mark ${name} paid`}
      className={`leftly-paid-toggle ${isPaid ? 'leftly-paid-toggle-on' : ''}`}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m5 12.5 4.5 4.5L19 7.5" />
      </svg>
    </button>
  )
}
