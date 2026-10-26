import { useEffect, useState } from "react";
import { ArrowLeft, Check, CircleAlert, LoaderCircle } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { api, getDefaultFinanceCategories } from "../../services/api";
import type { BankAccount, FinanceCategory, FinanceEntryKind } from "../../services/api";
import { formatConfiguredDate } from "../../services/solarHijri";

function todayISO() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export default function FinanceTransactionForm({ initialKind }: { initialKind?: FinanceEntryKind }) {
  const { transactionId } = useParams();
  const navigate = useNavigate();
  const editing = Boolean(transactionId);
  const [kind, setKind] = useState<FinanceEntryKind>(initialKind ?? "expense");
  const [categories, setCategories] = useState<FinanceCategory[]>([]);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("AFN");
  const [entryDate, setEntryDate] = useState(todayISO());
  const [accountId, setAccountId] = useState("");
  const [source, setSource] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    void Promise.all([
      api.getFinanceCategories().catch(() => getDefaultFinanceCategories()),
      api.getBankAccounts().catch(() => []),
      editing ? api.getFinanceTransaction(Number(transactionId)) : Promise.resolve(null),
    ]).then(([categoryRows, accountRows, entry]) => {
      if (!live) return;
      setCategories(categoryRows); setAccounts(accountRows);
      if (entry) {
        setKind(entry.kind); setTitle(entry.title); setCategory(entry.category);
        setAmount(String(entry.amount)); setCurrency(entry.currency);
        setEntryDate(entry.entry_date);
        setAccountId(entry.account_id ? String(entry.account_id) : "");
        setSource(entry.source === "manual" ? "" : entry.source); setNotes(entry.notes ?? "");
      }
    }).catch((loadError: unknown) => {
      if (live) setError(loadError instanceof Error ? loadError.message : "Unable to load the transaction form.");
    }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [editing, transactionId]);

  const activeCategories = categories.filter((item) => item.kind === kind && item.is_active);

  const visibleCategories = category && !activeCategories.some((item) => item.name === category)
    ? [{ id: null, kind, name: category, is_active: true, is_default: false }, ...activeCategories]
    : activeCategories;

  function changeKind(nextKind: FinanceEntryKind) {
    setKind(nextKind);
    if (!editing) setCategory("");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) { setError("Enter an amount greater than zero."); return; }
    if (!/^[A-Z]{3}$/.test(currency.trim().toUpperCase())) { setError("Currency must be a three-letter code, such as AFN."); return; }
    try {
      setSaving(true);
      const payload = { kind, title: title.trim(), category, amount: numericAmount, currency: currency.trim().toUpperCase(), entry_date: entryDate, account_id: accountId ? Number(accountId) : null, source: source.trim() || "manual", notes: notes.trim() || null };
      if (editing) await api.updateFinanceEntry(Number(transactionId), payload);
      else await api.createFinanceEntry(payload);
      navigate(editing ? `/finance/transactions/${transactionId}` : kind === "income" ? "/finance/income" : "/finance/expenses");
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Unable to save this transaction."); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="flex min-h-60 items-center justify-center gap-3 text-sm text-slate-400"><LoaderCircle size={17} className="animate-spin" /> Loading transaction…</div>;

  return <section className="mx-auto max-w-3xl space-y-5">
    <div><Link to={editing ? `/finance/transactions/${transactionId}` : kind === "income" ? "/finance/income" : "/finance/expenses"} className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"><ArrowLeft size={15} /> Back</Link><p className="mt-4 text-xs font-semibold uppercase tracking-wider text-emerald-200">{editing ? "Edit record" : "New record"}</p><h2 className="mt-1 text-2xl font-semibold text-white">{editing ? "Edit transaction" : kind === "income" ? "Add income" : "Add expense"}</h2></div>
    <form onSubmit={(event) => void submit(event)} className="space-y-5 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 sm:p-6">
      {!editing && <fieldset><legend className="mb-2 text-sm font-medium text-slate-300">Transaction type</legend><div className="grid grid-cols-2 gap-2">{(["income", "expense"] as const).map((type) => <button key={type} type="button" onClick={() => changeKind(type)} className={`min-h-10 rounded-xl border text-sm font-medium capitalize ${kind === type ? type === "income" ? "border-emerald-200/30 bg-emerald-200/10 text-emerald-100" : "border-amber-200/30 bg-amber-200/10 text-amber-100" : "border-white/[0.08] text-slate-400"}`}>{type}</button>)}</div></fieldset>}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="sm:col-span-2"><span className="mb-1.5 block text-sm font-medium text-slate-300">Description</span><input required maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} placeholder={kind === "income" ? "e.g. Monthly salary" : "e.g. Groceries"} className="min-h-11 w-full rounded-xl border border-white/[0.08] bg-slate-950/70 px-3.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-emerald-300/30" /></label>
        <label><span className="mb-1.5 block text-sm font-medium text-slate-300">Amount</span><input required type="number" min="0.01" step="0.01" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" className="min-h-11 w-full rounded-xl border border-white/[0.08] bg-slate-950/70 px-3.5 text-sm text-white outline-none focus:border-emerald-300/30" /></label>
        <label><span className="mb-1.5 block text-sm font-medium text-slate-300">Currency</span><input required maxLength={3} minLength={3} value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} placeholder="AFN" className="min-h-11 w-full rounded-xl border border-white/[0.08] bg-slate-950/70 px-3.5 text-sm uppercase text-white outline-none focus:border-emerald-300/30" /></label>
        <label><span className="mb-1.5 block text-sm font-medium text-slate-300">Category <span className="text-rose-200">*</span></span><select required value={category} onChange={(event) => setCategory(event.target.value)} className="min-h-11 w-full rounded-xl border border-white/[0.08] bg-slate-950/70 px-3.5 text-sm text-white outline-none focus:border-emerald-300/30"><option value="" disabled>Choose a {kind} category</option>{visibleCategories.map((item) => <option key={`${item.id ?? "default"}-${item.name}`} value={item.name}>{item.name}</option>)}</select><span className="mt-1 block text-xs text-slate-500">Choose the category that best describes this {kind}.</span></label>
        <label><span className="mb-1.5 block text-sm font-medium text-slate-300">Date</span><input required type="date" value={entryDate} onChange={(event) => setEntryDate(event.target.value)} className="min-h-11 w-full rounded-xl border border-white/[0.08] bg-slate-950/70 px-3.5 text-sm text-white outline-none focus:border-emerald-300/30" /><span className="mt-1 block text-xs text-slate-500">{entryDate ? formatConfiguredDate(entryDate) : "Solar Hijri display"}</span></label>
        <label><span className="mb-1.5 block text-sm font-medium text-slate-300">Account <span className="text-slate-600">(optional)</span></span><select value={accountId} onChange={(event) => setAccountId(event.target.value)} className="min-h-11 w-full rounded-xl border border-white/[0.08] bg-slate-950/70 px-3.5 text-sm text-white outline-none focus:border-emerald-300/30"><option value="">No account</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.institution_name}{account.masked_account_number ? ` · ${account.masked_account_number}` : ""}</option>)}</select></label>
        <label><span className="mb-1.5 block text-sm font-medium text-slate-300">Source <span className="text-slate-600">(optional)</span></span><input maxLength={40} value={source} onChange={(event) => setSource(event.target.value)} placeholder="Who paid it, e.g. Employer, Client ABC" className="min-h-11 w-full rounded-xl border border-white/[0.08] bg-slate-950/70 px-3.5 text-sm text-white outline-none focus:border-emerald-300/30" /></label>
        <label className="sm:col-span-2"><span className="mb-1.5 block text-sm font-medium text-slate-300">Notes <span className="text-slate-600">(optional)</span></span><textarea rows={3} maxLength={2000} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Add details for your records" className="w-full resize-y rounded-xl border border-white/[0.08] bg-slate-950/70 px-3.5 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-emerald-300/30" /></label>
      </div>
      {error && <p role="alert" className="flex items-center gap-2 rounded-xl border border-rose-300/15 bg-rose-300/[0.06] px-3 py-2.5 text-sm text-rose-200"><CircleAlert size={15} />{error}</p>}
      <div className="flex justify-end gap-2 border-t border-white/[0.06] pt-4"><Link to={editing ? `/finance/transactions/${transactionId}` : kind === "income" ? "/finance/income" : "/finance/expenses"} className="inline-flex min-h-10 items-center rounded-xl border border-white/[0.08] px-4 text-sm text-slate-300 hover:bg-white/[0.04]">Cancel</Link><button type="submit" disabled={saving || !category} className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-slate-950 disabled:opacity-50 ${kind === "income" ? "bg-emerald-300 hover:bg-emerald-200" : "bg-amber-200 hover:bg-amber-100"}`}>{saving ? <LoaderCircle size={15} className="animate-spin" /> : <Check size={15} />}{saving ? "Saving…" : "Save transaction"}</button></div>
    </form>
  </section>;
}
