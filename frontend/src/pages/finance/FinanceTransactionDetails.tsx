import { useEffect, useState } from "react";
import { ArrowDownLeft, ArrowLeft, ArrowUpRight, CircleAlert, LoaderCircle, Pencil, Trash2 } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { api } from "../../services/api";
import type { FinanceEntry } from "../../services/api";
import { formatConfiguredDate } from "../../services/solarHijri";

function money(amount: number, currency: string) {
  try { return new Intl.NumberFormat("en-US", { style: "currency", currencyDisplay: "narrowSymbol", currency, maximumFractionDigits: 2 }).format(amount); }
  catch { return `${currency} ${amount.toLocaleString()}`; }
}

function timeLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default function FinanceTransactionDetails() {
  const { transactionId } = useParams();
  const navigate = useNavigate();
  const [entry, setEntry] = useState<FinanceEntry | null>(null);
  const [accountLabel, setAccountLabel] = useState("No account linked");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    void api.getFinanceTransaction(Number(transactionId)).then((value) => {
      if (!live) return;
      setEntry(value);
      if (value.account_id) {
        void api.getBankAccount(value.account_id).then((account) => {
          if (live) setAccountLabel(`${account.institution_name}${account.masked_account_number ? ` · ${account.masked_account_number}` : ""}`);
        }).catch(() => { if (live) setAccountLabel("Linked bank account"); });
      }
    }).catch((loadError: unknown) => {
      if (live) setError(loadError instanceof Error ? loadError.message : "Unable to load this transaction.");
    }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [transactionId]);

  async function remove() {
    if (!entry || !window.confirm(`Delete "${entry.title}"?`)) return;
    try { await api.deleteFinanceEntry(entry.id); navigate(entry.kind === "income" ? "/finance/income" : "/finance/expenses", { replace: true }); }
    catch (deleteError) { setError(deleteError instanceof Error ? deleteError.message : "Unable to delete this transaction."); }
  }

  if (loading) return <div className="flex min-h-60 items-center justify-center gap-3 text-sm text-slate-400"><LoaderCircle size={17} className="animate-spin" /> Loading transaction…</div>;
  if (!entry) return <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-6"><Link to="/finance" className="inline-flex items-center gap-2 text-sm text-slate-300"><ArrowLeft size={15} /> Finance overview</Link><p role="alert" className="mt-5 flex items-center gap-2 text-sm text-rose-200"><CircleAlert size={16} />{error || "Transaction not found."}</p></div>;
  const isIncome = entry.kind === "income";

  return <section className="mx-auto max-w-3xl space-y-5">
    <Link to={isIncome ? "/finance/income" : "/finance/expenses"} className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"><ArrowLeft size={15} /> Back to {isIncome ? "income" : "expenses"}</Link>
    <article className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.025]">
      <div className="flex flex-col gap-4 border-b border-white/[0.07] p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6"><div className="flex items-center gap-3"><span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${isIncome ? "bg-emerald-300/10 text-emerald-200" : "bg-amber-200/10 text-amber-100"}`}>{isIncome ? <ArrowDownLeft size={22} /> : <ArrowUpRight size={22} />}</span><div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{isIncome ? "Income" : "Expense"} · {entry.category}</p><h2 className="mt-1 text-xl font-semibold text-white">{entry.title}</h2></div></div><div className="flex gap-2"><Link to={`/finance/transactions/${entry.id}/edit`} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/[0.08] px-3 text-sm text-slate-200 hover:bg-white/[0.05]"><Pencil size={14} /> Edit</Link><button type="button" onClick={() => void remove()} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-rose-200/10 px-3 text-sm text-rose-200 hover:bg-rose-300/[0.08]"><Trash2 size={14} /> Delete</button></div></div>
      <div className="p-5 sm:p-6"><p className={`text-3xl font-semibold tracking-tight ${isIncome ? "text-emerald-200" : "text-white"}`}>{isIncome ? "+" : "−"}{money(entry.amount, entry.currency)}</p><dl className="mt-6 grid gap-x-8 gap-y-5 sm:grid-cols-2">{[
        ["Date", formatConfiguredDate(entry.entry_date)],
        ["Category", entry.category],
        ["Account", accountLabel],
        ["Source", entry.source && entry.source !== "manual" ? entry.source : "Not specified"],
        ["Created", timeLabel(entry.created_at)],
        ["Last updated", timeLabel(entry.updated_at)],
      ].map(([label, value]) => <div key={label}><dt className="text-xs font-medium text-slate-500">{label}</dt><dd className="mt-1 break-words text-sm text-slate-200">{value}</dd></div>)}</dl>{entry.notes && <div className="mt-6 border-t border-white/[0.06] pt-5"><h3 className="text-xs font-medium text-slate-500">Notes</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-300">{entry.notes}</p></div>}</div>
    </article>
    {error && <p role="alert" className="flex items-center gap-2 rounded-xl border border-rose-300/15 bg-rose-300/[0.06] px-4 py-3 text-sm text-rose-200"><CircleAlert size={16} />{error}</p>}
  </section>;
}
