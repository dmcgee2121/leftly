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
  setAsideEnabled: boolean
  setAsideAmount: string
}

type BulkRecurringDraft = {
  name: string
  amount: string
  category: RecurringItemTemplate['category']
  frequency: RecurringFrequency
  dueDay: string
}

const frequencyLabels: Record<RecurringFrequency, string> = {
  'every-pay-period': 'Every pay period',
  weekly: 'Weekly',
  biweekly: 'Biweekly',
  monthly: 'Monthly',
  'one-time': 'One-time',
}

function createBulkRows(): BulkRecurringDraft[] {
  return Array.from({ length: 3 }, () => ({
    name: '',
    amount: '',
    category: 'Other / Misc',
    frequency: 'monthly',
    dueDay: '',
  }))
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
    setAsideEnabled: false,
    setAsideAmount: '',
  })
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [isBulkOpen, setIsBulkOpen] = useState(false)
  const [bulkRows, setBulkRows] = useState<BulkRecurringDraft[]>(() => createBulkRows())
  const [bulkError, setBulkError] = useState('')
  const [bulkSuccess, setBulkSuccess] = useState('')
  const [bulkReminder, setBulkReminder] = useState(false)

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
      setAsideEnabled: false,
      setAsideAmount: '',
    })
    setError('')
  }

  function openBulkPanel() {
    setIsBulkOpen(true)
    setBulkError('')
    setBulkSuccess('')
    setBulkReminder(false)
  }

  function addBulkRow() {
    setBulkRows((current) => [
      ...current,
      {
        name: '',
        amount: '',
        category: 'Other / Misc',
        frequency: 'monthly',
        dueDay: '',
      },
    ])
  }

  function updateBulkRow(index: number, patch: Partial<BulkRecurringDraft>) {
    setBulkRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)))
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
      setAsideEnabled: Boolean(template.setAsideEnabled),
      setAsideAmount: template.setAsideAmount ? String(template.setAsideAmount) : '',
    })
    setError('')
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const amount = Number(draft.amount)
    const parsedSetAsideAmount = draft.setAsideAmount.trim() === '' ? undefined : Number(draft.setAsideAmount)
    const setAsideAmount = Number.isFinite(parsedSetAsideAmount) ? parsedSetAsideAmount : undefined
    if (!draft.name.trim()) {
      setError('Bill Plan item name is required.')
      return
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Amount must be greater than 0.')
      return
    }
    if (draft.kind === 'bill' && draft.setAsideEnabled && (!Number.isFinite(setAsideAmount) || (setAsideAmount ?? 0) <= 0)) {
      setError('Set aside amount must be greater than 0 when set aside is enabled.')
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
      setAsideEnabled: draft.kind === 'bill' ? draft.setAsideEnabled : undefined,
      setAsideAmount: draft.kind === 'bill' ? setAsideAmount : undefined,
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

  function handleBulkSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBulkError('')
    setBulkSuccess('')

    const nextTemplates: RecurringItemTemplate[] = []

    for (let index = 0; index < bulkRows.length; index += 1) {
      const row = bulkRows[index]
      const name = row.name.trim()
      const amount = Number(row.amount)
      const dueDay = row.dueDay.trim()
      const hasContent = name !== '' || row.amount.trim() !== '' || dueDay !== ''

      if (!hasContent) {
        continue
      }

      if (!name) {
        setBulkError(`Row ${index + 1} needs a bill name.`)
        return
      }

      if (!Number.isFinite(amount) || amount <= 0) {
        setBulkError(`Row ${index + 1} needs an amount greater than 0.`)
        return
      }

      if (row.frequency !== 'monthly') {
        setBulkError(`Row ${index + 1} must use Monthly frequency for bulk bills.`)
        return
      }

      if (!dueDay || Number(dueDay) < 1 || Number(dueDay) > 31) {
        setBulkError(`Row ${index + 1} needs a due day between 1 and 31.`)
        return
      }

      nextTemplates.push({
        id: crypto.randomUUID(),
        name,
        amount,
        category: row.category,
        kind: 'bill',
        frequency: 'monthly',
        dueDay: Number(dueDay),
        anchorDate: undefined,
        setAsideEnabled: false,
        setAsideAmount: undefined,
        isActive: true,
        createdAt: new Date().toISOString(),
      })
    }

    if (nextTemplates.length === 0) {
      setBulkError('Add at least one complete bill row.')
      return
    }

    nextTemplates.forEach((template) => onAddTemplate(template))
    setBulkSuccess(`${nextTemplates.length} bills added to Bill Plan.`)
    setBulkReminder(true)
    setIsBulkOpen(false)
    setBulkRows(createBulkRows())
    setBulkError('')
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-6 text-slate-400">
          Bill Plan is where you save repeating bills and planned spending. Use the bulk tool to enter monthly bills faster.
        </p>
        <button type="button" onClick={openBulkPanel} className={buttonStyles.secondary + ' w-full sm:w-auto'}>
          Add multiple bills
        </button>
      </div>

      {bulkSuccess ? (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-100" role="status">
          {bulkSuccess}
        </p>
      ) : null}

      {bulkReminder ? (
        <p className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-sm text-cyan-100">
          Want these included in your current pay period? Use Apply Bill Plan to this pay period.
        </p>
      ) : null}

      {isBulkOpen ? (
        <section className="rounded-[1.5rem] border border-slate-800/80 bg-slate-950/75 p-4 shadow-2xl shadow-slate-950/30 sm:p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-white">Add multiple bills</h3>
              <p className="mt-1 text-sm leading-6 text-slate-400">
                Add several monthly bills at once. Blank rows are ignored.
              </p>
            </div>
            <span className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 text-xs font-medium text-slate-300">
              Saved locally
            </span>
          </div>

          <form className="grid gap-4" onSubmit={handleBulkSave}>
            <div className="grid gap-3">
              {bulkRows.map((row, index) => (
                <div key={index} className="rounded-2xl border border-slate-800/70 bg-slate-950/60 p-3 sm:p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-white">Row {index + 1}</p>
                    <button
                      type="button"
                      onClick={() =>
                        setBulkRows((current) => current.filter((_, rowIndex) => rowIndex !== index))
                      }
                      className="button-secondary !min-h-0 !px-3 !py-2 !text-xs"
                      disabled={bulkRows.length <= 1}
                    >
                      Remove
                    </button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Field label="Name">
                      <input
                        value={row.name}
                        onChange={(event) => updateBulkRow(index, { name: event.target.value })}
                        placeholder="Rent"
                      />
                    </Field>
                    <Field label="Amount">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.amount}
                        onChange={(event) => updateBulkRow(index, { amount: event.target.value })}
                        placeholder="1200"
                      />
                    </Field>
                    <Field label="Category">
                      <select
                        value={row.category}
                        onChange={(event) => updateBulkRow(index, { category: event.target.value as RecurringItemTemplate['category'] })}
                      >
                        {DEFAULT_CATEGORIES.map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Frequency">
                      <select
                        value={row.frequency}
                        onChange={(event) => updateBulkRow(index, { frequency: event.target.value as RecurringFrequency })}
                      >
                        <option value="monthly">Monthly</option>
                      </select>
                    </Field>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Field label="Due day">
                      <input
                        type="number"
                        min="1"
                        max="31"
                        step="1"
                        value={row.dueDay}
                        onChange={(event) => updateBulkRow(index, { dueDay: event.target.value })}
                        placeholder="1"
                      />
                    </Field>
                  </div>
                </div>
              ))}
            </div>

            {bulkError ? (
              <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm font-medium text-rose-200" role="alert">
                {bulkError}
              </p>
            ) : null}

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <button type="button" onClick={addBulkRow} className={buttonStyles.secondary + ' w-full sm:w-auto'}>
                Add another row
              </button>
              <button type="submit" className={buttonStyles.primary + ' w-full sm:w-auto'}>
                Save bills
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsBulkOpen(false)
                  setBulkError('')
                  setBulkSuccess('')
                  setBulkReminder(false)
                  setBulkRows(createBulkRows())
                }}
                className={buttonStyles.secondary + ' w-full sm:w-auto'}
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
      <Panel
        title={editingTemplateId ? 'Edit Bill Plan item' : 'Add Bill Plan item'}
        action="Saved locally"
        helper="Bill Plan items are saved templates. Later, Leftly can use them to build each new pay period automatically. Set-asides reserve money each pay period for a bill that may be due later. They lower your safe-to-spend amount but are not marked as a paid bill."
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
            <select
              value={draft.kind}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  kind: event.target.value as RecurringItemTemplate['kind'],
                  setAsideEnabled: event.target.value === 'bill' ? draft.setAsideEnabled : false,
                })
              }
            >
              <option value="bill">Bill</option>
              <option value="planned-expense">Planned spending</option>
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

          {draft.kind === 'bill' ? (
            <div className="grid gap-3 rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-4">
              <label className="flex items-start gap-3 text-sm text-slate-200">
                <input
                  type="checkbox"
                  checked={draft.setAsideEnabled}
                  onChange={(event) => setDraft({ ...draft, setAsideEnabled: event.target.checked })}
                  className="mt-1 h-4 w-4 rounded border-slate-700 text-cyan-400 focus:ring-cyan-400"
                />
                <span>
                  <span className="block font-semibold">Set aside money each pay period</span>
                  <span className="mt-1 block text-sm leading-6 text-slate-400">
                    Use this for large bills like rent, car insurance, or annual subscriptions so Leftly reserves money before the due date.
                  </span>
                </span>
              </label>

              <Field label="Set aside amount">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={draft.setAsideAmount}
                  onChange={(event) => setDraft({ ...draft, setAsideAmount: event.target.value })}
                  placeholder="600"
                  disabled={!draft.setAsideEnabled}
                  className={!draft.setAsideEnabled ? 'opacity-60' : undefined}
                />
              </Field>

              <p className="text-sm leading-6 text-slate-400">
                Example: Rent is $1,200 monthly, set aside $600 from each biweekly check. This reserves cash now so the bill is easier to pay later.
              </p>
            </div>
          ) : null}

          {error ? (
            <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm font-medium text-rose-200" role="alert">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <button type="submit" className={buttonStyles.primary}>
              {editingTemplateId ? 'Save Bill Plan item' : 'Save Bill Plan item'}
            </button>
            {editingTemplateId ? (
              <button type="button" onClick={resetForm} className={buttonStyles.secondary}>
                Cancel
              </button>
            ) : null}
          </div>
        </form>
      </Panel>

      <Panel title="Saved Bill Plan items" action={`${sortedTemplates.length} total`} helper="Deactivate or reactivate items without deleting them.">
        {sortedTemplates.length > 0 ? (
          <div className="grid gap-3">
            {sortedTemplates.map((template) => (
              <article key={template.id} className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-4">
                <div className="grid gap-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-semibold text-white">{template.name}</p>
                        <Badge>{template.kind === 'bill' ? 'Bill' : 'Planned spending'}</Badge>
                        {template.kind === 'bill' && template.setAsideEnabled && (template.setAsideAmount ?? 0) > 0 ? (
                          <Badge muted>Set-aside</Badge>
                        ) : null}
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
            title="No Bill Plan items yet"
            text="Save a repeating rent bill, subscription, or planned spending item here. It will stay in the browser until you delete it."
          />
        )}
      </Panel>
      </div>
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
