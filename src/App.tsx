function App() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-6 text-center">
        <p className="mb-3 rounded-full bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300">
          Manual budget tracker
        </p>

        <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">
          Leftly
        </h1>

        <p className="mt-4 text-xl text-slate-300">
          Know what&apos;s left.
        </p>

        <div className="mt-10 grid w-full gap-4 sm:grid-cols-4">
          <div className="rounded-2xl bg-white/10 p-5">
            <h2 className="font-semibold">Dashboard</h2>
            <p className="mt-2 text-sm text-slate-300">Coming soon</p>
          </div>

          <div className="rounded-2xl bg-white/10 p-5">
            <h2 className="font-semibold">Pay Period</h2>
            <p className="mt-2 text-sm text-slate-300">Coming soon</p>
          </div>

          <div className="rounded-2xl bg-white/10 p-5">
            <h2 className="font-semibold">Bills</h2>
            <p className="mt-2 text-sm text-slate-300">Coming soon</p>
          </div>

          <div className="rounded-2xl bg-white/10 p-5">
            <h2 className="font-semibold">Expenses</h2>
            <p className="mt-2 text-sm text-slate-300">Coming soon</p>
          </div>
        </div>
      </section>
    </main>
  );
}

export default App;
