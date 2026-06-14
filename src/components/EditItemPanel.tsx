import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import type { Bill, BudgetCategory, Expense } from '../types/budget'

const buttonStyles = {
  primary:
    'inline-flex min-h-11 items-center justify-center rounded-xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-cyan-300 focus:outline-none focus:ring-4 focus:ring-cyan-400/20 active:translate-y-px',
  secondary:
    'inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3 text-sm font-semibold text-slate-100 shadow-sm transition hover:border-slate-700 hover:bg-slate-900 focus:outline-none focus:ring-4 focus:ring-cyan-400/10 active:translate-y-px',
}

export type EditTarget =
  | {
      kind: 'bill'
      item: Bill
    }
  | {
      kind: 'expense'
      item: Expense
    }

type EditDraft = {
  name: string
  amount: string
  category: BudgetCategory
  dueDate: string
  date: string
  isPaid: boolean
}

export function EditItemPanel({
  target,
  isOpen,
  onClose,
  onSaveBill,
  onSaveExpense,
}: {
  target: EditTarget | null
  isOpen: boolean
  onClose: () => void
  onSaveBill: (bill: Bill) => void
  onSaveExpense: (expense: Expense) => void
}) {
  const [draft, setDraft] = useState<EditDraft>({
    name: '',
    amount: '',
    category: 'Other / Misc',
    dueDate: '',
    date: '',
    isPaid: false,
  })
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen || !target) {
      return
    }

    if (target.kind === 'bill') {
      setDraft({
        name: target.item.name,
        amount: String(target.item.amount),
        category: target.item.category,
        dueDate: target.item.dueDate,
        date: '',
        isPaid: target.item.isPaid,
      })
    } else {
      setDraft({
        name: target.item.name,
        amount: String(target.item.amount),
        category: target.item.category,
        dueDate: '',
        date: target.item.date,
        isPaid: false,
      })
    }
    setError('')
  }, [isOpen, target])

  function validateDraft() {
    const amount = Number(draft.amount)
    if (!draft.name.trim()) {
      setError('Name is required.')
      return false
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Amount must be greater than 0.')
      return false
    }
    if (!draft.category) {
      setError('Category is required.')
      return false
    }
    if (target?.kind === 'bill' && !draft.dueDate) {
      setError('Due date is required.')
      return false
    }
    if (target?.kind === 'expense' && !draft.date) {
      setError('Date is required.')
      return false
    }

    setError('')
    return true
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!validateDraft() || !target) {
      return
    }

    const amount = Number(draft.amount)
    if (target.kind === 'bill') {
      onSaveBill({
        ...target.item,
        name: draft.name.trim(),
        amount,
        dueDate: draft.dueDate,
        category: draft.category,
        isPaid: draft.isPaid,
        paidDate: draft.isPaid ? target.item.paidDate ?? new Date().toISOString().slice(0, 10) : null,
      })
    } else {
      onSaveExpense({
        ...target.item,
        name: draft.name.trim(),
        amount,
        date: draft.date,
        category: draft.category,
      })
    }

    onClose()
  }

  if (!isOpen || !target) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 p-3 sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Close edit panel"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <section className="relative z-10 w-full max-w-2xl rounded-[1.5rem] border border-slate-800/80 bg-slate-950 p-4 shadow-2xl shadow-slate-950/60 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Edit {target.kind}</p>
            <h3 className="mt-1 text-lg font-semibold text-white">{target.item.name}</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge>{target.kind === 'bill' ? 'Bill' : 'Expense'}</Badge>
              {target.kind === 'bill' && target.item.source === 'recurring' ? <Badge muted>Bill Plan</Badge> : null}
              {target.kind === 'expense' && target.item.source === 'recurring' ? (
                <Badge muted>{target.item.setAsideForTemplateId ? 'Set-aside' : target.item.isPlanned ? 'Planned spending' : 'Bill Plan'}</Badge>
              ) : null}
            </div>
          </div>
          <button type="button" onClick={onClose} className={buttonStyles.secondary}>
            Cancel
          </button>
        </div>

        <form className="mt-4 grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name">
              <input
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                placeholder={target.kind === 'bill' ? 'Rent' : 'Groceries'}
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
            <Field label={target.kind === 'bill' ? 'Due date' : 'Date'}>
              <input
                type="date"
                value={target.kind === 'bill' ? draft.dueDate : draft.date}
                onChange={(event) =>
                  setDraft(target.kind === 'bill' ? { ...draft, dueDate: event.target.value } : { ...draft, date: event.target.value })
                }
              />
            </Field>
            <Field label="Category">
              <select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value as BudgetCategory })}>
                <option value="Housing">Housing</option>
                <option value="Utilities">Utilities</option>
                <option value="Subscriptions">Subscriptions</option>
                <option value="Transportation">Transportation</option>
                <option value="Food">Food</option>
                <option value="Debt">Debt</option>
                <option value="Insurance">Insurance</option>
                <option value="Personal">Personal</option>
                <option value="Other / Misc">Other / Misc</option>
              </select>
            </Field>
          </div>

          {target.kind === 'bill' ? (
            <label className="flex items-start gap-3 rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-3 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={draft.isPaid}
                onChange={(event) => setDraft({ ...draft, isPaid: event.target.checked })}
                className="mt-1 h-4 w-4 rounded border-slate-700 text-cyan-400 focus:ring-cyan-400"
              />
              <span>
                <span className="block font-semibold">Paid</span>
                <span className="mt-1 block text-sm leading-6 text-slate-400">
                  Turning this on marks the bill paid. Turning it off clears the paid date.
                </span>
              </span>
            </label>
          ) : null}

          {error ? (
            <p className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm font-medium text-rose-200" role="alert">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <button type="submit" className={buttonStyles.primary}>
              Save changes
            </button>
            <button type="button" onClick={onClose} className={buttonStyles.secondary}>
              Cancel
            </button>
          </div>
        </form>
      </section>
    </div>
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

function Badge({ children, muted = false }: { children: ReactNode; muted?: boolean }) {
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
