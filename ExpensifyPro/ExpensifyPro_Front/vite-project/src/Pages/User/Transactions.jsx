import { useEffect, useMemo, useState } from "react";
import { apiService } from "../../api";

const COLORS = {
  income: "text-emerald-700",
  expense: "text-red-600",
  transfer: "text-indigo-600",
};

const tidy = (s) => (s ? s[0].toUpperCase() + s.slice(1) : "-");
const fmtMoney = (v, currency = "USD") =>
  new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 })
    .format(Number(v || 0));

export default function Transactions() {
  // Data
  const [rows, setRows] = useState([]);
  const [info, setInfo] = useState({ current_page: 1, total_pages: 1, total_items: 0 });
  const [filters, setFilters] = useState({ page: 1, page_size: 10, q: "", type: undefined, account_id: undefined, date_from: "", date_to: "" });
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // Accounts for filters/forms
  const [accounts, setAccounts] = useState([]);
  const accountsMap = useMemo(() => {
    const m = new Map();
    for (const a of accounts) m.set(a.id, a.name);
    return m;
  }, [accounts]);
  const accountById = useMemo(() => {
    const m = new Map();
    for (const a of accounts) m.set(a.id, a);
    return m;
  }, [accounts]);
  useEffect(() => {
    (async () => {
      try {
        const acc = await apiService.getAccounts({ page: 1, page_size: 100 });
        setAccounts(acc?.results ?? []);
      } catch {
        setAccounts([]);
      }
    })();
  }, []);

  // Debounced search
  useEffect(() => { setSearchInput(filters.q || ""); }, []);
  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => ({ ...f, q: searchInput, page: 1 })), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Fetch transactions
  useEffect(() => {
    let ignore = false;
    (async () => {
      setLoading(true); setErr("");
      try {
        const res = await apiService.getTransactions(filters);
        if (ignore) return;
        setRows(res?.results ?? []);
        setInfo(res?.info ?? { current_page: 1, total_pages: 1, total_items: 0 });
      } catch (e) {
        if (ignore) return;
        setErr(e?.message || "Failed to load transactions");
        setRows([]); setInfo({ current_page: 1, total_pages: 1, total_items: 0 });
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, [filters.page, filters.page_size, filters.q, filters.type, filters.account_id, filters.date_from, filters.date_to]);

  const pages = useMemo(() => {
    const arr = [];
    const start = Math.max(1, info.current_page - 2);
    const end = Math.min(info.total_pages, start + 4);
    for (let p = start; p <= end; p++) arr.push(p);
    return arr;
  }, [info]);

  // Page stats (based on rows)
  const pageCurrency = rows[0]?.currency || "USD";
  const totals = useMemo(() => {
    let income = 0, expense = 0, transfer = 0;
    for (const r of rows) {
      const amt = Number(r.amount || 0);
      if (r.type === "income") income += amt;
      else if (r.type === "expense") expense += Math.abs(amt);
      else if (r.type === "transfer") transfer += Math.abs(amt);
    }
    return { income, expense, net: income - expense, transfer };
  }, [rows]);

  const fmtDate = (iso) =>
    iso ? new Date(iso).toLocaleString(undefined, { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "-";

  // Create modal
  const [addOpen, setAddOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [addForm, setAddForm] = useState({ type: "expense", amount: "", currency: "USD", description: "", date: "", account: "", to_account: "" });
  const currentUserId = (() => { try { return JSON.parse(localStorage.getItem("exp_user") || "{}").id || null; } catch { return null; } })();

  const onCreate = async () => {
    if (!addForm.type) return;
    if (addForm.amount === "" || Number.isNaN(Number(addForm.amount))) { setErr("Enter a valid amount"); return; }
    if (!addForm.account) { setErr("Select an account"); return; }
    if (!addForm.date) { setErr("Select a date/time"); return; }
    if (addForm.type === "transfer" && !addForm.to_account) { setErr("Select a destination account"); return; }

    if (!currentUserId) { setErr("Missing user session"); return; }
    setCreating(true); setErr("");
    try {
      const payload = {
        type: addForm.type,
        amount: Number(addForm.amount),
        currency: (addForm.currency || "USD").toUpperCase().slice(0,3),
        description: addForm.description || undefined,
        date: new Date(addForm.date).toISOString(),
        user: currentUserId,
        account: Number(addForm.account),
        to_account: addForm.type === "transfer" ? Number(addForm.to_account) : undefined,
      };
      await apiService.createTransaction(payload);
      // Adjust account balances (client-side convenience)
      try {
        await applyTxEffect(payload, +1);
      } catch { /* ignore balance errors */ }
      setAddOpen(false);
      setAddForm({ type: "expense", amount: "", currency: "USD", description: "", date: "", account: "", to_account: "" });
      // refresh
      setFilters((f) => ({ ...f }));
    } catch (e) {
      setErr(e?.message || "Failed to create transaction");
    } finally {
      setCreating(false);
    }
  };

  // Edit/Delete
  const [editing, setEditing] = useState(null); // transaction row
  const [editForm, setEditForm] = useState({ type: "expense", amount: "", currency: "USD", description: "", date: "", account: "", to_account: "" });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const onOpenEdit = (t) => {
    setEditing(t);
    setEditForm({
      type: t.type || "expense",
      amount: t.amount ?? "",
      currency: (t.currency || "USD").toUpperCase(),
      description: t.description || "",
      date: t.date ? new Date(t.date).toISOString().slice(0,16) : "",
      account: t.account_id || "",
      to_account: t.to_account_id || "",
    });
  };

  const onSaveEdit = async () => {
    if (!editing) return;
    if (editForm.amount === "" || Number.isNaN(Number(editForm.amount))) { setErr("Enter a valid amount"); return; }
    if (!editForm.account) { setErr("Select an account"); return; }
    if (!editForm.date) { setErr("Select a date/time"); return; }
    if (editForm.type === "transfer" && !editForm.to_account) { setErr("Select a destination account"); return; }
    setSaving(true); setErr("");
    try {
      const payload = {
        type: editForm.type,
        amount: Number(editForm.amount),
        currency: (editForm.currency || "USD").toUpperCase().slice(0,3),
        description: editForm.description || undefined,
        date: new Date(editForm.date).toISOString(),
        account: Number(editForm.account),
        to_account: editForm.type === "transfer" ? Number(editForm.to_account) : undefined,
      };
      await apiService.updateTransaction(editing.id, payload);
      // apply diff: inverse old, then new
      try {
        await applyTxEffect(editing, -1);
        await applyTxEffect(payload, +1);
      } catch { /* ignore balance errors */ }
      setEditing(null);
      setFilters((f) => ({ ...f }));
    } catch (e) {
      setErr(e?.message || "Failed to update transaction");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (id) => {
    if (!confirm("Delete this transaction?")) return;
    setDeletingId(id);
    setErr("");
    try {
      await apiService.deleteTransaction(id);
      // if we still have the row, apply inverse effect locally
      const old = rows.find((r) => r.id === id);
      if (old) {
        try { await applyTxEffect(old, -1); } catch {}
      }
      const isLast = rows.length === 1 && info.current_page > 1;
      setFilters((f) => ({ ...f, page: isLast ? info.current_page - 1 : info.current_page }));
      if (!isLast) setFilters((f) => ({ ...f }));
    } catch (e) {
      setErr(e?.message || "Failed to delete transaction");
    } finally {
      setDeletingId(null);
    }
  };

  // ---- Helper: adjust account balances and notify Accounts tab ----
  const applyTxEffect = async (tx, mult) => {
    // tx can be original row or our payload shape
    const type = tx.type;
    const amt = Number(tx.amount || 0) * (isNaN(Number(tx.amount)) ? 0 : 1);
    if (!amt) return;
    const deltas = new Map();
    if (type === "expense") {
      if (tx.account) deltas.set(Number(tx.account), -(amt * mult));
      if (tx.account_id) deltas.set(Number(tx.account_id), -(amt * mult));
    } else if (type === "income") {
      if (tx.account) deltas.set(Number(tx.account), +(amt * mult));
      if (tx.account_id) deltas.set(Number(tx.account_id), +(amt * mult));
    } else if (type === "transfer") {
      const fromId = Number(tx.account || tx.account_id);
      const toId = Number(tx.to_account || tx.to_account_id);
      if (fromId) deltas.set(fromId, -(amt * mult));
      if (toId) deltas.set(toId, +(amt * mult));
    }

    // push updates to server; update local cache too
    for (const [id, delta] of deltas.entries()) {
      const acc = accountById.get(id);
      if (!acc) continue;
      const before = Number(acc.balance || 0);
      const after = before + delta;
      try {
        await apiService.updateAccount(id, { balance: after });
      } catch { /* ignore */ }
      acc.balance = after; // mutate local cache for immediate UI usage
    }
    try { localStorage.setItem("accounts:refresh", String(Date.now())); } catch {}
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Transactions</h1>
          <p className="text-gray-600 text-sm">Review and add your transactions.</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search description"
            className="h-9 w-56 rounded-xl border border-gray-300 px-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <select
            value={filters.page_size}
            onChange={(e) => setFilters((f) => ({ ...f, page_size: Number(e.target.value), page: 1 }))}
            className="h-9 rounded-xl border border-gray-300 px-2 text-sm"
          >
            {[5,10,20,50].map(n => <option key={n} value={n}>{n}/page</option>)}
          </select>
          <button
            onClick={() => setAddOpen(true)}
            className="h-9 rounded-xl bg-indigo-600 px-3 text-sm font-medium text-white hover:bg-indigo-700"
          >
            + Add Transaction
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-gray-200 bg-white p-3">
          <div className="text-xs text-gray-600">Income (page)</div>
          <div className="mt-1 text-lg font-semibold text-emerald-700">{fmtMoney(totals.income, pageCurrency)}</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-3">
          <div className="text-xs text-gray-600">Expense (page)</div>
          <div className="mt-1 text-lg font-semibold text-red-600">{fmtMoney(totals.expense, pageCurrency)}</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-3">
          <div className="text-xs text-gray-600">Net (page)</div>
          <div className={`mt-1 text-lg font-semibold ${totals.net >= 0 ? "text-emerald-700" : "text-red-600"}`}>{fmtMoney(totals.net, pageCurrency)}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          {[
            { v: undefined, label: "All" },
            { v: "income", label: "Income" },
            { v: "expense", label: "Expense" },
            { v: "transfer", label: "Transfer" },
          ].map(opt => (
            <button
              key={String(opt.v ?? "all")}
              onClick={() => setFilters((f) => ({ ...f, type: opt.v, page: 1 }))}
              className={`rounded-xl px-3 py-1.5 text-xs border ${ (filters.type ?? undefined) === opt.v ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-gray-300 hover:bg-gray-50"}`}
            >{opt.label}</button>
          ))}
          {(filters.type ?? undefined) !== undefined && (
            <button onClick={() => setFilters((f) => ({ ...f, type: undefined, page: 1 }))} className="rounded-xl px-3 py-1.5 text-xs border border-gray-300 hover:bg-gray-50">Clear</button>
          )}

          <div className="h-6 w-px bg-gray-200 mx-1" />
          <select
            value={filters.account_id || ""}
            onChange={(e) => setFilters((f) => ({ ...f, account_id: e.target.value ? Number(e.target.value) : undefined, page: 1 }))}
            className="h-9 rounded-xl border border-gray-300 px-2 text-sm"
          >
            <option value="">All accounts</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>

          <div className="h-6 w-px bg-gray-200 mx-1" />
          <input
            type="date"
            value={filters.date_from || ""}
            onChange={(e) => setFilters((f) => ({ ...f, date_from: e.target.value || undefined, page: 1 }))}
            className="h-9 rounded-xl border border-gray-300 px-2 text-sm"
          />
          <span className="text-xs text-gray-500">to</span>
          <input
            type="date"
            value={filters.date_to || ""}
            onChange={(e) => setFilters((f) => ({ ...f, date_to: e.target.value || undefined, page: 1 }))}
            className="h-9 rounded-xl border border-gray-300 px-2 text-sm"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        {loading ? (
          <div className="text-sm text-gray-600">Loading…</div>
        ) : err ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500">
                    <th className="py-2">Date</th>
                    <th className="py-2">Description</th>
                    <th className="py-2">Account</th>
                    <th className="py-2">Type</th>
                    <th className="py-2 text-right">Amount</th>
                    <th className="py-2">Currency</th>
                    <th className="py-2">Project</th>
                    <th className="py-2">Category</th>
                    <th className="py-2">Status</th>
                    <th className="py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((t) => {
                    const color = COLORS[t.type] || "";
                    const sign = t.type === "expense" ? "-" : t.type === "income" ? "+" : "±";
                    return (
                      <tr key={t.id} className="border-t">
                        <td className="py-2">{fmtDate(t.date)}</td>
                        <td className="py-2">{t.description || "-"}</td>
                        <td className="py-2">{accountsMap.get(t.account_id) || t.account_id || "-"}</td>
                        <td className="py-2">{tidy(t.type)}</td>
                        <td className={`py-2 text-right ${color}`}>{sign}{fmtMoney(t.amount, t.currency || pageCurrency)}</td>
                        <td className="py-2">{t.currency || pageCurrency}</td>
                        <td className="py-2">{t.project_id || "-"}</td>
                        <td className="py-2">{t.category_id || "-"}</td>
                        <td className="py-2">{tidy(t.status) || "-"}</td>
                        <td className="py-2">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => onOpenEdit(t)} className="rounded-xl border px-3 py-1 text-xs hover:bg-gray-50">Edit</button>
                            <button onClick={() => onDelete(t.id)} disabled={deletingId === t.id} className={`rounded-xl px-3 py-1 text-xs text-white ${deletingId === t.id ? "bg-red-300" : "bg-red-600 hover:bg-red-700"}`}>{deletingId === t.id ? "Deleting…" : "Delete"}</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {rows.length === 0 && (
                    <tr>
                      <td className="py-6 text-center text-gray-500" colSpan={9}>No transactions found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="mt-4 flex items-center justify-between text-sm">
              <div className="text-gray-600">Showing page <span className="font-medium">{info.current_page}</span> of {info.total_pages}</div>
              <div className="flex items-center gap-2">
                <button className="rounded-xl border px-3 py-1 hover:bg-gray-50" onClick={() => setFilters((f) => ({ ...f, page: Math.max(1, info.current_page - 1) }))} disabled={info.current_page <= 1}>Prev</button>
                {pages.map((p) => (
                  <button key={p} onClick={() => setFilters((f) => ({ ...f, page: p }))} className={`rounded-xl px-3 py-1 border ${p === info.current_page ? "bg-indigo-600 text-white border-indigo-600" : "hover:bg-gray-50"}`}>{p}</button>
                ))}
                <button className="rounded-xl border px-3 py-1 hover:bg-gray-50" onClick={() => setFilters((f) => ({ ...f, page: Math.min(info.total_pages, info.current_page + 1) }))} disabled={info.current_page >= info.total_pages}>Next</button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Create modal */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setAddOpen(false)} />
          <div className="relative w-full max-w-2xl rounded-2xl border border-gray-200 bg-white p-5 shadow-lg">
            <h3 className="text-base font-semibold">Add Transaction</h3>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <label className="block text-gray-700 mb-1">Type</label>
                <select value={addForm.type} onChange={(e) => setAddForm((f) => ({ ...f, type: e.target.value }))} className="w-full rounded-xl border border-gray-300 px-3 py-2">
                  <option value="income">Addition (+)</option>
                  <option value="expense">Expense</option>
                  <option value="transfer">Transfer</option>
                </select>
              </div>
              <div>
                <label className="block text-gray-700 mb-1">Amount</label>
                <input type="number" step="0.01" value={addForm.amount} onChange={(e) => setAddForm((f) => ({ ...f, amount: e.target.value }))} className="w-full rounded-xl border border-gray-300 px-3 py-2" />
              </div>
              <div>
                <label className="block text-gray-700 mb-1">Currency</label>
                <input value={addForm.currency}
                readOnly
                aria-readonly="true"
                onChange={(e) => setAddForm((f) => ({ ...f, currency: e.target.value.toUpperCase().slice(0,3) }))} className="w-full rounded-xl border border-gray-300 px-3 py-2" />
              </div>
              <div>
                <label className="block text-gray-700 mb-1">Date</label>
                <input type="datetime-local" value={addForm.date} onChange={(e) => setAddForm((f) => ({ ...f, date: e.target.value }))} className="w-full rounded-xl border border-gray-300 px-3 py-2" />
              </div>
              <div>
                <label className="block text-gray-700 mb-1">Account</label>
                <select value={addForm.account} onChange={(e) => setAddForm((f) => ({ ...f, account: e.target.value }))} className="w-full rounded-xl border border-gray-300 px-3 py-2">
                  <option value="">Select account</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              {addForm.type === "transfer" && (
                <div>
                  <label className="block text-gray-700 mb-1">To Account</label>
                  <select value={addForm.to_account} onChange={(e) => setAddForm((f) => ({ ...f, to_account: e.target.value }))} className="w-full rounded-xl border border-gray-300 px-3 py-2">
                    <option value="">Select destination</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              )}
              <div className="sm:col-span-2">
                <label className="block text-gray-700 mb-1">Description</label>
                <input value={addForm.description} onChange={(e) => setAddForm((f) => ({ ...f, description: e.target.value }))} className="w-full rounded-xl border border-gray-300 px-3 py-2" placeholder="Optional" />
              </div>
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button onClick={() => setAddOpen(false)} className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50">Cancel</button>
              <button onClick={onCreate} disabled={creating} className={`rounded-xl px-3 py-2 text-sm text-white ${creating ? "bg-indigo-300" : "bg-indigo-600 hover:bg-indigo-700"}`}>{creating ? "Creating…" : "Create"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setEditing(null)} />
          <div className="relative w-full max-w-2xl rounded-2xl border border-gray-200 bg-white p-5 shadow-lg">
            <h3 className="text-base font-semibold">Edit Transaction</h3>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <label className="block text-gray-700 mb-1">Type</label>
                <select value={editForm.type} onChange={(e) => setEditForm((f) => ({ ...f, type: e.target.value }))} className="w-full rounded-xl border border-gray-300 px-3 py-2">
                  <option value="income">Addition (+)</option>
                  <option value="expense">Expense</option>
                  <option value="transfer">Transfer</option>
                </select>
              </div>
              <div>
                <label className="block text-gray-700 mb-1">Amount</label>
                <input type="number" step="0.01" value={editForm.amount} onChange={(e) => setEditForm((f) => ({ ...f, amount: e.target.value }))} className="w-full rounded-xl border border-gray-300 px-3 py-2" />
              </div>
              <div>
                <label className="block text-gray-700 mb-1">Currency</label>
                <input value={editForm.currency} 
                readOnly
                aria-readonly="true"
                onChange={(e) => setEditForm((f) => ({ ...f, currency: e.target.value.toUpperCase().slice(0,3) }))} className="w-full rounded-xl border border-gray-300 px-3 py-2" />

              </div>
              <div>
                <label className="block text-gray-700 mb-1">Date</label>
                <input type="datetime-local" value={editForm.date} onChange={(e) => setEditForm((f) => ({ ...f, date: e.target.value }))} className="w-full rounded-xl border border-gray-300 px-3 py-2" />
              </div>
              <div>
                <label className="block text-gray-700 mb-1">Account</label>
                <select value={editForm.account} onChange={(e) => setEditForm((f) => ({ ...f, account: e.target.value }))} className="w-full rounded-xl border border-gray-300 px-3 py-2">
                  <option value="">Select account</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              {editForm.type === "transfer" && (
                <div>
                  <label className="block text-gray-700 mb-1">To Account</label>
                  <select value={editForm.to_account} onChange={(e) => setEditForm((f) => ({ ...f, to_account: e.target.value }))} className="w-full rounded-xl border border-gray-300 px-3 py-2">
                    <option value="">Select destination</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              )}
              <div className="sm:col-span-2">
                <label className="block text-gray-700 mb-1">Description</label>
                <input value={editForm.description} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} className="w-full rounded-xl border border-gray-300 px-3 py-2" placeholder="Optional" />
              </div>
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button onClick={() => setEditing(null)} className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50">Cancel</button>
              <button onClick={onSaveEdit} disabled={saving} className={`rounded-xl px-3 py-2 text-sm text-white ${saving ? "bg-indigo-300" : "bg-indigo-600 hover:bg-indigo-700"}`}>{saving ? "Saving…" : "Save"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
