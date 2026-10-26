import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import { ArrowDownLeft, ArrowLeft, ArrowUpRight, CircleAlert, FileSpreadsheet, Landmark, LoaderCircle, RefreshCw, ShieldCheck, Trash2, Upload, X } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { api } from "../../services/api";
import type { BankAccount, BankStatementPreview, BankTransaction, FinanceEntryKind } from "../../services/api";
import { formatConfiguredDate } from "../../services/solarHijri";

function money(amount: number, currency: string) { try { return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount); } catch { return `${currency} ${amount.toLocaleString()}`; } }

export default function BankAccounts() {
  const { accountId } = useParams();
  const navigate = useNavigate();
  const selectedAccountId = accountId ? Number(accountId) : null;
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [account, setAccount] = useState<BankAccount | null>(null);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [connectionMessage, setConnectionMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [accountName, setAccountName] = useState("Azizi Bank account");
  const [lastFour, setLastFour] = useState("");
  const [preview, setPreview] = useState<BankStatementPreview | null>(null);
  const [selectedRows, setSelectedRows] = useState<number[]>([]);
  const [kind, setKind] = useState<FinanceEntryKind | "all">("all");
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  async function loadAccounts() {
    const [rows, status] = await Promise.all([api.getBankAccounts(), api.getAziziConnectionStatus()]);
    setAccounts(rows); setConnectionMessage(status.message);
    if (selectedAccountId) {
      const current = await api.getBankAccount(selectedAccountId);
      const txns = await api.getBankTransactions(selectedAccountId, { kind: kind === "all" ? undefined : kind, search: search.trim() || undefined, start_date: startDate || undefined, end_date: endDate || undefined });
      setAccount(current); setTransactions(txns);
    } else { setAccount(null); setTransactions([]); }
  }

  useEffect(() => {
    let live = true;
    setLoading(true); setError("");
    void loadAccounts().catch((loadError: unknown) => { if (live) setError(loadError instanceof Error ? loadError.message : "Unable to load bank accounts."); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [selectedAccountId, kind, search, startDate, endDate]);

  const existingAccountId = useMemo(() => accounts.find((item) => item.account_name.trim().toLowerCase() === accountName.trim().toLowerCase() && (item.masked_account_number ?? "").endsWith(lastFour))?.id, [accounts, accountName, lastFour]);

  async function previewFile() {
    if (!file) { setError("Choose a CSV statement first."); return; }
    try { setBusy(true); setError(""); setPreview(null); const result = await api.previewAziziStatement(file, existingAccountId); setPreview(result); setSelectedRows(result.rows.filter((row) => !row.duplicate).map((row) => row.row_number)); }
    catch (previewError) { setError(previewError instanceof Error ? previewError.message : "Unable to preview this statement."); }
    finally { setBusy(false); }
  }

  async function importFile() {
    if (!file || selectedRows.length === 0) { setError("Select at least one new transaction to import."); return; }
    try { setBusy(true); setError(""); const result = await api.importAziziStatement(file, accountName.trim(), lastFour, selectedRows); setNotice(result.message); setImportOpen(false); setPreview(null); setFile(null); setSelectedRows([]); await loadAccounts(); if (!selectedAccountId) navigate(`/finance/bank-accounts/${result.account.id}`); }
    catch (importError) { setError(importError instanceof Error ? importError.message : "Unable to import this statement."); }
    finally { setBusy(false); }
  }

  async function syncAccount(id: number) {
    try { setBusy(true); setError(""); const result = await api.syncBankAccount(id); setNotice(result.message); }
    catch (syncError) { setError(syncError instanceof Error ? syncError.message : "Unable to check synchronization."); }
    finally { setBusy(false); }
  }

  async function disconnect(id: number) {
    if (!window.confirm("Disconnect this bank account? Previously imported transactions will stay in Finance.")) return;
    try { await api.disconnectBankAccount(id); setNotice("Account disconnected. Imported transactions are preserved."); await loadAccounts(); }
    catch (disconnectError) { setError(disconnectError instanceof Error ? disconnectError.message : "Unable to disconnect this account."); }
  }

  function chooseFile(event: ChangeEvent<HTMLInputElement>) { setFile(event.target.files?.[0] ?? null); setPreview(null); setSelectedRows([]); }

  if (loading) return <div className="flex min-h-56 items-center justify-center gap-3 text-sm text-slate-400"><LoaderCircle size={17} className="animate-spin text-emerald-200" /> Loading bank accounts…</div>;

  return <section className="space-y-5">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm text-slate-500">Finance / Bank accounts</p><h2 className="mt-1 text-2xl font-semibold text-white">Bank accounts</h2><p className="mt-2 max-w-2xl text-sm text-slate-500">Import authorized CSV statements, review transactions, and link them to Finance records.</p></div><button type="button" onClick={() => { setImportOpen(true); setError(""); setNotice(""); }} className="inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-xl bg-emerald-300 px-4 text-sm font-semibold text-slate-950 hover:bg-emerald-200"><Upload size={15} /> Import statement</button></header>
    {error && <p role="alert" className="flex items-center gap-2 rounded-xl border border-rose-300/15 bg-rose-300/[0.06] px-4 py-3 text-sm text-rose-200"><CircleAlert size={16} />{error}</p>}{notice && <p role="status" className="rounded-xl border border-emerald-300/15 bg-emerald-300/[0.06] px-4 py-3 text-sm text-emerald-100">{notice}</p>}

    {selectedAccountId && account ? <>
      <Link to="/finance/bank-accounts" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"><ArrowLeft size={15} /> All bank accounts</Link>
      <article className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/[0.05] text-slate-200"><Landmark size={20} /></span><div><h3 className="font-semibold text-white">{account.account_name}</h3><p className="mt-1 text-xs text-slate-500">{account.institution_name} · {account.masked_account_number ?? "Account number not saved"}</p></div></div><div className="flex gap-2"><button type="button" disabled={busy} onClick={() => void syncAccount(account.id)} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-white/[0.08] px-3 text-xs text-slate-300"><RefreshCw size={13} /> Check sync status</button><button type="button" onClick={() => void disconnect(account.id)} className="rounded-lg p-2 text-slate-500 hover:bg-rose-300/10 hover:text-rose-200" aria-label="Disconnect account"><Trash2 size={14} /></button></div></div><div className="mt-5 grid gap-3 border-t border-white/[0.06] pt-4 sm:grid-cols-3"><div><p className="text-xs text-slate-500">Balance</p><p className="mt-1 text-sm font-medium text-slate-200">{account.current_balance == null ? "Unavailable from statement import" : money(account.current_balance, account.currency)}</p></div><div><p className="text-xs text-slate-500">Connection</p><p className="mt-1 text-sm capitalize text-slate-200">{account.status.replaceAll("_", " ")}</p></div><div><p className="text-xs text-slate-500">Last imported</p><p className="mt-1 text-sm text-slate-200">{account.last_imported_at ? formatConfiguredDate(account.last_imported_at.slice(0, 10)) : "Never"}</p></div></div></article>
      <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.025]"><div className="flex flex-col gap-3 border-b border-white/[0.06] p-4 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-semibold text-white">Imported transactions</h3><p className="mt-1 text-xs text-slate-500">Original bank statement records and linked Finance entries</p></div><label className="relative"><span className="sr-only">Search statement records</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search description" className="min-h-9 rounded-lg border border-white/[0.08] bg-slate-950/60 px-3 text-xs text-white placeholder:text-slate-600" /></label></div><div className="flex flex-wrap gap-2 border-b border-white/[0.06] p-3">{(["all", "income", "expense"] as const).map((value) => <button key={value} type="button" onClick={() => setKind(value)} className={`rounded-lg px-3 py-1.5 text-xs capitalize ${kind === value ? "bg-white text-slate-950" : "text-slate-400 hover:bg-white/[0.05]"}`}>{value}</button>)}<input type="date" aria-label="From date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="min-h-8 rounded-lg border border-white/[0.08] bg-slate-950/60 px-2 text-xs text-slate-300" /><input type="date" aria-label="To date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="min-h-8 rounded-lg border border-white/[0.08] bg-slate-950/60 px-2 text-xs text-slate-300" /></div>{transactions.length === 0 ? <p className="px-5 py-12 text-center text-sm text-slate-500">No transactions match these filters.</p> : <div className="divide-y divide-white/[0.06]">{transactions.map((txn) => <article key={txn.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5 sm:px-5"><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${txn.transaction_type === "income" ? "bg-emerald-300/10 text-emerald-200" : "bg-amber-300/10 text-amber-200"}`}>{txn.transaction_type === "income" ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-white">{txn.description}</p><p className="mt-0.5 text-xs text-slate-500">{txn.category} · {formatConfiguredDate(txn.transaction_date)}</p></div><span className="text-sm font-semibold text-slate-200">{txn.transaction_type === "income" ? "+" : "−"}{money(txn.amount, txn.currency)}</span>{txn.finance_entry_id && <Link to={`/finance/transactions/${txn.finance_entry_id}`} className="text-xs text-emerald-200 hover:text-white">View Finance record</Link>}</article>)}</div>}</section>
    </> : accounts.length === 0 ? <div className="rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.015] px-5 py-12 text-center"><span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.05] text-slate-400"><Landmark size={21} /></span><h3 className="mt-4 font-semibold text-white">No bank accounts connected</h3><p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-slate-500">{connectionMessage || "Direct synchronization is unavailable. Import an authorized CSV statement to add bank transactions."}</p><button type="button" onClick={() => setImportOpen(true)} className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-300 px-4 text-sm font-semibold text-slate-950"><Upload size={15} /> Import bank statement</button></div> : <div className="grid gap-3 md:grid-cols-2">{accounts.map((item) => <article key={item.id} className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5"><div className="flex items-start justify-between gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.05] text-slate-200"><Landmark size={18} /></span><span className="rounded-full bg-slate-300/[0.06] px-2.5 py-1 text-[10px] capitalize text-slate-400">{item.status.replaceAll("_", " ")}</span></div><h3 className="mt-4 font-semibold text-white">{item.account_name}</h3><p className="mt-1 text-xs text-slate-500">{item.institution_name} · {item.masked_account_number ?? "Account number not saved"}</p><div className="mt-4 flex items-baseline justify-between gap-3"><span className="text-xs text-slate-500">Balance</span><span className="text-sm font-medium text-slate-200">{item.current_balance == null ? "Unavailable" : money(item.current_balance, item.currency)}</span></div><p className="mt-2 text-xs text-slate-600">Last imported: {item.last_imported_at ? formatConfiguredDate(item.last_imported_at.slice(0, 10)) : "Never"}</p><div className="mt-4 flex gap-2"><Link to={`/finance/bank-accounts/${item.id}`} className="min-h-9 flex-1 rounded-lg border border-white/[0.08] px-3 py-2 text-center text-xs font-medium text-slate-200 hover:bg-white/[0.05]">View transactions</Link><button type="button" disabled={busy} onClick={() => void syncAccount(item.id)} className="rounded-lg border border-white/[0.08] px-3 text-xs text-slate-300 disabled:opacity-50">Sync status</button></div></article>)}</div>}

    <aside className="flex items-start gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3"><ShieldCheck size={17} className="mt-0.5 shrink-0 text-emerald-200" /><p className="text-xs leading-relaxed text-slate-400">Discipline will never ask for your AziPay MPIN, OTP, card PIN, CVV, or banking password. Direct Azizi synchronization is not enabled in this installation. A CSV import does not execute transfers.</p></aside>

    {importOpen && <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/75 p-3 backdrop-blur-sm sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget) setImportOpen(false); }}><section role="dialog" aria-modal="true" aria-labelledby="bank-import-title" className="my-auto max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/[0.1] bg-slate-900 shadow-2xl"><header className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4"><div><p className="text-xs font-semibold uppercase tracking-wider text-emerald-200">Azizi Bank · CSV</p><h3 id="bank-import-title" className="mt-1 font-semibold text-white">Import bank statement</h3></div><button type="button" onClick={() => setImportOpen(false)} aria-label="Close" className="rounded-lg p-2 text-slate-400 hover:bg-white/[0.06]"><X size={16} /></button></header><div className="space-y-4 p-5"><p className="flex items-start gap-2 rounded-xl border border-sky-200/10 bg-sky-200/[0.035] p-3 text-xs leading-relaxed text-slate-300"><FileSpreadsheet size={15} className="mt-0.5 shrink-0 text-sky-200" />Expected CSV columns: date, description, amount, type or debit/credit; optional currency, category, reference. A reference is hashed for duplicate detection and is not saved.</p><div className="grid gap-3 sm:grid-cols-2"><label><span className="mb-1.5 block text-xs font-medium text-slate-300">Account name</span><input value={accountName} maxLength={100} onChange={(event) => setAccountName(event.target.value)} className="min-h-10 w-full rounded-xl border border-white/[0.08] bg-slate-950 px-3 text-sm text-white" /></label><label><span className="mb-1.5 block text-xs font-medium text-slate-300">Last four digits (optional)</span><input inputMode="numeric" pattern="[0-9]{4}" maxLength={4} value={lastFour} onChange={(event) => setLastFour(event.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="1234" className="min-h-10 w-full rounded-xl border border-white/[0.08] bg-slate-950 px-3 text-sm text-white placeholder:text-slate-600" /></label></div><label className="block rounded-xl border border-dashed border-white/[0.1] p-4"><span className="mb-2 block text-xs font-medium text-slate-300">CSV file</span><input type="file" accept=".csv,text/csv" onChange={chooseFile} className="block w-full text-xs text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-white/[0.07] file:px-3 file:py-2 file:text-xs file:font-medium file:text-slate-200" />{file && <p className="mt-2 text-xs text-slate-500">{file.name} · {(file.size / 1024).toFixed(0)} KB</p>}</label><button type="button" onClick={() => void previewFile()} disabled={busy || !file} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/[0.08] px-4 text-sm font-medium text-slate-200 disabled:opacity-50">{busy ? <LoaderCircle size={15} className="animate-spin" /> : <FileSpreadsheet size={15} />} Preview statement</button>
      {preview && <div className="space-y-3"><div className="flex items-center justify-between gap-3"><h4 className="text-sm font-semibold text-white">Preview · select records to import</h4><button type="button" onClick={() => setSelectedRows(preview.rows.filter((row) => !row.duplicate).map((row) => row.row_number))} className="text-xs text-emerald-200">Select new rows</button></div>{preview.invalid_rows.length > 0 && <div className="max-h-24 overflow-y-auto rounded-lg border border-amber-300/10 bg-amber-300/[0.04] p-2 text-xs text-amber-100">{preview.invalid_rows.map((message) => <p key={message}>{message}</p>)}</div>}<div className="max-h-64 overflow-auto rounded-xl border border-white/[0.07]"><table className="w-full min-w-[36rem] text-left text-xs"><thead className="sticky top-0 bg-slate-900 text-slate-500"><tr><th className="p-2">Import</th><th>Date</th><th>Description</th><th>Type</th><th className="p-2 text-right">Amount</th></tr></thead><tbody className="divide-y divide-white/[0.05]">{preview.rows.map((row) => <tr key={row.row_number} className={row.duplicate ? "opacity-45" : ""}><td className="p-2"><input aria-label={`Select row ${row.row_number}`} type="checkbox" disabled={row.duplicate} checked={selectedRows.includes(row.row_number)} onChange={(event) => setSelectedRows((current) => event.target.checked ? [...current, row.row_number] : current.filter((value) => value !== row.row_number))} /></td><td>{formatConfiguredDate(row.transaction_date)}</td><td className="max-w-48 truncate">{row.description}{row.duplicate && <span className="ml-1 text-amber-200">duplicate</span>}</td><td className="capitalize">{row.transaction_type}</td><td className="p-2 text-right">{money(row.amount, row.currency)}</td></tr>)}</tbody></table></div><p className="text-xs text-slate-500">{selectedRows.length} selected · {preview.rows.filter((row) => row.duplicate).length} duplicate(s) detected</p></div>}
      <footer className="flex flex-wrap justify-end gap-2 border-t border-white/[0.06] pt-4"><button type="button" onClick={() => setImportOpen(false)} className="min-h-9 rounded-lg border border-white/[0.08] px-3 text-xs text-slate-300">Cancel</button><button type="button" onClick={() => void importFile()} disabled={!preview || busy || selectedRows.length === 0} className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-emerald-300 px-3 text-xs font-semibold text-slate-950 disabled:opacity-40">{busy && <LoaderCircle size={13} className="animate-spin" />}Import selected</button></footer></div></section></div>}
  </section>;
}
