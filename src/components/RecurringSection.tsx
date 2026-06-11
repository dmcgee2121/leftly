import { useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { DEFAULT_CATEGORIES, type RecurringFrequency, type RecurringItemTemplate } from '../types/budget'

const buttonStyles = {
  primary:
    'inline-flex min-h-11 items-center justify-center rounded-xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-cyan-300 focus:outline-none focus:ring-4 focus:ring-cyan-400/20 active:translate-y-px',
  secondary:
    'inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3 text-sm font-semibold text-slate-100 shadow-sm transition hover:border-slate-700 hover:bg-slate-900 focus:outline-none focus:ring-4 focus:ring-cyan-400/10 active:translate-y-px',
  danger:
    'inline-flex min-h-11 items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-200 shadow-sm transition hover:bg-rose-500/15 focus:outline-none focus:ring-4 focus:ring-rose-400/10 active:translate-y-px',
}

type RecurringDraft = {
  name: string
  amount: string
  category: RecurringItemTemplate['category']
  kind: RecurringItemTemplate['kind']
  frequency: RecurringFrequency
  dueDay: string
  anchorDate: string
}

const frequencyLabels: Record<RecurringFrequency, string> = {
  'every-pay-period': 'Every pay period',
  weekly: 'Weekly',
  biweekly: 'Biweekly',
  monthly: 'Monthly',
  'one-time': 'One-time',
}

export function RecurringSection({
  templates,
  onAddTemplate,
  onUpdateTemplate,
  onDeleteTemplate,
}: {
  templates: RecurringItemTemplate[]
  onAddTemplate: (template: RecurringItemTemplate) => void
  onUpdateTemplate: (template: RecurringItemTemplate) => void
  onDeleteTemplate: (id: string) => void
}) {
  const [draft, setDraft] = useState<RecurringDraft>({
    name: '',
    amount: '',
    category: 'Other / Misc',
    kind: 'bill',
    frequency: 'every-pay-period',
    dueDay: '',
    anchorDate: '',
  })
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const sortedTemplates = useMemo(
    () => [...templates].sort((a, b) => Number(b.isActive) - Number(a.isActive) || b.createdAt.localeCompare(a.createdAt)),
    [templates],
  )

  function resetForm() {
    setEditingTemplateId(null)
    setDraft({
      name: '',
      amount: '',
      category: 'Other / Misc',
      kind: 'bill',
      frequency: 'every-pay-period',
      dueDay: '',
      anchorDate: '',
    })
    setError('')
  }

  function startEdit(template: RecurringItemTemplate) {
    setEditingTemplateId(template.id)
    setDraft({
      name: template.name,
      amount: String(template.amount),
      category: template.category,
      kind: template.kind,
      frequency: template.frequency,
      dueDay: template.dueDay ? String(template.dueDay) : '',
      anchorDate: template.anchorDate ?? '',
    })
    setError('')
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const amount = Number(draft.amount)
    if (!draft.name.trim()) {
      setError('Recurring item name is required.')
      return
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Amount must be greater than 0.')
      return
    }
    if (draft.frequency === 'monthly' && (!draft.dueDay || Number(draft.dueDay) < 1 || Number(draft.dueDay) > 31)) {
      setError('Monthly items need a due day between 1 and 31.')
      return
    }
    if (['weekly', 'biweekly', 'one-time'].includes(draft.frequency) && !draft.anchorDate) {
      setError('Weekly, biweekly, and one-time items need an anchor date.')
      return
    }

    const nextTemplate: RecurringItemTemplate = {
      id: editingTemplateId ?? crypto.randomUUID(),
      name: draft.name.trim(),
      amount,
      category: draft.category,
      kind: draft.kind,
      frequency: draft.frequency,
      dueDay: draft.frequency === 'monthly' ? Number(draft.dueDay) : undefined,
      anchorDate: ['weekly', 'biweekly', 'one-time'].includes(draft.frequency) ? draft.anchorDate : undefined,
      isActive: editingTemplateId
        ? templates.find((template) => template.id === editingTemplateId)?.isActive ?? true
        : true,
      createdAt: editingTemplateId
        ? templates.find((template) => template.id === editingTemplateId)?.createdAt ?? new Date().toISOString()
        : new Date().toISOString(),
    }

    if (editingTemplateId) {
      onUpdateTemplate(nextTemplate)
    } else {
      onAddTemplate(nextTemplate)
    }

    resetForm()
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
      <Panel
        title={editingTemplateId ? 'Edit recurring template' : 'Add recurring template'}
        action="Saved locally"
        helper="Recurring items are saved templates. Later, Leftly can use them to build each new pay period automatically."
      >
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <Field label="Name">
            <input
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              placeholder="Rent"
            />
          </Field>

          <Field label="Amount">
            <input
              type="number"
              min="0"
              step="0.01"
              value={draft.amount}
              onChange={(event) => setDraft({ ...draft, amount: event.target.value })}
              placeholder="1200"
            />
          </Field>

          <Field label="Kind">
            <select value={draft.kind} onChange={(event) => setDraft({ ...draft, kind: event.target.value as RecurringItemTemplate['kind'] })}>
              <option value="bill">Bill</option>
              <option value="planned-expense">Planned expense</option>
            </select>
          </Field>

          <Field label="Category">
            <select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value as RecurringItemTemplate['category'] })}>
              {DEFAULT_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Frequency">
            <select
              value={draft.frequency}
              onChange={(event) => setDraft({ ...draft, frequency: event.target.value as RecurringFrequency })}
            >
              {Object.entries(frequencyLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>

          {draft.frequency === 'monthly' ? (
            <Field label="Due day">
              <input
                type="number"
                min="1"
                max="31"
                step="1"
                value={draft.dueDay}
                onChange={(event) => setDraft({ ...draft, dueDay: event.target.value })}
                placeholder="1"
              />
            </Field>
          ) : null}

          {draft.frequency === 'weekly' || draft.frequency === 'biweekly' || draft.frequency === 'one-time' ? (
            <Field label="Anchor date">
              <input
                type="date"
                value={draft.anchorDate}
                onChange={(event) => setDraft({ ...draft, anchorDate: event.target.value })}
              />
            </Field>
          ) : null}

          {error ? (
            <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm font-medium text-rose-200" role="alert">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <button type="submit" className={buttonStyles.primary}>
              {editingTemplateId ? 'Save template' : 'Save template'}
            </button>
            {editingTemplateId ? (
              <button type="button" onClick={resetForm} className={buttonStyles.secondary}>
                Cancel
              </button>
            ) : null}
          </div>
        </form>
      </Panel>

      <Panel title="Saved templates" action={`${sortedTemplates.length} total`} helper="Deactivate or reactivate templates without deleting them.">
        {sortedTemplates.length > 0 ? (
          <div className="grid gap-3">
            {sortedTemplates.map((template) => (
              <article key={template.id} className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-4">
                <div className="grid gap-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-semibold text-white">{template.name}</p>
                        <Badge>{template.kind === 'bill' ? 'Bill' : 'Planned expense'}</Badge>
                        <Badge muted>{template.isActive ? 'Active' : 'Inactive'}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-slate-400">
                        {formatCurrency(template.amount)} · {template.category} · {frequencyLabels[template.frequency]}
                        {template.dueDay ? ` · due day ${template.dueDay}` : ''}
                        {template.anchorDate ? ` · anchor ${template.anchorDate}` : ''}
                      </p>
                    </div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{template.createdAt.slice(0, 10)}</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => startEdit(template)} className={buttonStyles.secondary}>
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdateTemplate({ ...template, isActive: !template.isActive })}
                      className={buttonStyles.secondary}
                    >
                      {template.isActive ? 'Deactivate' : 'Reactivate'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!window.confirm(`Delete ${template.name}? This cannot be undone.`)) {
                          return
                        }
                        if (editingTemplateId === template.id) {
                          resetForm()
                        }
                        onDeleteTemplate(template.id)
                      }}
                      className={buttonStyles.danger}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No recurring templates yet"
            text="Save a recurring rent template, subscription, or grocery budget here. It will stay in the browser until you delete it."
          />
        )}
      </Panel>
    </div>
  )
}

function Panel({ title, action, helper, children }: { title: string; action: string; helper?: string; children: ReactNode }) {
  return (
    <section className="rounded-[1.5rem] border border-slate-800/80 bg-slate-950/75 p-4 shadow-2xl shadow-slate-950/30 sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          {helper ? <p className="mt-1 text-sm leading-6 text-slate-400">{helper}</p> : null}
        </div>
        <span className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 text-xs font-medium text-slate-300">{action}</span>
      </div>
      {children}
    </section>
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

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/45 p-4">
      <p className="text-sm font-medium text-white">{title}</p>
      <p className="mt-1 text-sm leading-6 text-slate-400">{text}</p>
    </div>
  )
}

function Badge({
  children,
  muted = false,
}: {
  children: ReactNode
  muted?: boolean
}) {
  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${
        muted ? 'border-slate-700 bg-slate-900/70 text-slate-300' : 'border-cyan-400/20 bg-cyan-400/10 text-cyan-100'
      }`}
    >
      {children}
    </span>
  )
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}
