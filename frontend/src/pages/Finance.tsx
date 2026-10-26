import { useEffect, useState } from "react";
import { ArrowDownLeft, ArrowRight, ArrowUpRight, Banknote, CircleAlert, LoaderCircle, Plus, Wallet } from "lucide-react";
import { Link } from "react-router-dom";

import { api } from "../services/api";
import type { FinanceOverview } from "../services/api";
import { formatSolarHijriMonthYear } from "../services/solarHijri";

function money(amount: number, currency: string) {
  try { return new Intl.NumberFormat("en-US", { style: "currency", currencyDisplay: "narrowSymbol", currency, maximumFractionDigits: 2 }).format(amount); }
  catch { return `${currency} ${amount.toLocaleString()}`; }
}

function totals(items: Array<{ currency: string; amount: number }>) {
  return items.length ? items.map((item) => money(item.amount, item.currency)).join(" · ") : "—";
}

export default function Finance() {
  const [overview, setOverview] = useState<FinanceOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    try {
      setError("");
      const summary = await api.getFinanceOverview();
      setOverview(summary);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load Finance.");
    } finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  const hasData = Boolean(overview && [overview.current_balances, overview.month_income, overview.month_expenses, overview.savings_total].some((items) => items.length));
  const monthLabel = overview ? formatSolarHijriMonthYear(overview.solar_year, overview.solar_month) : "This month";

  if (loading) return <div className="flex min-h-64 items-center justify-center gap-3 text-sm text-slate-400"><LoaderCircle size={18} className="animate-spin text-emerald-300" /> Loading your financial overview…</div>;

  return <section className="space-y-6">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-sm font-medium text-slate-400">Overview · {monthLabel}</p><h2 className="mt-1 text-2xl font-semibold text-white">Your money, in focus</h2><p className="mt-2 max-w-xl text-sm text-slate-500">A clear view of recorded balances, monthly activity, savings, and budgets.</p></div>
      <div className="flex flex-wrap gap-2">
        <Link to="/finance/income/new" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-300 px-4 text-sm font-semibold text-slate-950 transition hover:bg-emerald-200"><Plus size={16} /> Add income</Link>
        <Link to="/finance/expenses/new" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-white transition hover:bg-white/[0.08]"><Plus size={16} /> Add expense</Link>
      </div>
    </header>

    {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-300/15 bg-rose-300/[0.06] px-4 py-3 text-sm text-rose-200"><CircleAlert size={17} className="mt-0.5 shrink-0" />{error}</div>}

    {!error && !hasData && <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-5 py-12 text-center"><span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.05] text-slate-400"><Wallet size={21} /></span><h3 className="mt-4 font-semibold text-white">No financial data yet.</h3><p className="mt-1 text-sm text-slate-500">Add an income or expense to start your overview.</p><Link to="/finance/income/new" className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-300 px-4 text-sm font-semibold text-slate-950"><Plus size={15} /> Add a transaction</Link></div>}

    {overview && <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { title: "Recorded balance", value: totals(overview.current_balances), icon: Wallet, tone: "text-white", detail: "Income minus expenses, by currency" },
          { title: "Income this month", value: totals(overview.month_income), icon: ArrowDownLeft, tone: "text-emerald-200", detail: monthLabel },
          { title: "Expenses this month", value: totals(overview.month_expenses), icon: ArrowUpRight, tone: "text-amber-200", detail: monthLabel },
          { title: "Savings", value: totals(overview.savings_total), icon: Banknote, tone: "text-sky-200", detail: "Across active savings targets" },
        ].map(({ title, value, icon: Icon, tone, detail }) => <article key={title} className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 sm:p-5"><div className="flex items-center justify-between gap-3"><h3 className="text-sm font-medium text-slate-400">{title}</h3><Icon size={17} className={tone} /></div><p className={`mt-4 break-words text-xl font-semibold tracking-tight ${tone}`}>{value}</p><p className="mt-1 text-xs text-slate-600">{detail}</p></article>)}
      </div>

        <section className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5"><div className="flex items-center justify-between"><div><h3 className="font-semibold text-white">Budget status</h3><p className="mt-1 text-xs text-slate-500">Current active budgets</p></div><Link to="/finance/budgets" aria-label="Manage budgets" className="rounded-lg p-2 text-slate-400 hover:bg-white/[0.06] hover:text-white"><ArrowRight size={16} /></Link></div>
          {overview.budget_status.length === 0 ? <p className="py-9 text-center text-sm text-slate-500">No active budget for today.</p> : <div className="mt-4 space-y-4">{overview.budget_status.slice(0, 5).map((budget) => <div key={budget.id}><div className="flex items-center justify-between gap-3 text-sm"><span className="truncate font-medium text-slate-200">{budget.category}</span><span className="shrink-0 text-xs text-slate-400">{budget.percent_used}%</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.07]"><div className={`h-full rounded-full ${budget.status === "over_budget" ? "bg-rose-300" : budget.status === "approaching" ? "bg-amber-300" : "bg-emerald-300"}`} style={{ width: `${Math.min(100, Math.max(0, budget.percent_used))}%` }} /></div><p className="mt-1.5 text-xs text-slate-500">{money(budget.spent, budget.currency)} spent of {money(budget.amount, budget.currency)}</p></div>)}</div>}
        </section>
    </>}
  </section>;
}
