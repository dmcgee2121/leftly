import { useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { DEFAULT_CATEGORIES, type RecurringFrequency, type RecurringItemTemplate } from '../types/budget'

const buttonStyles = {
  primary: 'button-primary',
  secondary: 'button-secondary',
  danger: 'button-danger',
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
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'set-asides'>('all')

  const sortedTemplates = useMemo(
    () => [...templates].sort((a, b) => Number(b.isActive) - Number(a.isActive) || b.createdAt.localeCompare(a.createdAt)),
    [templates],
  )

  const recurringSummary = useMemo(() => {
    const activeTemplates = templates.filter((template) => template.isActive)
    const inactiveTemplates = templates.filter((template) => !template.isActive)
    const setAsideTemplates = templates.filter((template) => template.kind === 'bill' && template.setAsideEnabled && (template.setAsideAmount ?? 0) > 0)

    return {
      activeMonthlyEstimate: activeTemplates.reduce((sum, template) => sum + (template.kind === 'bill' ? template.amount : 0), 0),
      activeCount: activeTemplates.length,
      inactiveCount: inactiveTemplates.length,
      setAsideCount: setAsideTemplates.length,
    }
  }, [templates])

  const filteredTemplates = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return sortedTemplates.filter((template) => {
      const categoryLabel = template.category || 'Other'
      const frequencyLabel = frequencyLabels[template.frequency]
      const matchesSearch =
        query === '' ||
        template.name.toLowerCase().includes(query) ||
        categoryLabel.toLowerCase().includes(query) ||
        frequencyLabel.toLowerCase().includes(query)
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && template.isActive) ||
        (statusFilter === 'inactive' && !template.isActive) ||
        (statusFilter === 'set-asides' && template.kind === 'bill' && template.setAsideEnabled && (template.setAsideAmount ?? 0) > 0)

      return matchesSearch && matchesStatus
    })
  }, [searchQuery, sortedTemplates, statusFilter])

  const groupedTemplates = useMemo(() => {
    const order = [...DEFAULT_CATEGORIES, 'Other / Misc', 'Other']
    const buckets = new Map<string, RecurringItemTemplate[]>()

    for (const category of order) {
      buckets.set(category, [])
    }

    for (const template of filteredTemplates) {
      const category = template.category || 'Other / Misc'
      const bucket = buckets.get(category) ?? []
      bucket.push(template)
      buckets.set(category, bucket)
    }

    return order
      .map((category) => ({ category, items: buckets.get(category) ?? [] }))
      .filter((group) => group.items.length > 0)
  }, [filteredTemplates])

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
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="leftly-shell-soft p-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">Active monthly estimate</p>
          <p className="mt-2 text-xl font-semibold text-white">{formatCurrency(recurringSummary.activeMonthlyEstimate)}</p>
        </div>
        <div className="leftly-shell-soft p-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">Active items</p>
          <p className="mt-2 text-xl font-semibold text-white">{recurringSummary.activeCount}</p>
        </div>
        <div className="leftly-shell-soft p-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">Inactive items</p>
          <p className="mt-2 text-xl font-semibold text-white">{recurringSummary.inactiveCount}</p>
        </div>
        <div className="leftly-shell-soft p-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">Set-asides</p>
          <p className="mt-2 text-xl font-semibold text-white">{recurringSummary.setAsideCount}</p>
        </div>
      </div>

      <div className="leftly-shell grid gap-3 p-3 sm:p-4">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">Bill Plan manager</p>
            <p className="mt-1 text-sm leading-6 text-slate-400">
              Save recurring bills and planned items here. Apply them when a pay period is ready.
            </p>
          </div>
          <button type="button" onClick={openBulkPanel} className={buttonStyles.secondary + ' w-full sm:w-auto'}>
            Add multiple bills
          </button>
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <Field label="Search">
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search name, category, or frequency"
            />
          </Field>
          <div className="flex gap-2 overflow-x-auto pb-1 pr-1 no-scrollbar lg:flex-wrap lg:overflow-visible lg:pb-0 lg:pr-0">
            {[
              { key: 'all', label: 'All' },
              { key: 'active', label: 'Active' },
              { key: 'inactive', label: 'Inactive' },
              { key: 'set-asides', label: 'Set-asides' },
            ].map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={() => setStatusFilter(chip.key as typeof statusFilter)}
                aria-pressed={statusFilter === chip.key}
                className={`min-h-11 shrink-0 rounded-full border px-3.5 py-2.5 text-xs font-semibold transition ${
                  statusFilter === chip.key
                    ? 'border-cyan-400/30 bg-cyan-400/10 text-cyan-100'
                    : 'border-slate-700/90 bg-slate-900/75 text-slate-400 hover:border-slate-600 hover:text-white'
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {bulkSuccess ? (
        <p className="leftly-banner-success" role="status">
          {bulkSuccess}
        </p>
      ) : null}

      {bulkReminder ? (
        <p className="rounded-[1.1rem] border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100">
          Want these included in your current pay period? Use Apply Bill Plan to this pay period.
        </p>
      ) : null}

      {isBulkOpen ? (
        <section className="leftly-shell p-4 shadow-2xl shadow-slate-950/30 sm:p-5">
          <div className="mb-4 flex flex-col gap-3 border-b border-slate-800/70 pb-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">Add multiple bills</h3>
              <p className="mt-1 text-sm leading-6 text-slate-400">
                Add several monthly bills at once. Blank rows are ignored.
              </p>
            </div>
            <span className="leftly-chip leftly-chip-muted px-3 py-1 text-xs font-medium">
              Saved locally
            </span>
          </div>

          <form className="grid gap-4" onSubmit={handleBulkSave}>
            <div className="grid gap-3">
              {bulkRows.map((row, index) => (
                <div key={index} className="leftly-shell-soft p-3 sm:p-4">
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
              <p className="leftly-banner-danger" role="alert">
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
            <p className="leftly-banner-danger" role="alert">
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

        <Panel
          title="Saved Bill Plan items"
          action={`${filteredTemplates.length} shown`}
          helper="Deactivate, reactivate, or edit items without deleting them."
        >
          {templates.length === 0 ? (
            <EmptyState
              title="Bill Plan is empty"
              text="This is where recurring bills and planned items live. Add your first bill below or use the bulk tool to save a few at once."
              actionLabel="Add multiple bills"
              onAction={openBulkPanel}
            />
          ) : filteredTemplates.length === 0 ? (
            <EmptyState
              title="No Bill Plan items match this filter"
              text="Clear the search or reset the chips to show your saved items again."
              actionLabel="Clear filters"
              onAction={() => {
                setSearchQuery('')
                setStatusFilter('all')
              }}
            />
          ) : (
            <div className="grid gap-4">
              {groupedTemplates.map((group) => (
                <section key={group.category} className="grid gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">{group.category}</h4>
                    <span className="leftly-chip leftly-chip-muted px-2.5 py-1 text-[11px] font-semibold">
                      {group.items.length}
                    </span>
                  </div>

                  <div className="grid gap-2">
                    {group.items.map((template) => {
                      const isSetAside =
                        template.kind === 'bill' && template.setAsideEnabled && (template.setAsideAmount ?? 0) > 0
                      const scheduleLabel =
                        template.frequency === 'monthly'
                          ? template.dueDay
                            ? `Due day ${template.dueDay}`
                            : 'Monthly'
                          : frequencyLabels[template.frequency]

                      return (
                        <article
                          key={template.id}
                          className={`leftly-shell-soft p-3.5 sm:p-4 ${template.isActive ? '' : 'border-slate-800/90 bg-slate-950/55'}`}
                        >
                          <div className="flex flex-col gap-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="truncate text-[1rem] font-semibold tracking-[-0.02em] text-white">{template.name}</p>
                                  <Badge>{template.kind === 'bill' ? 'Bill' : 'Planned spending'}</Badge>
                                  {isSetAside ? <Badge muted>Set-aside</Badge> : null}
                                  <Badge muted>{template.isActive ? 'Active' : 'Inactive'}</Badge>
                                </div>
                                <p className="mt-1 text-sm leading-5 text-slate-400">
                                  {template.category} · {scheduleLabel}
                                  {template.anchorDate ? ` · anchor ${template.anchorDate}` : ''}
                                </p>
                              </div>
                              <div className="shrink-0 text-right">
                                <p className="text-[1.02rem] font-semibold tracking-[-0.02em] text-white">
                                  {formatCurrency(template.amount)}
                                </p>
                                <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-slate-500">
                                  {template.createdAt.slice(0, 10)}
                                </p>
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <Badge muted>{scheduleLabel}</Badge>
                              {template.anchorDate ? <Badge muted>Anchor {template.anchorDate}</Badge> : null}
                            </div>

                            <div className="grid gap-2 sm:grid-cols-3">
                              <button type="button" onClick={() => startEdit(template)} className={buttonStyles.secondary + ' w-full'}>
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => onUpdateTemplate({ ...template, isActive: !template.isActive })}
                                className={buttonStyles.secondary + ' w-full'}
                              >
                                {template.isActive ? 'Deactivate' : 'Reactivate'}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (!window.confirm(`Delete ${template.name} from Bill Plan? You can't undo this.`)) {
                                    return
                                  }
                                  if (editingTemplateId === template.id) {
                                    resetForm()
                                  }
                                  onDeleteTemplate(template.id)
                                }}
                                className={buttonStyles.danger + ' w-full'}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </article>
                      )
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  )
}

function Panel({ title, action, helper, children }: { title: string; action: string; helper?: string; children: ReactNode }) {
  return (
    <section className="leftly-shell p-4 sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-3 border-b border-slate-800/70 pb-4">
        <div>
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          {helper ? <p className="mt-1 text-sm leading-6 text-slate-400">{helper}</p> : null}
        </div>
        <span className="leftly-chip leftly-chip-muted px-3 py-1 text-xs font-medium">{action}</span>
      </div>
      {children}
    </section>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="leftly-field">
      <span>{label}</span>
      <span className="leftly-input-shell">
        {children}
      </span>
    </label>
  )
}

function EmptyState({
  title,
  text,
  actionLabel,
  onAction,
}: {
  title: string
  text: string
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <div className="leftly-empty grid gap-3">
      <div>
        <p className="text-sm font-medium text-white">{title}</p>
        <p className="mt-1 text-sm leading-6 text-slate-400">{text}</p>
      </div>
      {actionLabel && onAction ? (
        <button type="button" onClick={onAction} className={buttonStyles.secondary + ' w-full sm:w-auto'}>
          {actionLabel}
        </button>
      ) : null}
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
  return <span className={`leftly-chip ${muted ? 'leftly-chip-muted' : 'leftly-chip-default'}`}>{children}</span>
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}
