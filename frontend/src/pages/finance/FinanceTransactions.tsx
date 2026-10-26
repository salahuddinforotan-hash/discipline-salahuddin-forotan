import { useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, CalendarDays, ChevronLeft, ChevronRight, CircleAlert, FolderOpen, LoaderCircle, Pencil, Plus, ReceiptText, Search, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";

import { api, getDefaultFinanceCategories } from "../../services/api";
import type { BankAccount, FinanceCategory, FinanceEntry, FinanceEntryKind } from "../../services/api";
import { formatConfiguredDate } from "../../services/solarHijri";

const pageSize = 25;

function money(amount: number, currency: string) {
  try { return new Intl.NumberFormat("en-US", { style: "currency", currencyDisplay: "narrowSymbol", currency, maximumFractionDigits: 2 }).format(amount); }
  catch { return `${currency} ${amount.toLocaleString()}`; }
}

export default function FinanceTransactions({ kind }: { kind: FinanceEntryKind }) {
  const isIncome = kind === "income";
  const [items, setItems] = useState<FinanceEntry[]>([]);
  const [categories, setCategories] = useState<FinanceCategory[]>([]);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [accountId, setAccountId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [source, setSource] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    try {
      setLoading(true); setError("");
      const [page, categoryRows, accountRows] = await Promise.all([
        api.getFinanceTransactions({
          kind, search: search.trim() || undefined, category: category || undefined,
          account_id: accountId ? Number(accountId) : undefined,
          start_date: startDate || undefined, end_date: endDate || undefined,
          min_amount: minAmount ? Number(minAmount) : undefined,
          max_amount: maxAmount ? Number(maxAmount) : undefined,
          source: source || undefined, limit: pageSize, offset,
        }),
        api.getFinanceCategories(kind).catch(() => getDefaultFinanceCategories(kind)),
        api.getBankAccounts().catch(() => []),
      ]);
      setItems(page.items); setTotal(page.total); setCategories(categoryRows); setAccounts(accountRows);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load transactions.");
    } finally { setLoading(false); }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 180);
    return () => window.clearTimeout(timer);
  }, [kind, search, category, accountId, startDate, endDate, minAmount, maxAmount, source, offset]);

  const pageNumber = Math.floor(offset / pageSize) + 1;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  async function remove(entry: FinanceEntry) {
    const sourceNotice = "";
    if (!window.confirm(`Delete “${entry.title}”?${sourceNotice}`)) return;
    try { await api.deleteFinanceEntry(entry.id); await load(); }
    catch (deleteError) { setError(deleteError instanceof Error ? deleteError.message : "Unable to delete this transaction."); }
  }

  return <section className="space-y-5">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-sm text-slate-500">Finance / {isIncome ? "Income" : "Expenses"}</p><h2 className="mt-1 text-2xl font-semibold text-white">{isIncome ? "Income" : "Expenses"}</h2><p className="mt-2 text-sm text-slate-500">Search, filter, and manage your saved {isIncome ? "income" : "expense"} records.</p></div>
      <div className="flex flex-wrap gap-2"><Link to="/finance/categories" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/[0.08] px-3.5 text-sm font-medium text-slate-300 hover:bg-white/[0.05] hover:text-white"><FolderOpen size={15} /> Categories</Link><Link to={isIncome ? "/finance/income/new" : "/finance/expenses/new"} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-slate-950 ${isIncome ? "bg-emerald-300 hover:bg-emerald-200" : "bg-amber-200 hover:bg-amber-100"}`}><Plus size={16} /> Add {isIncome ? "income" : "expense"}</Link></div>
    </header>
    {error && <div role="alert" className="flex items-center gap-2 rounded-xl border border-rose-300/15 bg-rose-300/[0.06] px-4 py-3 text-sm text-rose-200"><CircleAlert size={16} />{error}</div>}

    <section className="rounded-2xl border border-white/[0.08] bg-white/[0.025]">
      <div className="grid gap-3 border-b border-white/[0.07] p-4 sm:p-5 md:grid-cols-2 xl:grid-cols-4">
        <label className="relative md:col-span-2 xl:col-span-2"><span className="sr-only">Search</span><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" /><input value={search} onChange={(event) => { setSearch(event.target.value); setOffset(0); }} placeholder="Search name, category, notes, or source" className="min-h-10 w-full rounded-xl border border-white/[0.08] bg-slate-950/60 pl-9 pr-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-emerald-300/30" /></label>
        <label className="block"><span className="mb-1 block text-xs font-medium text-slate-400">Category</span><select aria-label="Category" value={category} onChange={(event) => { setCategory(event.target.value); setOffset(0); }} className="min-h-10 w-full rounded-xl border border-white/[0.08] bg-slate-950/60 px-3 text-sm text-slate-200"><option value="">All categories</option>{categories.filter((item) => item.is_active).map((item) => <option key={`${item.id ?? "default"}-${item.name}`} value={item.name}>{item.name}</option>)}</select></label>
        <select aria-label="Account" value={accountId} onChange={(event) => { setAccountId(event.target.value); setOffset(0); }} className="min-h-10 rounded-xl border border-white/[0.08] bg-slate-950/60 px-3 text-sm text-slate-200"><option value="">All accounts</option>{accounts.map((item) => <option key={item.id} value={item.id}>{item.institution_name}{item.masked_account_number ? ` · ${item.masked_account_number}` : ""}</option>)}</select>
        <div className="grid grid-cols-2 gap-2"><label><span className="sr-only">From date</span><input type="date" aria-label="From date" value={startDate} onChange={(event) => { setStartDate(event.target.value); setOffset(0); }} className="min-h-10 w-full rounded-xl border border-white/[0.08] bg-slate-950/60 px-2.5 text-xs text-slate-300" /></label><label><span className="sr-only">To date</span><input type="date" aria-label="To date" value={endDate} onChange={(event) => { setEndDate(event.target.value); setOffset(0); }} className="min-h-10 w-full rounded-xl border border-white/[0.08] bg-slate-950/60 px-2.5 text-xs text-slate-300" /></label></div>
        <div className="grid grid-cols-2 gap-2"><input type="number" min="0" step="0.01" aria-label="Minimum amount" placeholder="Min amount" value={minAmount} onChange={(event) => { setMinAmount(event.target.value); setOffset(0); }} className="min-h-10 min-w-0 rounded-xl border border-white/[0.08] bg-slate-950/60 px-3 text-sm text-white placeholder:text-slate-600" /><input type="number" min="0" step="0.01" aria-label="Maximum amount" placeholder="Max amount" value={maxAmount} onChange={(event) => { setMaxAmount(event.target.value); setOffset(0); }} className="min-h-10 min-w-0 rounded-xl border border-white/[0.08] bg-slate-950/60 px-3 text-sm text-white placeholder:text-slate-600" /></div>
        <input aria-label="Transaction source" maxLength={40} placeholder="Source (e.g. manual)" value={source} onChange={(event) => { setSource(event.target.value); setOffset(0); }} className="min-h-10 rounded-xl border border-white/[0.08] bg-slate-950/60 px-3 text-sm text-white placeholder:text-slate-600" />
      </div>
      <div className="flex items-center justify-between gap-3 px-4 py-3 text-xs text-slate-500 sm:px-5"><span>{total.toLocaleString()} {isIncome ? "income entries" : "expenses"}</span><span>Dates display in Solar Hijri</span></div>

      {loading ? <div className="flex min-h-52 items-center justify-center gap-3 text-sm text-slate-400"><LoaderCircle size={17} className="animate-spin text-emerald-300" /> Loading transactions</div> : items.length === 0 ? <div className="px-5 py-14 text-center"><ReceiptText size={24} className="mx-auto text-slate-600" /><h3 className="mt-3 font-medium text-white">{total === 0 ? `No ${isIncome ? "income" : "expenses"} recorded yet.` : "No matching records."}</h3><p className="mt-1 text-sm text-slate-500">{total === 0 ? "Add a record to keep your Finance overview up to date." : "Adjust your search or filters and try again."}</p></div> : <>
        <div className="hidden grid-cols-[minmax(0,1.5fr)_minmax(90px,0.7fr)_minmax(115px,0.8fr)_minmax(145px,0.8fr)_80px] gap-3 border-y border-white/[0.06] px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-600 md:grid"><span>Description</span><span>Category</span><span>Date</span><span className="text-right">Amount</span><span /></div>
        <div className="divide-y divide-white/[0.06]">{items.map((entry) => <article key={entry.id} className="grid gap-3 px-4 py-4 transition hover:bg-white/[0.02] sm:px-5 md:grid-cols-[minmax(0,1.5fr)_minmax(90px,0.7fr)_minmax(115px,0.8fr)_minmax(145px,0.8fr)_80px] md:items-center">
          <Link to={`/finance/transactions/${entry.id}`} className="flex min-w-0 items-center gap-3"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${isIncome ? "bg-emerald-300/10 text-emerald-200" : "bg-amber-300/10 text-amber-200"}`}>{isIncome ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}</span><span className="min-w-0"><span className="block truncate text-sm font-medium text-white">{entry.title}</span><span className="mt-0.5 block truncate text-xs text-slate-500">{entry.source === "manual" ? entry.notes || "Manual entry" : `${entry.source} · ${entry.notes || "Imported transaction"}`}</span></span></Link>
          <span className="pl-12 md:pl-0"><span className={`inline-flex rounded-md px-2 py-1 text-xs font-medium ${isIncome ? "bg-emerald-300/10 text-emerald-100" : "bg-amber-300/10 text-amber-100"}`}>{entry.category || "Uncategorized"}</span>{entry.account_id && <span className="mt-1 block text-[10px] text-slate-600">{accounts.find((account) => account.id === entry.account_id)?.masked_account_number ?? "Bank account"}</span>}</span>
          <span className="flex items-center gap-1.5 pl-12 text-xs text-slate-500 md:pl-0 md:text-sm"><CalendarDays size={13} />{formatConfiguredDate(entry.entry_date)}</span>
          <span className={`pl-12 text-sm font-semibold tabular-nums md:pl-0 md:text-right ${isIncome ? "text-emerald-200" : "text-slate-200"}`}>{isIncome ? "+" : "−"}{money(entry.amount, entry.currency)}</span>
          <span className="flex gap-1 pl-12 md:justify-end md:pl-0"><Link to={`/finance/transactions/${entry.id}/edit`} title="Edit transaction" aria-label={`Edit ${entry.title}`} className="rounded-lg p-2 text-slate-500 hover:bg-white/[0.06] hover:text-white"><Pencil size={14} /></Link><button type="button" title="Delete transaction" aria-label={`Delete ${entry.title}`} onClick={() => void remove(entry)} className="rounded-lg p-2 text-slate-500 hover:bg-rose-300/10 hover:text-rose-200"><Trash2 size={14} /></button></span>
        </article>)}</div>
        <div className="flex items-center justify-between border-t border-white/[0.06] px-4 py-3 sm:px-5"><span className="text-xs text-slate-500">Page {pageNumber} of {pageCount}</span><div className="flex gap-2"><button type="button" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - pageSize))} className="flex h-9 items-center gap-1 rounded-lg border border-white/[0.08] px-3 text-xs text-slate-300 disabled:opacity-40"><ChevronLeft size={14} /> Previous</button><button type="button" disabled={offset + pageSize >= total} onClick={() => setOffset(offset + pageSize)} className="flex h-9 items-center gap-1 rounded-lg border border-white/[0.08] px-3 text-xs text-slate-300 disabled:opacity-40">Next <ChevronRight size={14} /></button></div></div>
      </>}
    </section>
  </section>;
}
