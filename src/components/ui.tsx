// Shared building blocks: section shells, form fields, badges and messages.
import type { ReactNode } from 'react'

export function SectionShell({
  title,
  description,
  compact = false,
  children,
}: {
  title: string
  description: string
  compact?: boolean
  children: ReactNode
}) {
  if (compact) {
    return <div className="leftly-shell overflow-hidden p-3 sm:p-4">{children}</div>
  }

  return (
    <div className="leftly-shell overflow-hidden">
      <div className="border-b border-slate-800/70 px-4 py-4 sm:px-5 sm:py-5">
        <h2 className="leftly-section-title">{title}</h2>
        <p className="leftly-section-helper">{description}</p>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </div>
  )
}

export function MoreBackBar({ onBack }: { onBack: () => void }) {
  return (
    <div className="mb-4 flex">
      <button type="button" onClick={onBack} className="button-secondary w-full sm:w-auto">
        Back to More
      </button>
    </div>
  )
}

export function TabButton({
  label,
  active,
  disabled = false,
  onClick,
}: {
  label: string
  active: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`shrink-0 rounded-full border px-4 py-2.5 text-sm font-semibold tracking-[0.01em] transition disabled:cursor-not-allowed disabled:opacity-50 ${
        active
          ? 'border-cyan-400/30 bg-cyan-400/10 text-cyan-100 shadow-[0_0_0_1px_rgba(34,211,238,0.15)]'
          : 'border-slate-700/80 bg-slate-900/70 text-slate-300 hover:border-slate-600 hover:text-white'
      }`}
    >
      {label}
    </button>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="leftly-field">
      <span>{label}</span>
      <span className="leftly-input-shell">
        {children}
      </span>
    </label>
  )
}

export function FormMessage({ children }: { children: string }) {
  return (
    <p className="leftly-banner-warning" role="alert">
      {children}
    </p>
  )
}

export function SuccessMessage({ children }: { children: string }) {
  return (
    <p className="leftly-banner-success" role="status">
      {children}
    </p>
  )
}

export function EmptyState({
  title,
  text,
  compact = false,
}: {
  title: string
  text: string
  compact?: boolean
}) {
  return (
    <div className={`leftly-empty ${compact ? 'leftly-empty-compact' : ''}`}>
      <p className="text-sm font-medium text-white">{title}</p>
      <p className={`mt-1 text-sm leading-6 text-slate-400 ${compact ? 'max-w-md' : ''}`}>{text}</p>
    </div>
  )
}

export function Badge({
  children,
  muted = false,
  success = false,
}: {
  children: ReactNode
  muted?: boolean
  success?: boolean
}) {
  const className = success ? 'leftly-chip-success' : muted ? 'leftly-chip-muted' : 'leftly-chip-default'

  return <span className={`leftly-chip px-3 py-1 text-xs font-medium ${className}`}>{children}</span>
}

export function MiniStat({
  label,
  value,
  detail,
  tone = 'default',
  dense = false,
}: {
  label: string
  value: string
  detail?: string
  tone?: 'default' | 'highlight'
  dense?: boolean
}) {
  return (
    <div
      className={`leftly-shell-soft px-3 ${dense ? 'py-2.5' : 'py-3 sm:py-3.5'} ${tone === 'highlight' ? 'leftly-shell-accent' : ''}`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 sm:text-xs">{label}</p>
      <p className={`mt-2 ${dense ? 'text-sm sm:text-[0.96rem]' : 'text-base sm:text-lg'} font-semibold tracking-[-0.02em] leading-tight ${tone === 'highlight' ? 'text-cyan-50' : 'text-white'}`}>{value}</p>
      {detail ? <p className={`mt-1 text-[11px] leading-5 text-slate-400 ${dense ? 'sm:text-[11px]' : 'sm:text-xs'}`}>{detail}</p> : null}
    </div>
  )
}

export function MiniTargetStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-1 truncate text-xs font-semibold text-white">{value}</p>
    </div>
  )
}
