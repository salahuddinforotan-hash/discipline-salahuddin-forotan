import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Check, CircleAlert, LoaderCircle, Pencil, PiggyBank, Plus, Trash2, X } from "lucide-react";
import { Link } from "react-router-dom";

import { api } from "../../services/api";
import type { BankAccount, FinanceBudget, FinanceCategory, FinanceEntry, FinanceEntryKind, FinanceSavingsGoal, FinancialGoal, RecurringFinanceTransaction } from "../../services/api";
import { formatConfiguredDate } from "../../services/solarHijri";

type Section = "budgets" | "savings" | "goals" | "categories" | "recurring";
type FormState = Record<string, string>;
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const firstOfMonth = () => `${todayISO().slice(0, 8)}01`;
const blankForm = (): FormState => ({ name: "", category: "", amount: "", target_amount: "", currency: "AFN", period: "monthly", start_date: firstOfMonth(), end_date: `${todayISO().slice(0, 8)}${new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()}`, deadline: "", description: "", kind: "expense", frequency: "monthly", next_occurrence: todayISO(), account_id: "", notes: "" });

function money(amount: number, currency: string) { try { return new Intl.NumberFormat("en-US", { style: "currency", currencyDisplay: "narrowSymbol", currency, maximumFractionDigits: 2 }).format(amount); } catch { return `${currency} ${amount.toLocaleString()}`; } }

const labels: Record<Section, { title: string; description: string; add: string }> = {
  budgets: { title: "Budgets", description: "Set spending limits and compare them with saved expense records.", add: "Add budget" },
  savings: { title: "Savings", description: "Track savings targets, contributions, withdrawals, and progress history.", add: "Add savings target" },
  goals: { title: "Financial goals", description: "Set a target and record each progress contribution over time.", add: "Add financial goal" },
  categories: { title: "Categories", description: "Create, rename, and archive categories while preserving old transaction labels.", add: "Add category" },
  recurring: { title: "Recurring transactions", description: "Save schedules for reference and future reminders. Schedules do not create transactions automatically.", add: "Add recurring schedule" },
};

export default function FinanceManagement({ section }: { section: Section }) {
  const [budgets, setBudgets] = useState<FinanceBudget[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<FinanceCategory[]>([]);
  const [selectedBudget, setSelectedBudget] = useState<(FinanceBudget & { expenses: FinanceEntry[] }) | null>(null);
  const [budgetDetailLoading, setBudgetDetailLoading] = useState(false);
  const [savings, setSavings] = useState<FinanceSavingsGoal[]>([]);
  const [goals, setGoals] = useState<FinancialGoal[]>([]);
  const [categories, setCategories] = useState<FinanceCategory[]>([]);
  const [recurring, setRecurring] = useState<RecurringFinanceTransaction[]>([]);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(blankForm());
  const [kindFilter, setKindFilter] = useState<FinanceEntryKind>("expense");
  const [activityTarget, setActivityTarget] = useState<{ id: number; type: "savings" | "goal" } | null>(null);
  const [activityAmount, setActivityAmount] = useState("");
  const [activityDirection, setActivityDirection] = useState<"contribution" | "withdrawal">("contribution");
  const [activityDate, setActivityDate] = useState(todayISO());
  const [activityNote, setActivityNote] = useState("");

  async function load() {
    try {
      setError("");
      if (section === "budgets") {
        const [rows, categoryRows] = await Promise.all([api.getFinanceBudgets(), api.getFinanceCategories("expense")]);
        setBudgets(rows);
        setExpenseCategories(categoryRows.filter((item) => item.is_active));
      }
      if (section === "savings") setSavings(await api.getSavingsGoals());
      if (section === "goals") setGoals(await api.getFinancialGoals());
      if (section === "categories") setCategories(await api.getFinanceCategories());
      if (section === "recurring") {
        const [scheduleRows, accountRows] = await Promise.all([api.getRecurringFinanceTransactions(), api.getBankAccounts()]);
        setRecurring(scheduleRows); setAccounts(accountRows);
      }
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : `Unable to load ${labels[section].title.toLowerCase()}.`); }
    finally { setLoading(false); }
  }

  useEffect(() => { setLoading(true); void load(); }, [section]);

  function setField(key: string, value: string) { setForm((current) => ({ ...current, [key]: value })); }
  function openNew() { setEditId(null); setForm(blankForm()); setKindFilter("expense"); setFormOpen(true); setError(""); setNotice(""); }
  function openEdit(item: FinanceBudget | FinanceSavingsGoal | FinancialGoal | FinanceCategory | RecurringFinanceTransaction) {
    setEditId("id" in item && typeof item.id === "number" ? item.id : null);
    const values = { ...blankForm() };
    if (section === "budgets") { const row = item as FinanceBudget; Object.assign(values, { category: row.category, amount: String(row.amount), currency: row.currency, period: row.period, start_date: row.start_date, end_date: row.end_date }); }
    if (section === "savings") { const row = item as FinanceSavingsGoal; Object.assign(values, { name: row.name, target_amount: String(row.target_amount), currency: row.currency, deadline: row.deadline ?? "", description: row.description ?? "" }); }
    if (section === "goals") { const row = item as FinancialGoal; Object.assign(values, { name: row.name, target_amount: String(row.target_amount), currency: row.currency, deadline: row.deadline ?? "", description: row.description ?? "" }); }
    if (section === "categories") { const row = item as FinanceCategory; Object.assign(values, { name: row.name }); setKindFilter(row.kind); }
    if (section === "recurring") { const row = item as RecurringFinanceTransaction; Object.assign(values, { name: row.name, kind: row.kind, amount: String(row.amount), currency: row.currency, category: row.category, account_id: row.account_id ? String(row.account_id) : "", frequency: row.frequency, start_date: row.start_date, end_date: row.end_date ?? "", next_occurrence: row.next_occurrence, notes: row.notes ?? "" }); setKindFilter(row.kind); }
    setForm(values); setFormOpen(true); setError(""); setNotice("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    const currency = (form.currency || "AFN").trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) { setError("Use a three-letter currency code, such as AFN."); setBusy(false); return; }
    try {
      if (section === "budgets") {
        const data = { category: form.category, amount: Number(form.amount), currency, period: form.period as FinanceBudget["period"], start_date: form.start_date, end_date: form.end_date, is_active: true };
        if (editId) await api.updateFinanceBudget(editId, data); else await api.createFinanceBudget(data);
      }
      if (section === "savings") {
        const data = { name: form.name.trim(), target_amount: Number(form.target_amount), currency, deadline: form.deadline || null, description: form.description.trim() || null };
        if (editId) await api.updateSavingsGoal(editId, data); else await api.createSavingsGoal({ ...data, initial_amount: 0 });
      }
      if (section === "goals") {
        const data = { name: form.name.trim(), target_amount: Number(form.target_amount), currency, deadline: form.deadline || null, description: form.description.trim() || null };
        if (editId) await api.updateFinancialGoal(editId, data); else await api.createFinancialGoal({ ...data, initial_amount: 0 });
      }
      if (section === "categories") {
        if (editId) await api.updateFinanceCategory(editId, { name: form.name.trim() }); else await api.createFinanceCategory({ kind: kindFilter, name: form.name.trim() });
      }
      if (section === "recurring") {
        const data = { name: form.name.trim(), kind: form.kind as FinanceEntryKind, amount: Number(form.amount), currency, category: form.category, account_id: form.account_id ? Number(form.account_id) : null, frequency: form.frequency as RecurringFinanceTransaction["frequency"], start_date: form.start_date, end_date: form.end_date || null, next_occurrence: form.next_occurrence, is_active: true, notes: form.notes.trim() || null };
        if (editId) await api.updateRecurringFinanceTransaction(editId, data); else await api.createRecurringFinanceTransaction(data);
      }
      setFormOpen(false); setNotice(editId ? "Changes saved." : "Saved successfully."); await load();
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Unable to save this information."); }
    finally { setBusy(false); }
  }

  async function remove(id: number, noun: string) {
    if (!window.confirm(`Delete this ${noun}? This will also delete its saved progress history when applicable.`)) return;
    try {
      setError("");
      if (section === "budgets") await api.deleteFinanceBudget(id);
      if (section === "savings") await api.deleteSavingsGoal(id);
      if (section === "goals") await api.deleteFinancialGoal(id);
      if (section === "categories") await api.archiveFinanceCategory(id);
      if (section === "recurring") await api.deleteRecurringFinanceTransaction(id);
      setNotice(section === "categories" ? "Category archived. Existing transaction labels are preserved." : "Removed successfully."); await load();
    } catch (removeError) { setError(removeError instanceof Error ? removeError.message : "Unable to remove this record."); }
  }

  async function openBudgetDetail(id: number) {
    try { setBudgetDetailLoading(true); setError(""); setSelectedBudget(await api.getFinanceBudget(id)); }
    catch (detailError) { setError(detailError instanceof Error ? detailError.message : "Unable to load budget details."); }
    finally { setBudgetDetailLoading(false); }
  }

  async function saveActivity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!activityTarget) return;
    try {
      setBusy(true); setError("");
      const payload = { amount: Number(activityAmount), direction: activityDirection, activity_date: activityDate, notes: activityNote.trim() || null };
      if (activityTarget.type === "savings") await api.addSavingsActivity(activityTarget.id, payload);
      else await api.addFinancialGoalProgress(activityTarget.id, payload);
      setActivityTarget(null); setActivityAmount(""); setActivityNote(""); setNotice("Progress was saved to the history."); await load();
    } catch (activityError) { setError(activityError instanceof Error ? activityError.message : "Unable to save this progress entry."); }
    finally { setBusy(false); }
  }

  const meta = labels[section];
  const headingInput = (key: string, label: string, props: { type?: string; required?: boolean; min?: string; step?: string; maxLength?: number; placeholder?: string } = {}) => <label><span className="mb-1.5 block text-sm font-medium text-slate-300">{label}</span><input type={props.type ?? "text"} required={props.required ?? true} min={props.min} step={props.step} maxLength={props.maxLength} placeholder={props.placeholder} value={form[key] ?? ""} onChange={(event) => setField(key, event.target.value)} className="min-h-10 w-full rounded-xl border border-white/[0.08] bg-slate-950/70 px-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-emerald-300/30" /></label>;

  return <section className="space-y-5">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm text-slate-500">Finance / {meta.title}</p><h2 className="mt-1 text-2xl font-semibold text-white">{meta.title}</h2><p className="mt-2 max-w-2xl text-sm text-slate-500">{meta.description}</p></div><button type="button" onClick={openNew} className="inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-xl bg-emerald-300 px-4 text-sm font-semibold text-slate-950 hover:bg-emerald-200"><Plus size={15} />{meta.add}</button></header>
    {error && <div role="alert" className="flex items-center gap-2 rounded-xl border border-rose-300/15 bg-rose-300/[0.06] px-4 py-3 text-sm text-rose-200"><CircleAlert size={16} />{error}</div>}{notice && <p role="status" className="rounded-xl border border-emerald-300/15 bg-emerald-300/[0.06] px-4 py-3 text-sm text-emerald-100">{notice}</p>}

    {formOpen && <div className="rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.025] p-4 sm:p-5"><div className="mb-4 flex items-center justify-between gap-3"><h3 className="font-semibold text-white">{editId ? "Edit" : "New"} {meta.title.toLowerCase().replace(/s$/, "")}</h3><button type="button" onClick={() => setFormOpen(false)} aria-label="Close form" className="rounded-lg p-1.5 text-slate-400 hover:bg-white/[0.06]"><X size={16} /></button></div>
      <form onSubmit={(event) => void submit(event)} className="grid gap-4 sm:grid-cols-2">
        {section === "categories" ? <>{!editId && <label><span className="mb-1.5 block text-sm font-medium text-slate-300">Category type</span><select value={kindFilter} onChange={(event) => setKindFilter(event.target.value as FinanceEntryKind)} className="min-h-10 w-full rounded-xl border border-white/[0.08] bg-slate-950 px-3 text-sm text-white"><option value="income">Income</option><option value="expense">Expense</option></select></label>}{headingInput("name", "Category name", { maxLength: 50 })}</> : null}
        {section === "budgets" && <><label><span className="mb-1.5 block text-sm font-medium text-slate-300">Category</span><select required value={form.category} onChange={(event) => setField("category", event.target.value)} className="min-h-10 w-full rounded-xl border border-white/[0.08] bg-slate-950 px-3 text-sm text-white"><option value="" disabled>Select an expense category</option>{expenseCategories.map((item) => <option key={`${item.id ?? "default"}-${item.name}`} value={item.name}>{item.name}</option>)}{form.category && !expenseCategories.some((item) => item.name === form.category) && <option value={form.category}>{form.category}</option>}</select>{expenseCategories.length === 0 && <span className="mt-1.5 block text-xs text-slate-500">No active expense categories available.</span>}</label>{headingInput("amount", "Budget amount", { type: "number", min: "0.01", step: "0.01" })}<label><span className="mb-1.5 block text-sm font-medium text-slate-300">Currency</span><input required maxLength={3} value={form.currency} onChange={(event) => setField("currency", event.target.value.toUpperCase())} className="min-h-10 w-full rounded-xl border border-white/[0.08] bg-slate-950 px-3 text-sm uppercase text-white" /></label><label><span className="mb-1.5 block text-sm font-medium text-slate-300">Period</span><select value={form.period} onChange={(event) => setField("period", event.target.value)} className="min-h-10 w-full rounded-xl border border-white/[0.08] bg-slate-950 px-3 text-sm text-white">{["weekly", "monthly", "yearly", "custom"].map((value) => <option key={value}>{value}</option>)}</select></label>{headingInput("start_date", "Start date", { type: "date" })}{headingInput("end_date", "End date", { type: "date" })}</>}
        {(section === "savings" || section === "goals") && <>{headingInput("name", "Name")}{headingInput("target_amount", "Target amount", { type: "number", min: "0.01", step: "0.01" })}<label><span className="mb-1.5 block text-sm font-medium text-slate-300">Currency</span><input required maxLength={3} value={form.currency} onChange={(event) => setField("currency", event.target.value.toUpperCase())} className="min-h-10 w-full rounded-xl border border-white/[0.08] bg-slate-950 px-3 text-sm uppercase text-white" /></label>{headingInput("deadline", "Target date (optional)", { type: "date", required: false })}<label className="sm:col-span-2"><span className="mb-1.5 block text-sm font-medium text-slate-300">Description <span className="text-slate-600">(optional)</span></span><textarea rows={2} maxLength={2000} value={form.description} onChange={(event) => setField("description", event.target.value)} className="w-full rounded-xl border border-white/[0.08] bg-slate-950 px-3 py-2.5 text-sm text-white" /></label></>}
        {section === "recurring" && <>{headingInput("name", "Schedule name")}{headingInput("amount", "Amount", { type: "number", min: "0.01", step: "0.01" })}<label><span className="mb-1.5 block text-sm font-medium text-slate-300">Type</span><select value={form.kind} onChange={(event) => setField("kind", event.target.value)} className="min-h-10 w-full rounded-xl border border-white/[0.08] bg-slate-950 px-3 text-sm text-white"><option value="expense">Expense</option><option value="income">Income</option></select></label><label><span className="mb-1.5 block text-sm font-medium text-slate-300">Currency</span><input required maxLength={3} value={form.currency} onChange={(event) => setField("currency", event.target.value.toUpperCase())} className="min-h-10 w-full rounded-xl border border-white/[0.08] bg-slate-950 px-3 text-sm uppercase text-white" /></label>{headingInput("category", "Category", { maxLength: 50 })}<label><span className="mb-1.5 block text-sm font-medium text-slate-300">Account (optional)</span><select value={form.account_id} onChange={(event) => setField("account_id", event.target.value)} className="min-h-10 w-full rounded-xl border border-white/[0.08] bg-slate-950 px-3 text-sm text-white"><option value="">No account</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.institution_name}{account.masked_account_number ? ` · ${account.masked_account_number}` : ""}</option>)}</select></label><label><span className="mb-1.5 block text-sm font-medium text-slate-300">Frequency</span><select value={form.frequency} onChange={(event) => setField("frequency", event.target.value)} className="min-h-10 w-full rounded-xl border border-white/[0.08] bg-slate-950 px-3 text-sm text-white">{["weekly", "monthly", "yearly"].map((value) => <option key={value}>{value}</option>)}</select></label>{headingInput("start_date", "Start date", { type: "date" })}{headingInput("next_occurrence", "Next occurrence", { type: "date" })}{headingInput("end_date", "End date (optional)", { type: "date", required: false })}<label className="sm:col-span-2"><span className="mb-1.5 block text-sm font-medium text-slate-300">Notes (optional)</span><textarea rows={2} value={form.notes} onChange={(event) => setField("notes", event.target.value)} className="w-full rounded-xl border border-white/[0.08] bg-slate-950 px-3 py-2.5 text-sm text-white" /></label></>}
        <div className="flex justify-end gap-2 sm:col-span-2"><button type="button" onClick={() => setFormOpen(false)} className="min-h-10 rounded-xl border border-white/[0.08] px-4 text-sm text-slate-300">Cancel</button><button type="submit" disabled={busy} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-300 px-4 text-sm font-semibold text-slate-950 disabled:opacity-50">{busy ? <LoaderCircle size={14} className="animate-spin" /> : <Check size={14} />}Save</button></div>
      </form>
    </div>}

    {activityTarget && <form onSubmit={(event) => void saveActivity(event)} className="grid gap-3 rounded-2xl border border-sky-300/15 bg-sky-300/[0.025] p-4 sm:grid-cols-2"><div className="sm:col-span-2"><h3 className="font-semibold text-white">Record {activityTarget.type === "savings" ? "savings activity" : "goal progress"}</h3><p className="mt-1 text-xs text-slate-500">This entry is saved to the progress history.</p></div><label><span className="mb-1 block text-xs text-slate-400">Amount</span><input required min="0.01" step="0.01" type="number" value={activityAmount} onChange={(event) => setActivityAmount(event.target.value)} className="min-h-10 w-full rounded-xl border border-white/[0.08] bg-slate-950 px-3 text-sm text-white" /></label><label><span className="mb-1 block text-xs text-slate-400">Contribution or withdrawal</span><select value={activityDirection} onChange={(event) => setActivityDirection(event.target.value as "contribution" | "withdrawal")} className="min-h-10 w-full rounded-xl border border-white/[0.08] bg-slate-950 px-3 text-sm text-white"><option value="contribution">Contribution</option><option value="withdrawal">Withdrawal / reduce progress</option></select></label><label><span className="mb-1 block text-xs text-slate-400">Date</span><input required type="date" value={activityDate} onChange={(event) => setActivityDate(event.target.value)} className="min-h-10 w-full rounded-xl border border-white/[0.08] bg-slate-950 px-3 text-sm text-white" /></label><label><span className="mb-1 block text-xs text-slate-400">Notes (optional)</span><input maxLength={2000} value={activityNote} onChange={(event) => setActivityNote(event.target.value)} className="min-h-10 w-full rounded-xl border border-white/[0.08] bg-slate-950 px-3 text-sm text-white" /></label><div className="flex justify-end gap-2 sm:col-span-2"><button type="button" onClick={() => setActivityTarget(null)} className="min-h-9 rounded-lg border border-white/[0.08] px-3 text-xs text-slate-300">Cancel</button><button type="submit" disabled={busy} className="min-h-9 rounded-lg bg-sky-200 px-3 text-xs font-semibold text-slate-950">Save progress</button></div></form>}

    {loading ? <div className="flex min-h-52 items-center justify-center gap-3 text-sm text-slate-400"><LoaderCircle size={17} className="animate-spin" /> Loading {meta.title.toLowerCase()}…</div> : <div className="space-y-3">
      {section === "budgets" && budgetDetailLoading && <p className="text-sm text-slate-500">Loading budget details…</p>}
      {section === "budgets" && <>{selectedBudget && <section className="rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.025] p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.06] pb-4"><div><h3 className="text-lg font-semibold text-white">{selectedBudget.category} Budget</h3><p className="mt-1 text-xs capitalize text-slate-500">{selectedBudget.period} · {formatConfiguredDate(selectedBudget.start_date)} - {formatConfiguredDate(selectedBudget.end_date)}</p></div><button type="button" onClick={() => setSelectedBudget(null)} className="rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs text-slate-300 hover:bg-white/[0.05]">Close</button></div><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4"><Metric label="Budget" value={money(selectedBudget.amount, selectedBudget.currency)} /><Metric label="Spent" value={money(selectedBudget.spent, selectedBudget.currency)} /><Metric label="Remaining" value={money(selectedBudget.remaining, selectedBudget.currency)} /><Metric label="Used" value={`${selectedBudget.percent_used}%`} /></div><div className="mt-4"><h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Included expenses</h4>{selectedBudget.expenses.length === 0 ? <p className="mt-3 text-sm text-slate-500">No expenses in this budget period for this category.</p> : <div className="mt-3 divide-y divide-white/[0.06]">{selectedBudget.expenses.map((entry) => <Link key={entry.id} to={`/finance/transactions/${entry.id}`} className="flex items-center gap-3 py-2.5 text-sm transition hover:bg-white/[0.02]"><span className="min-w-0 flex-1 truncate text-slate-200">{entry.title}</span><span className="text-xs text-slate-500">{formatConfiguredDate(entry.entry_date)}</span><span className="font-semibold tabular-nums text-amber-100">{money(entry.amount, entry.currency)}</span></Link>)}</div>}</div></section>}</>}
      {section === "budgets" && (budgets.length === 0 ? <Empty label="No budgets created." /> : budgets.map((item) => <article key={item.id} className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold text-white"><button type="button" onClick={() => void openBudgetDetail(item.id)} className="text-left hover:text-emerald-200">{item.category}</button></h3><p className="mt-1 text-xs capitalize text-slate-500">{item.period} · {formatConfiguredDate(item.start_date)} - {formatConfiguredDate(item.end_date)}</p></div><Actions onEdit={() => openEdit(item)} onDelete={() => void remove(item.id, "budget")} /></div><div className="mt-4 grid grid-cols-3 gap-3 text-xs sm:text-sm"><Metric label="Budget" value={money(item.amount, item.currency)} /><Metric label="Spent" value={money(item.spent, item.currency)} /><Metric label="Remaining" value={money(item.remaining, item.currency)} /></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.07]"><div className={`h-full rounded-full ${item.status === "over_budget" ? "bg-rose-300" : item.status === "approaching" ? "bg-amber-300" : "bg-emerald-300"}`} style={{ width: `${Math.min(100, Math.max(0, item.percent_used))}%` }} /></div><p className="mt-2 text-xs text-slate-500">{item.percent_used}% used · <span className="capitalize">{item.status.replaceAll("_", " ")}</span>{item.is_active ? "" : " · inactive"}</p></article>))}
      {section === "savings" && (savings.length === 0 ? <Empty label="No savings goals yet." /> : savings.map((item) => <article key={item.id} className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-200/[0.08] text-sky-100"><PiggyBank size={19} /></span><div><h3 className="font-semibold text-white">{item.name}</h3><p className="mt-1 text-xs text-slate-500">{item.deadline ? `Target ${formatConfiguredDate(item.deadline)}` : "No target date"}</p></div></div><Actions onEdit={() => openEdit(item)} onDelete={() => void remove(item.id, "savings goal")} /></div><ProgressBar current={item.current_amount} target={item.target_amount} currency={item.currency} progress={item.progress} /><div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-slate-500">{item.activities.length} saved progress entries</p><button type="button" onClick={() => { setActivityTarget({ id: item.id, type: "savings" }); setActivityDirection("contribution"); }} className="rounded-lg border border-white/[0.08] px-3 py-2 text-xs font-medium text-slate-200 hover:bg-white/[0.05]">Add contribution</button></div>{item.description && <p className="mt-3 text-sm text-slate-400">{item.description}</p>}</article>))}
      {section === "goals" && (goals.length === 0 ? <Empty label="No financial goals yet." /> : goals.map((item) => <article key={item.id} className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold text-white">{item.name}</h3><p className="mt-1 text-xs text-slate-500">{item.deadline ? `Deadline ${formatConfiguredDate(item.deadline)}` : "No deadline"}{item.is_completed ? " · Completed" : ""}</p></div><Actions onEdit={() => openEdit(item)} onDelete={() => void remove(item.id, "financial goal")} /></div><ProgressBar current={item.current_amount} target={item.target_amount} currency={item.currency} progress={item.progress} /><div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-slate-500">{item.progress_history.length} progress entries</p><div className="flex gap-2"><button type="button" onClick={() => void api.updateFinancialGoal(item.id, { is_completed: !item.is_completed }).then(load).catch((e: Error) => setError(e.message))} className="rounded-lg border border-white/[0.08] px-3 py-2 text-xs text-slate-300">{item.is_completed ? "Reopen" : "Mark complete"}</button><button type="button" onClick={() => { setActivityTarget({ id: item.id, type: "goal" }); setActivityDirection("contribution"); }} className="rounded-lg bg-emerald-300 px-3 py-2 text-xs font-semibold text-slate-950">Add progress</button></div></div>{item.description && <p className="mt-3 text-sm text-slate-400">{item.description}</p>}</article>))}
      {section === "categories" && (categories.length === 0 ? <Empty label="No categories available." /> : <div className="grid gap-4 lg:grid-cols-2">{(["income", "expense"] as const).map((kind) => <section key={kind} className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4"><h3 className="mb-3 text-sm font-semibold capitalize text-slate-200">{kind} categories</h3><div className="divide-y divide-white/[0.06]">{categories.filter((item) => item.kind === kind).map((item) => <div key={`${item.id ?? "default"}-${item.name}`} className="flex items-center justify-between gap-2 py-2.5"><span className={`min-w-0 truncate text-sm ${item.is_active ? "text-slate-200" : "text-slate-600 line-through"}`}>{item.name}{item.is_default && <span className="ml-2 text-[10px] text-slate-600">default</span>}</span>{item.id !== null && <Actions onEdit={() => openEdit(item)} onDelete={() => void remove(item.id!, "category")} />}</div>)}</div></section>)}</div>)}
      {section === "recurring" && (recurring.length === 0 ? <Empty label="No recurring schedules yet." /> : recurring.map((item) => <article key={item.id} className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold text-white">{item.name}</h3><p className="mt-1 text-xs capitalize text-slate-500">{item.kind} · {item.category} · {item.frequency}</p></div><Actions onEdit={() => openEdit(item)} onDelete={() => void remove(item.id, "recurring schedule")} /></div><div className="mt-4 flex flex-wrap items-baseline justify-between gap-3"><p className="text-lg font-semibold text-slate-100">{money(item.amount, item.currency)}</p><p className="text-xs text-slate-400">Next: {formatConfiguredDate(item.next_occurrence)}</p></div><div className="mt-3 flex items-center justify-between gap-3 border-t border-white/[0.06] pt-3"><span className="text-xs text-slate-500">{item.is_active ? "Active schedule" : "Inactive"} · No transaction is created automatically</span><button type="button" onClick={() => void api.updateRecurringFinanceTransaction(item.id, { is_active: !item.is_active }).then(load).catch((e: Error) => setError(e.message))} className="text-xs text-slate-300 hover:text-white">{item.is_active ? "Pause" : "Activate"}</button></div></article>))}
    </div>}
  </section>;
}

function Empty({ label }: { label: string }) { return <div className="rounded-2xl border border-dashed border-white/[0.08] px-5 py-12 text-center text-sm text-slate-500">{label}</div>; }
function Metric({ label, value }: { label: string; value: string }) { return <div className="min-w-0"><span className="block text-slate-500">{label}</span><span className="mt-1 block break-words font-semibold text-slate-200">{value}</span></div>; }
function Actions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) { return <div className="flex shrink-0 gap-1"><button type="button" onClick={onEdit} aria-label="Edit" className="rounded-lg p-2 text-slate-500 hover:bg-white/[0.06] hover:text-white"><Pencil size={14} /></button><button type="button" onClick={onDelete} aria-label="Delete or archive" className="rounded-lg p-2 text-slate-500 hover:bg-rose-300/10 hover:text-rose-200"><Trash2 size={14} /></button></div>; }
function ProgressBar({ current, target, currency, progress }: { current: number; target: number; currency: string; progress: number }) { return <div className="mt-5"><div className="flex flex-wrap items-baseline justify-between gap-2"><span className="font-semibold text-sky-100">{money(current, currency)} <span className="text-xs font-normal text-slate-500">saved</span></span><span className="text-xs text-slate-400">of {money(target, currency)} · {progress}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.07]"><div className="h-full rounded-full bg-sky-200" style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} /></div></div>; }
