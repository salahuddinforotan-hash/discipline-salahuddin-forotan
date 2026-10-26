import { useEffect, useMemo, useState } from "react";
import { ArrowDownLeft, ArrowRight, ArrowUpRight, BarChart3, CalendarRange, CircleAlert, FolderOpen, LoaderCircle, PiggyBank, Target, Wallet } from "lucide-react";
import { Link } from "react-router-dom";

import { api } from "../../services/api";
import type { FinanceBudget, FinanceEntry, FinanceEntryKind, FinanceMonthlyReport, FinanceMonthlyReportSummary, FinanceSavingsGoal } from "../../services/api";
import { formatConfiguredDate, formatSolarHijriMonthYear, getSolarHijriParts } from "../../services/solarHijri";

const VISIBLE_MONTHS = 12;

function money(amount: number, currency: string) {
  try { return new Intl.NumberFormat("en-US", { style: "currency", currencyDisplay: "narrowSymbol", currency, maximumFractionDigits: 2 }).format(amount); }
  catch { return `${currency} ${amount.toLocaleString()}`; }
}

function monthTotals(report: FinanceMonthlyReportSummary, currency: string) {
  const match = report.totals_by_currency.find((item) => item.currency === currency);
  return { income: match?.total_income ?? 0, expenses: match?.total_expenses ?? 0, balance: match?.balance ?? 0 };
}

function monthKey(year: number, month: number) {
  return `${year}-${month}`;
}

function compareMonthKeys(left: string, right: string) {
  const [leftYear, leftMonth] = left.split("-").map(Number);
  const [rightYear, rightMonth] = right.split("-").map(Number);
  return leftYear - rightYear || leftMonth - rightMonth;
}

function groupByCategory(entries: FinanceEntry[], kind: FinanceEntryKind, currency: string) {
  const grouped = new Map<string, { total: number; count: number }>();
  for (const entry of entries) {
    if (entry.kind !== kind || entry.currency !== currency) continue;
    const current = grouped.get(entry.category) ?? { total: 0, count: 0 };
    current.total += entry.amount;
    current.count += 1;
    grouped.set(entry.category, current);
  }
  return [...grouped.entries()].map(([category, value]) => ({ category, ...value })).sort((a, b) => b.total - a.total);
}

function Panel({ title, hint, icon: Icon, action, children }: { title: string; hint: string; icon: typeof Wallet; action?: React.ReactNode; children: React.ReactNode }) {
  return <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.025]">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] px-5 py-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.05] text-emerald-200"><Icon size={17} /></span>
        <div><h3 className="font-semibold text-white">{title}</h3><p className="mt-1 text-xs text-slate-500">{hint}</p></div>
      </div>
      {action}
    </div>
    <div className="p-5">{children}</div>
  </section>;
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-8 text-center text-sm text-slate-500">{children}</p>;
}

function CategoryBreakdown({ title, rows, currency, tone, bar }: { title: string; rows: { category: string; total: number; count: number }[]; currency: string; tone: string; bar: string }) {
  const largest = rows.length ? rows[0].total : 0;
  return <div className="space-y-3">
    <h4 className="text-sm font-semibold text-white">{title}</h4>
    {rows.length === 0 ? <EmptyNote>No records for this month.</EmptyNote> : <div className="space-y-3">{rows.map((row) => <div key={row.category}>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="truncate font-medium text-slate-200">{row.category}</span>
        <span className={`shrink-0 font-semibold tabular-nums ${tone}`}>{money(row.total, currency)}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.07]"><div className={`h-full rounded-full ${bar}`} style={{ width: `${largest > 0 ? Math.max(2, Math.round(row.total / largest * 100)) : 0}%` }} /></div>
      <p className="mt-1.5 text-xs text-slate-600">{row.count} {row.count === 1 ? "transaction" : "transactions"}</p>
    </div>)}</div>}
  </div>;
}

export default function FinanceReports() {
  const [reports, setReports] = useState<FinanceMonthlyReportSummary[]>([]);
  const [budgets, setBudgets] = useState<FinanceBudget[]>([]);
  const [savings, setSavings] = useState<FinanceSavingsGoal[]>([]);
  const [currency, setCurrency] = useState("AFN");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [showAllMonths, setShowAllMonths] = useState(false);
  const [detail, setDetail] = useState<FinanceMonthlyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");
  const [detailError, setDetailError] = useState("");

  async function load() {
    try {
      setError("");
      const [monthly, budgetList, savingsList] = await Promise.all([
        api.getFinanceMonthlyReports(),
        api.getFinanceBudgets(),
        api.getSavingsGoals(),
      ]);
      setReports(monthly);
      setBudgets(budgetList);
      setSavings(savingsList);
      const known = new Set(monthly.flatMap((report) => report.totals_by_currency.map((item) => item.currency)));
      if (known.size && !known.has("AFN")) setCurrency([...known].sort()[0]);
      if (monthly.length) setSelectedMonth(monthKey(monthly[0].solar_year, monthly[0].solar_month));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load reports.");
    } finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    if (!selectedMonth) { setDetail(null); return; }
    const [year, month] = selectedMonth.split("-").map(Number);
    if (!Number.isInteger(year) || !Number.isInteger(month)) { setDetail(null); return; }
    let live = true;
    setDetailLoading(true);
    setDetailError("");
    api.getFinanceMonthlyReport(year, month)
      .then((report) => { if (live) setDetail(report); })
      .catch((loadError: unknown) => { if (live) setDetailError(loadError instanceof Error ? loadError.message : "Unable to load this month."); })
      .finally(() => { if (live) setDetailLoading(false); });
    return () => { live = false; };
  }, [selectedMonth]);

  const currencies = useMemo(() => {
    const known = new Set<string>();
    for (const report of reports) for (const item of report.totals_by_currency) known.add(item.currency);
    for (const budget of budgets) known.add(budget.currency);
    for (const goal of savings) known.add(goal.currency);
    return [...known].sort();
  }, [reports, budgets, savings]);

  const cashFlow = useMemo(() => {
    const ascending = [...reports].reverse().map((report) => ({ report, ...monthTotals(report, currency) }));
    let running = 0;
    return ascending.map((row) => { running += row.balance; return { ...row, running }; }).reverse();
  }, [reports, currency]);

  const lifetime = useMemo(() => cashFlow.reduce(
    (accumulator, row) => ({
      income: accumulator.income + row.income,
      expenses: accumulator.expenses + row.expenses,
      balance: accumulator.balance + row.balance,
    }),
    { income: 0, expenses: 0, balance: 0 },
  ), [cashFlow]);

  const visibleMonths = showAllMonths ? cashFlow : cashFlow.slice(0, VISIBLE_MONTHS);

  const currencyBudgets = useMemo(() => budgets.filter((budget) => budget.currency === currency), [budgets, currency]);

  const savingsTrend = useMemo(() => {
    const buckets = new Map<string, { net: number; contributions: number; withdrawals: number }>();
    for (const goal of savings) {
      if (goal.currency !== currency) continue;
      for (const activity of goal.activities) {
        const { year, month } = getSolarHijriParts(activity.activity_date);
        const key = monthKey(year, month);
        const bucket = buckets.get(key) ?? { net: 0, contributions: 0, withdrawals: 0 };
        if (activity.direction === "withdrawal") { bucket.withdrawals += activity.amount; bucket.net -= activity.amount; }
        else { bucket.contributions += activity.amount; bucket.net += activity.amount; }
        buckets.set(key, bucket);
      }
    }
    let running = 0;
    return [...buckets.entries()].sort((a, b) => compareMonthKeys(a[0], b[0])).map(([key, value]) => {
      running += value.net;
      const [year, month] = key.split("-").map(Number);
      return { key, year, month, ...value, running };
    });
  }, [savings, currency]);

  const selectedDetail = detail && selectedMonth === monthKey(detail.solar_year, detail.solar_month) ? detail : null;
  const expenseCategories = selectedDetail ? groupByCategory(selectedDetail.transactions, "expense", currency) : [];
  const incomeCategories = selectedDetail ? groupByCategory(selectedDetail.transactions, "income", currency) : [];
  const selectedTotals = selectedDetail ? monthTotals(selectedDetail, currency) : null;
  const hasAnyData = currencies.length > 0;

  if (loading) return <div className="flex min-h-64 items-center justify-center gap-3 text-sm text-slate-400"><LoaderCircle size={18} className="animate-spin text-emerald-300" /> Loading reports…</div>;

  return <section className="space-y-5">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-sm text-slate-500">Finance / Reports</p>
        <h2 className="mt-1 text-2xl font-semibold text-white">Reports</h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-500">Income, spending, budgets, and savings calculated from your saved transactions and grouped by Solar Hijri month.</p>
      </div>
      {hasAnyData && <label className="flex items-center gap-2 text-sm text-slate-400"><span className="text-xs font-medium">Currency</span>
        <select value={currency} onChange={(event) => setCurrency(event.target.value)} className="min-h-10 rounded-xl border border-white/[0.08] bg-slate-950/70 px-3 text-sm text-white outline-none focus:border-emerald-300/30">
          {currencies.map((code) => <option key={code} value={code}>{code}</option>)}
        </select>
      </label>}
    </header>

    {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-300/15 bg-rose-300/[0.06] px-4 py-3 text-sm text-rose-200"><CircleAlert size={17} className="mt-0.5 shrink-0" />{error}</div>}

    {!error && !hasAnyData && <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-5 py-12 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.05] text-slate-400"><BarChart3 size={21} /></span>
      <h3 className="mt-4 font-semibold text-white">No financial data yet.</h3>
      <p className="mt-1 text-sm text-slate-500">Reports appear once you record income or expenses.</p>
      <Link to="/finance/income/new" className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-300 px-4 text-sm font-semibold text-slate-950">Add a transaction</Link>
    </div>}

    {hasAnyData && <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Total income", value: money(lifetime.income, currency), detail: `${cashFlow.length} ${cashFlow.length === 1 ? "month" : "months"} recorded`, tone: "text-emerald-200", icon: ArrowDownLeft },
          { label: "Total expenses", value: money(lifetime.expenses, currency), detail: "All recorded months", tone: "text-amber-200", icon: ArrowUpRight },
          { label: "Net balance", value: money(lifetime.balance, currency), detail: "Income minus expenses", tone: lifetime.balance < 0 ? "text-rose-200" : "text-white", icon: Wallet },
          { label: "Savings held", value: money(savings.filter((goal) => goal.currency === currency).reduce((total, goal) => total + goal.current_amount, 0), currency), detail: `${savings.filter((goal) => goal.currency === currency).length} active ${savings.filter((goal) => goal.currency === currency).length === 1 ? "target" : "targets"}`, tone: "text-sky-200", icon: PiggyBank },
        ].map(({ label, value, detail, tone, icon: Icon }) => <article key={label} className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-medium text-slate-400">{label}</h3><Icon size={17} className={tone} /></div>
          <p className={`mt-4 break-words text-xl font-semibold tracking-tight ${tone}`}>{value}</p>
          <p className="mt-1 text-xs text-slate-600">{detail}</p>
        </article>)}
      </div>

      <Panel title="Monthly cash flow" hint={`Income, spending, and running net for ${currency}`} icon={CalendarRange}
        action={cashFlow.length > VISIBLE_MONTHS ? <button type="button" onClick={() => setShowAllMonths((current) => !current)} className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-xs font-medium text-white hover:bg-white/[0.08]">{showAllMonths ? "Show last 12" : `Show all ${cashFlow.length}`}</button> : undefined}>
        {cashFlow.length === 0 ? <EmptyNote>No financial data for this currency yet.</EmptyNote> : <div className="-mx-5 -mb-5 overflow-x-auto px-5 pb-1">
          <table className="w-full min-w-[34rem] border-collapse text-sm">
            <thead><tr className="border-b border-white/[0.07] text-left text-xs text-slate-500">
              <th scope="col" className="pb-2 font-medium">Month</th>
              <th scope="col" className="pb-2 text-right font-medium">Income</th>
              <th scope="col" className="pb-2 text-right font-medium">Expenses</th>
              <th scope="col" className="pb-2 text-right font-medium">Net</th>
              <th scope="col" className="pb-2 text-right font-medium">Running net</th>
              <th scope="col" className="pb-2 text-right font-medium"><span className="sr-only">Open</span></th>
            </tr></thead>
            <tbody className="divide-y divide-white/[0.06]">
              {visibleMonths.map((row) => {
                const key = monthKey(row.report.solar_year, row.report.solar_month);
                return <tr key={key} onClick={() => setSelectedMonth(key)} className={`cursor-pointer transition hover:bg-white/[0.025] ${selectedMonth === key ? "bg-white/[0.04]" : ""}`}>
                  <th scope="row" className="py-3 pr-3 text-left font-medium text-white">{formatSolarHijriMonthYear(row.report.solar_year, row.report.solar_month)}<span className="mt-0.5 block text-xs font-normal text-slate-600">{row.report.income_count + row.report.expense_count} transactions</span></th>
                  <td className="py-3 pr-3 text-right tabular-nums text-emerald-200">{money(row.income, currency)}</td>
                  <td className="py-3 pr-3 text-right tabular-nums text-amber-100">{money(row.expenses, currency)}</td>
                  <td className={`py-3 pr-3 text-right font-semibold tabular-nums ${row.balance < 0 ? "text-rose-200" : "text-slate-100"}`}>{money(row.balance, currency)}</td>
                  <td className={`py-3 pr-3 text-right tabular-nums ${row.running < 0 ? "text-rose-200/80" : "text-slate-400"}`}>{money(row.running, currency)}</td>
                  <td className="py-3 text-right text-slate-500"><ArrowRight size={15} /></td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>}
      </Panel>

      <Panel title="Month breakdown" hint={selectedMonth ? `Spending and income by category for ${formatSolarHijriMonthYear(Number(selectedMonth.split("-")[0]), Number(selectedMonth.split("-")[1]))}` : "Select a month above"} icon={FolderOpen}
        action={selectedDetail ? <Link to={`/history/income/${selectedDetail.solar_year}/${selectedDetail.solar_month}`} className="inline-flex items-center gap-1 text-xs font-medium text-slate-300 hover:text-white">Full history <ArrowRight size={13} /></Link> : undefined}>
        {!selectedMonth ? <EmptyNote>Select a month to see its categories.</EmptyNote> : detailLoading ? <div className="flex items-center justify-center gap-3 py-10 text-sm text-slate-400"><LoaderCircle size={18} className="animate-spin text-emerald-300" /> Loading month…</div>
          : detailError ? <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-300/15 bg-rose-300/[0.06] px-4 py-3 text-sm text-rose-200"><CircleAlert size={16} className="mt-0.5 shrink-0" />{detailError}</div>
          : !selectedDetail ? <EmptyNote>No financial data for this month.</EmptyNote>
          : <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { label: "Income", value: money(selectedTotals?.income ?? 0, currency), tone: "text-emerald-200" },
                { label: "Expenses", value: money(selectedTotals?.expenses ?? 0, currency), tone: "text-amber-200" },
                { label: "Net", value: money(selectedTotals?.balance ?? 0, currency), tone: (selectedTotals?.balance ?? 0) < 0 ? "text-rose-200" : "text-white" },
              ].map((item) => <article key={item.label} className="rounded-xl border border-white/[0.08] bg-white/[0.035] p-4"><p className="text-xs font-medium text-slate-400">{item.label}</p><p className={`mt-2 break-words text-lg font-semibold tabular-nums ${item.tone}`}>{item.value}</p></article>)}
            </div>
            {selectedDetail.transactions.filter((entry) => entry.currency === currency).length === 0
              ? <EmptyNote>No {currency} transactions recorded in this month.</EmptyNote>
              : <div className="grid gap-6 lg:grid-cols-2">
                <CategoryBreakdown title="Spending by category" rows={expenseCategories} currency={currency} tone="text-amber-200" bar="bg-amber-300" />
                <CategoryBreakdown title="Income by category" rows={incomeCategories} currency={currency} tone="text-emerald-200" bar="bg-emerald-300" />
              </div>}
          </div>}
      </Panel>

      <Panel title="Budget performance" hint={`Budgeted against actual spending in ${currency}`} icon={Target}
        action={<Link to="/finance/budgets" className="inline-flex items-center gap-1 text-xs font-medium text-slate-300 hover:text-white">Manage <ArrowRight size={13} /></Link>}>
        {currencyBudgets.length === 0 ? <EmptyNote>No budgets created.</EmptyNote> : <div className="space-y-4">
          {currencyBudgets.map((budget) => <div key={budget.id}>
            <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
              <span className="font-medium text-slate-200">{budget.category}{!budget.is_active && <span className="ml-2 rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-slate-400">Inactive</span>}</span>
              <span className={`text-xs font-semibold ${budget.status === "over_budget" ? "text-rose-200" : budget.status === "approaching" ? "text-amber-200" : "text-emerald-200"}`}>{budget.percent_used}% used · {budget.status === "over_budget" ? "Over budget" : budget.status === "approaching" ? "Approaching limit" : budget.is_active ? "On track" : "Inactive"}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.07]"><div className={`h-full rounded-full ${budget.status === "over_budget" ? "bg-rose-300" : budget.status === "approaching" ? "bg-amber-300" : "bg-emerald-300"}`} style={{ width: `${Math.min(100, Math.max(0, budget.percent_used))}%` }} /></div>
            <p className="mt-1.5 text-xs text-slate-500">{money(budget.spent, budget.currency)} spent · {money(budget.remaining, budget.currency)} remaining of {money(budget.amount, budget.currency)} · {formatConfiguredDate(budget.start_date)} – {formatConfiguredDate(budget.end_date)}</p>
          </div>)}
        </div>}
      </Panel>

      <Panel title="Savings trend" hint={`Saved contributions and withdrawals in ${currency}, by month`} icon={PiggyBank}
        action={<Link to="/finance/savings" className="inline-flex items-center gap-1 text-xs font-medium text-slate-300 hover:text-white">Manage <ArrowRight size={13} /></Link>}>
        {savingsTrend.length === 0 ? <EmptyNote>No savings goals yet.</EmptyNote> : <div className="space-y-3">
          {[...savingsTrend].reverse().map((row) => <div key={row.key} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
            <div><p className="text-sm font-medium text-white">{formatSolarHijriMonthYear(row.year, row.month)}</p><p className="mt-0.5 text-xs text-slate-500">Saved {money(row.contributions, currency)}{row.withdrawals > 0 && <> · withdrew {money(row.withdrawals, currency)}</>}</p></div>
            <div className="text-right"><p className={`text-sm font-semibold tabular-nums ${row.net < 0 ? "text-rose-200" : "text-sky-200"}`}>{row.net < 0 ? "−" : "+"}{money(Math.abs(row.net), currency)}</p><p className="mt-0.5 text-xs text-slate-600">Total {money(row.running, currency)}</p></div>
          </div>)}
        </div>}
      </Panel>
    </>}
  </section>;
}
