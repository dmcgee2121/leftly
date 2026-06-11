import { useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import {
  clearAllAppData,
  loadActiveBudgetPeriod,
  loadBills,
  loadExpenses,
  saveActiveBudgetPeriod,
  saveBills,
  saveExpenses,
} from './lib/storage'
import type { Bill, BudgetPeriod, Expense, PayCadence } from './types/budget'

type TabKey = 'dashboard' | 'pay-period' | 'bills' | 'expenses'

type PayPeriodDraft = {
  cadence: PayCadence
  income: string
  startDate: string
  endDate: string
}

type BillDraft = {
  name: string
  amount: string
  dueDate: string
}

type ExpenseDraft = {
  name: string
  amount: string
  date: string
}

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

const cadenceOptions: Array<{ value: PayCadence; label: string }> = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Biweekly' },
  { value: 'monthly', label: 'Monthly' },
]

const tabLabels: Array<{ key: TabKey; label: string }> = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'pay-period', label: 'Pay Period' },
  { key: 'bills', label: 'Bills' },
  { key: 'expenses', label: 'Expenses' },
]

function getDraftFromPeriod(period: BudgetPeriod | null): PayPeriodDraft {
  return {
    cadence: period?.cadence ?? 'biweekly',
    income: period ? String(period.income) : '',
    startDate: period?.startDate ?? '',
    endDate: period?.endDate ?? '',
  }
}

function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard')
  const [payPeriod, setPayPeriod] = useState<BudgetPeriod | null>(() => loadActiveBudgetPeriod())
  const [bills, setBills] = useState<Bill[]>(() => loadBills())
  const [expenses, setExpenses] = useState<Expense[]>(() => loadExpenses())
  const [payPeriodDraft, setPayPeriodDraft] = useState<PayPeriodDraft>(() => getDraftFromPeriod(loadActiveBudgetPeriod()))
  const [billDraft, setBillDraft] = useState<BillDraft>({
    name: '',
    amount: '',
    dueDate: '',
  })
  const [expenseDraft, setExpenseDraft] = useState<ExpenseDraft>({
    name: '',
    amount: '',
    date: '',
  })
  const [payPeriodError, setPayPeriodError] = useState('')
  const [billError, setBillError] = useState('')
  const [expenseError, setExpenseError] = useState('')

  useEffect(() => {
    saveActiveBudgetPeriod(payPeriod)
  }, [payPeriod])

  useEffect(() => {
    saveBills(bills)
  }, [bills])

  useEffect(() => {
    saveExpenses(expenses)
  }, [expenses])

  const totals = useMemo(() => {
    const income = payPeriod?.income ?? 0
    const totalBills = bills.reduce((sum, bill) => sum + bill.amount, 0)
    const paidBills = bills.filter((bill) => bill.isPaid).reduce((sum, bill) => sum + bill.amount, 0)
    const unpaidBills = totalBills - paidBills
    const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0)
    const remainingBalance = income - paidBills - totalExpenses
    const safeToSpend = income - totalBills - totalExpenses

    return {
      income,
      totalBills,
      paidBills,
      unpaidBills,
      totalExpenses,
      remainingBalance,
      safeToSpend,
    }
  }, [bills, expenses, payPeriod])

  function formatCurrency(value: number) {
    return currencyFormatter.format(value)
  }

  function resetDrafts() {
    setPayPeriodDraft(getDraftFromPeriod(null))
    setBillDraft({ name: '', amount: '', dueDate: '' })
    setExpenseDraft({ name: '', amount: '', date: '' })
    setPayPeriodError('')
    setBillError('')
    setExpenseError('')
  }

  function handleSavePayPeriod(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPayPeriodError('')

    const income = Number(payPeriodDraft.income)

    if (!payPeriodDraft.startDate) {
      setPayPeriodError('Start date is required.')
      return
    }

    if (!payPeriodDraft.endDate) {
      setPayPeriodError('End date is required.')
      return
    }

    if (payPeriodDraft.endDate < payPeriodDraft.startDate) {
      setPayPeriodError('End date must be after the start date.')
      return
    }

    if (!Number.isFinite(income) || income <= 0) {
      setPayPeriodError('Income must be greater than 0.')
      return
    }

    const nextPeriod: BudgetPeriod = {
      cadence: payPeriodDraft.cadence,
      income,
      startDate: payPeriodDraft.startDate,
      endDate: payPeriodDraft.endDate,
    }

    setPayPeriod(nextPeriod)
    setPayPeriodDraft(getDraftFromPeriod(nextPeriod))
    setActiveTab('dashboard')
  }

  function handleAddBill(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBillError('')

    const amount = Number(billDraft.amount)

    if (!billDraft.name.trim()) {
      setBillError('Bill name is required.')
      return
    }

    if (!billDraft.dueDate) {
      setBillError('Due date is required.')
      return
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setBillError('Amount must be greater than 0.')
      return
    }

    setBills((current) => [
      {
        id: crypto.randomUUID(),
        name: billDraft.name.trim(),
        amount,
        dueDate: billDraft.dueDate,
        isPaid: false,
        paidDate: null,
      },
      ...current,
    ])

    setBillDraft({ name: '', amount: '', dueDate: '' })
  }

  function handleAddExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setExpenseError('')

    const amount = Number(expenseDraft.amount)

    if (!expenseDraft.name.trim()) {
      setExpenseError('Expense name is required.')
      return
    }

    if (!expenseDraft.date) {
      setExpenseError('Date is required.')
      return
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setExpenseError('Amount must be greater than 0.')
      return
    }

    setExpenses((current) => [
      {
        id: crypto.randomUUID(),
        name: expenseDraft.name.trim(),
        amount,
        date: expenseDraft.date,
      },
      ...current,
    ])

    setExpenseDraft({ name: '', amount: '', date: '' })
  }

  function toggleBillPaid(id: string) {
    setBills((current) =>
      current.map((bill) => {
        if (bill.id !== id) {
          return bill
        }

        const isPaid = !bill.isPaid
        return {
          ...bill,
          isPaid,
          paidDate: isPaid ? new Date().toISOString().slice(0, 10) : null,
        }
      }),
    )
  }

  function deleteBill(id: string) {
    setBills((current) => current.filter((bill) => bill.id !== id))
  }

  function deleteExpense(id: string) {
    setExpenses((current) => current.filter((expense) => expense.id !== id))
  }

  function handleReset() {
    if (!window.confirm('Clear all Leftly data?')) {
      return
    }

    clearAllAppData()
    setPayPeriod(null)
    setBills([])
    setExpenses([])
    setActiveTab('dashboard')
    resetDrafts()
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050a14] text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.18),_transparent_40%),radial-gradient(circle_at_bottom_right,_rgba(15,23,42,0.9),_transparent_45%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-slate-950/80 to-transparent" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="rounded-[2rem] border border-slate-800/80 bg-slate-950/80 px-5 py-6 shadow-2xl shadow-slate-950/40 backdrop-blur xl:px-8">
          <div className="flex flex-col items-center gap-4 text-center">
            <p className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">
              Manual budget tracker
            </p>
            <div className="space-y-3">
              <h1 className="text-5xl font-semibold tracking-tight text-white sm:text-6xl">Leftly</h1>
              <p className="text-xl text-slate-300 sm:text-2xl">Know what&apos;s left.</p>
            </div>
            <p className="max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
              Track your pay period, bills, and spending without connecting a bank.
            </p>
            <div className="flex w-full flex-col items-center justify-between gap-3 border-t border-slate-800/80 pt-5 sm:flex-row">
              <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
                {tabLabels.map((tab) => (
                  <TabButton
                    key={tab.key}
                    active={activeTab === tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    label={tab.label}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex min-h-10 items-center justify-center rounded-full border border-slate-800 bg-slate-900/60 px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-slate-700 hover:bg-slate-900 hover:text-white"
              >
                Reset data
              </button>
            </div>
          </div>
        </header>

        <section className="mt-5 flex-1">
          {activeTab === 'dashboard' ? (
            <DashboardSection totals={totals} bills={bills} formatCurrency={formatCurrency} />
          ) : null}

          {activeTab === 'pay-period' ? (
            <SectionShell
              title="Pay Period"
              description="Set the active period that drives your dashboard totals."
            >
              <form className="grid gap-4" onSubmit={handleSavePayPeriod}>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Cadence">
                    <select
                      value={payPeriodDraft.cadence}
                      onChange={(event) =>
                        setPayPeriodDraft((current) => ({
                          ...current,
                          cadence: event.target.value as PayCadence,
                        }))
                      }
                    >
                      {cadenceOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Income amount">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={payPeriodDraft.income}
                      onChange={(event) =>
                        setPayPeriodDraft((current) => ({
                          ...current,
                          income: event.target.value,
                        }))
                      }
                      placeholder="3200"
                    />
                  </Field>
                  <Field label="Start date">
                    <input
                      type="date"
                      value={payPeriodDraft.startDate}
                      onChange={(event) =>
                        setPayPeriodDraft((current) => ({
                          ...current,
                          startDate: event.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field label="End date">
                    <input
                      type="date"
                      value={payPeriodDraft.endDate}
                      onChange={(event) =>
                        setPayPeriodDraft((current) => ({
                          ...current,
                          endDate: event.target.value,
                        }))
                      }
                    />
                  </Field>
                </div>

                {payPeriodError ? <FormMessage>{payPeriodError}</FormMessage> : null}

                <div className="flex items-center justify-between gap-3 border-t border-slate-800/80 pt-4">
                  <p className="text-sm text-slate-400">
                    {payPeriod
                      ? `Active period: ${payPeriod.cadence} from ${payPeriod.startDate} to ${payPeriod.endDate}`
                      : 'No active pay period saved yet.'}
                  </p>
                  <button type="submit" className="button-primary">
                    Save pay period
                  </button>
                </div>
              </form>
            </SectionShell>
          ) : null}

          {activeTab === 'bills' ? (
            <SectionShell title="Bills" description="Add bills, mark them paid, and keep them persisted locally.">
              <div className="grid gap-5">
                <form className="grid gap-4" onSubmit={handleAddBill}>
                  <div className="grid gap-4 md:grid-cols-3">
                    <Field label="Bill name">
                      <input
                        value={billDraft.name}
                        onChange={(event) => setBillDraft((current) => ({ ...current, name: event.target.value }))}
                        placeholder="Rent"
                      />
                    </Field>
                    <Field label="Amount">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={billDraft.amount}
                        onChange={(event) => setBillDraft((current) => ({ ...current, amount: event.target.value }))}
                        placeholder="1200"
                      />
                    </Field>
                    <Field label="Due date">
                      <input
                        type="date"
                        value={billDraft.dueDate}
                        onChange={(event) => setBillDraft((current) => ({ ...current, dueDate: event.target.value }))}
                      />
                    </Field>
                  </div>

                  {billError ? <FormMessage>{billError}</FormMessage> : null}

                  <div className="flex justify-end">
                    <button type="submit" className="button-primary">
                      Add bill
                    </button>
                  </div>
                </form>

                <div className="grid gap-3">
                  {bills.length === 0 ? (
                    <EmptyState
                      title="No bills yet"
                      text="Create bills above so they show up in the dashboard and stay saved in your browser."
                    />
                  ) : (
                    bills.map((bill) => (
                      <article
                        key={bill.id}
                        className="rounded-2xl border border-slate-800/80 bg-slate-950/70 p-4 shadow-lg shadow-slate-950/20"
                      >
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-3">
                              <label className="inline-flex items-center gap-2 text-sm font-medium text-white">
                                <input
                                  type="checkbox"
                                  checked={bill.isPaid}
                                  onChange={() => toggleBillPaid(bill.id)}
                                  className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-cyan-400 focus:ring-cyan-400"
                                />
                                {bill.name}
                              </label>
                              <Badge>{formatCurrency(bill.amount)}</Badge>
                              <Badge muted>
                                Due {bill.dueDate}
                              </Badge>
                              {bill.paidDate ? <Badge success>Paid {bill.paidDate}</Badge> : null}
                            </div>
                            <p className="text-sm text-slate-400">
                              {bill.isPaid ? 'This bill is counted in paid bills.' : 'This bill still counts as unpaid.'}
                            </p>
                          </div>

                          <button type="button" onClick={() => deleteBill(bill.id)} className="button-secondary">
                            Delete
                          </button>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </div>
            </SectionShell>
          ) : null}

          {activeTab === 'expenses' ? (
            <SectionShell
              title="Expenses"
              description="Log spending manually so the remaining balance stays accurate."
            >
              <div className="grid gap-5">
                <form className="grid gap-4" onSubmit={handleAddExpense}>
                  <div className="grid gap-4 md:grid-cols-3">
                    <Field label="Expense name">
                      <input
                        value={expenseDraft.name}
                        onChange={(event) =>
                          setExpenseDraft((current) => ({
                            ...current,
                            name: event.target.value,
                          }))
                        }
                        placeholder="Groceries"
                      />
                    </Field>
                    <Field label="Amount">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={expenseDraft.amount}
                        onChange={(event) =>
                          setExpenseDraft((current) => ({
                            ...current,
                            amount: event.target.value,
                          }))
                        }
                        placeholder="48.25"
                      />
                    </Field>
                    <Field label="Date">
                      <input
                        type="date"
                        value={expenseDraft.date}
                        onChange={(event) =>
                          setExpenseDraft((current) => ({
                            ...current,
                            date: event.target.value,
                          }))
                        }
                      />
                    </Field>
                  </div>

                  {expenseError ? <FormMessage>{expenseError}</FormMessage> : null}

                  <div className="flex justify-end">
                    <button type="submit" className="button-primary">
                      Add expense
                    </button>
                  </div>
                </form>

                <div className="grid gap-3">
                  {expenses.length === 0 ? (
                    <EmptyState
                      title="No expenses yet"
                      text="Add purchases here so your remaining balance updates from the manual log."
                    />
                  ) : (
                    expenses.map((expense) => (
                      <article
                        key={expense.id}
                        className="rounded-2xl border border-slate-800/80 bg-slate-950/70 p-4 shadow-lg shadow-slate-950/20"
                      >
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-3">
                              <h3 className="text-sm font-medium text-white">{expense.name}</h3>
                              <Badge>{formatCurrency(expense.amount)}</Badge>
                              <Badge muted>{expense.date}</Badge>
                            </div>
                            <p className="text-sm text-slate-400">Manual expense entry saved in local storage.</p>
                          </div>

                          <button type="button" onClick={() => deleteExpense(expense.id)} className="button-secondary">
                            Delete
                          </button>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </div>
            </SectionShell>
          ) : null}
        </section>
      </div>
    </main>
  )
}

function DashboardSection({
  totals,
  bills,
  formatCurrency,
}: {
  totals: {
    income: number
    totalBills: number
    paidBills: number
    unpaidBills: number
    totalExpenses: number
    remainingBalance: number
    safeToSpend: number
  }
  bills: Bill[]
  formatCurrency: (value: number) => string
}) {
  const hasPayPeriod = totals.income > 0

  return (
    <SectionShell
      title="Dashboard"
      description="Real totals from your active pay period, bills, and expenses."
    >
      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="grid gap-4 sm:grid-cols-2">
          <MetricCard label="Income" value={formatCurrency(totals.income)} />
          <MetricCard label="Total bills" value={formatCurrency(totals.totalBills)} />
          <MetricCard label="Paid bills" value={formatCurrency(totals.paidBills)} />
          <MetricCard label="Unpaid bills" value={formatCurrency(totals.unpaidBills)} />
          <MetricCard label="Total expenses" value={formatCurrency(totals.totalExpenses)} />
          <MetricCard
            label="Remaining balance"
            value={formatCurrency(totals.remainingBalance)}
            tone={totals.remainingBalance < 0 ? 'negative' : 'default'}
          />
        </div>

        <div className="grid gap-4">
          <div className="rounded-[1.75rem] border border-cyan-400/20 bg-[linear-gradient(180deg,rgba(8,15,27,0.98),rgba(6,10,18,0.86))] p-5 shadow-[0_24px_80px_-24px_rgba(34,211,238,0.3)]">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-cyan-200/80">Safe to spend</p>
            <p className="mt-4 text-5xl font-semibold tracking-tight text-white sm:text-6xl">
              {formatCurrency(totals.safeToSpend)}
            </p>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              This is the amount left after bills and expenses are accounted for.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Badge muted>{hasPayPeriod ? 'Active pay period saved' : 'No pay period saved yet'}</Badge>
              <Badge muted>{bills.length} bill{bills.length === 1 ? '' : 's'}</Badge>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-slate-800/80 bg-slate-950/70 p-5">
            <p className="text-sm font-medium text-white">Quick read</p>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <Row label="Income" value={formatCurrency(totals.income)} />
              <Row label="Paid bills + expenses" value={formatCurrency(totals.paidBills + totals.totalExpenses)} />
              <Row label="Remaining balance" value={formatCurrency(totals.remainingBalance)} />
            </div>
          </div>
        </div>
      </div>
    </SectionShell>
  )
}

function SectionShell({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <div className="rounded-[2rem] border border-slate-800/80 bg-slate-950/75 p-5 shadow-2xl shadow-slate-950/30 sm:p-6">
      <div className="mb-5">
        <h2 className="text-2xl font-semibold tracking-tight text-white">{title}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">{description}</p>
      </div>
      {children}
    </div>
  )
}

function MetricCard({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: string
  tone?: 'default' | 'negative'
}) {
  const valueClass =
    tone === 'negative'
      ? 'text-rose-200'
      : 'text-white'

  return (
    <div className="rounded-[1.5rem] border border-slate-800/80 bg-slate-950/65 p-4">
      <p className="text-sm text-slate-400">{label}</p>
      <p className={`mt-3 text-2xl font-semibold tracking-tight sm:text-3xl ${valueClass}`}>{value}</p>
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

function FormMessage({ children }: { children: string }) {
  return (
    <p className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200" role="alert">
      {children}
    </p>
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
  success = false,
}: {
  children: ReactNode
  muted?: boolean
  success?: boolean
}) {
  const className = success
    ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200'
    : muted
      ? 'border-slate-700 bg-slate-900/70 text-slate-300'
      : 'border-cyan-400/20 bg-cyan-400/10 text-cyan-100'

  return <span className={`rounded-full border px-3 py-1 text-xs font-medium ${className}`}>{children}</span>
}

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex min-h-10 items-center justify-center rounded-full border px-4 py-2 text-sm font-medium transition ${
        active
          ? 'border-cyan-400/30 bg-cyan-400/15 text-cyan-100 shadow-[0_0_0_1px_rgba(34,211,238,0.15)]'
          : 'border-slate-800 bg-slate-900/50 text-slate-400 hover:border-slate-700 hover:bg-slate-900 hover:text-white'
      }`}
    >
      {label}
    </button>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-800/60 bg-slate-900/40 px-3 py-2">
      <span className="text-slate-400">{label}</span>
      <span className="font-medium text-white">{value}</span>
    </div>
  )
}

export default App
