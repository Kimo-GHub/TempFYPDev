import { useEffect, useMemo, useState } from "react";
import { Wallet, CreditCard, Banknote, Landmark, Star } from "lucide-react";
import { apiService } from "../../api";

const TYPE_LABELS = {
  cash: "Cash",
  bank: "Bank",
  credit_card: "Credit Card",
  wallet: "Wallet",
  other: "Other",
};

export default function Accounts() {
  const [rows, setRows] = useState([]);
  const [info, setInfo] = useState({ current_page: 1, total_pages: 1, total_items: 0 });
  const [filters, setFilters] = useState({ page: 1, page_size: 10, q: "" });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // local search debounce
  const [searchInput, setSearchInput] = useState("");
  useEffect(() => { setSearchInput(filters.q || ""); }, []);
  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => ({ ...f, q: searchInput, page: 1 })), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const fetchData = async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await apiService.getAccounts(filters);
      setRows(res?.results ?? []);
      setInfo(res?.info ?? { current_page: 1, total_pages: 1, total_items: 0 });
    } catch (e) {
      // Graceful when backend not running
      setErr(e?.message || "Failed to load accounts");
      setRows([]);
      setInfo({ current_page: 1, total_pages: 1, total_items: 0 });
    } finally {
      setLoading(false);
    }
  };

  // listen for cross-tab/account-updates notifications
  useEffect(() => {
    const onStorage = (e) => {
      if (e && e.key === "accounts:refresh") fetchData();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.page, filters.page_size, filters.q, filters.type]);

  const onChangePage = (page) => {
    if (page < 1 || page > info.total_pages) return;
    setFilters((f) => ({ ...f, page }));
  };

  const pages = useMemo(() => {
    const arr = [];
    const { current_page, total_pages } = info;
    const start = Math.max(1, current_page - 2);
    const end = Math.min(total_pages, start + 4);
    for (let p = start; p <= end; p++) arr.push(p);
    return arr;
  }, [info]);

  const fmtMoney = (v, curr = "USD") =>
    new Intl.NumberFormat(undefined, { style: "currency", currency: curr }).format(Number(v || 0));

  const typeIcon = (type) => {
    switch (type) {
      case "cash":
        return Banknote;
      case "bank":
        return Landmark;
      case "credit_card":
        return CreditCard;
      case "wallet":
        return Wallet;
      default:
        return Wallet;
    }
  };

  const pageCurrencySet = useMemo(() => new Set(rows.map((r) => r.currency).filter(Boolean)), [rows]);
  const totalOnPage = rows.length;
  const defaultOnPage = rows.filter((r) => r.is_default).length;
  const totalBalanceOnPage = rows.reduce((acc, r) => acc + Number(r.balance || 0), 0);

  // ==== Create modal state ====
  const [addOpen, setAddOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", type: "bank", currency: "USD", balance: "", is_default: false });

  const currentUserId = (() => {
    try { return JSON.parse(localStorage.getItem("exp_user") || "{}").id || null; } catch { return null; }
  })();

  const onCreate = async () => {
    if (!addForm.name.trim()) { setErr("Name is required"); return; }
    if (!currentUserId) { setErr("Missing user session"); return; }
    setCreating(true);
    setErr("");
    try {
      const payload = {
        name: addForm.name.trim(),
        type: addForm.type,
        currency: addForm.currency?.trim() || null,
        balance: addForm.balance === "" ? null : Number(addForm.balance),
        is_default: !!addForm.is_default,
        user: currentUserId,
      };
      await apiService.createAccount(payload);
      setAddOpen(false);
      setAddForm({ name: "", type: "bank", currency: "USD", balance: "", is_default: false });
      await fetchData();
    } catch (e) {
      setErr(e?.message || "Failed to create account");
    } finally {
      setCreating(false);
    }
  };

  // ==== Edit modal state ====
  const [editing, setEditing] = useState(null); // account obj
  const [editForm, setEditForm] = useState({ name: "", type: "bank", currency: "USD", balance: "", is_default: false });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [settingDefaultId, setSettingDefaultId] = useState(null);
  const [historyFor, setHistoryFor] = useState(null); // account object
  const [historyRows, setHistoryRows] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const onOpenEdit = (a) => {
    setEditing(a);
    setEditForm({
      name: a.name || "",
      type: a.type || "bank",
      currency: a.currency || "USD",
      balance: a.balance ?? "",
      is_default: !!a.is_default,
    });
  };

  const onSaveEdit = async () => {
    if (!editing) return;
    if (!editForm.name.trim()) { setErr("Name is required"); return; }
    setSaving(true);
    setErr("");
    try {
      const payload = {
        name: editForm.name.trim(),
        type: editForm.type,
        currency: editForm.currency?.trim() || null,
        balance: editForm.balance === "" ? null : Number(editForm.balance),
        is_default: !!editForm.is_default,
      };
      await apiService.updateAccount(editing.id, payload);
      setEditing(null);
      await fetchData();
    } catch (e) {
      setErr(e?.message || "Failed to update account");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (id) => {
    if (!confirm("Delete this account?")) return;
    setDeletingId(id);
    setErr("");
    try {
      await apiService.deleteAccount(id);
      const isLastItemOnPage = rows.length === 1 && filters.page > 1;
      setFilters((f) => ({ ...f, page: isLastItemOnPage ? f.page - 1 : f.page }));
      if (!isLastItemOnPage) fetchData();
    } catch (e) {
      setErr(e?.message || "Failed to delete account");
    } finally {
      setDeletingId(null);
    }
  };

  const onMakeDefault = async (id) => {
    setSettingDefaultId(id);
    setErr("");
    try {
      await apiService.updateAccount(id, { is_default: true });
      await fetchData();
    } catch (e) {
      setErr(e?.message || "Failed to change default");
    } finally {
      setSettingDefaultId(null);
    }
  };

  const onOpenHistory = async (account) => {
    setHistoryFor(account);
    setHistoryRows([]);
    setHistoryLoading(true);
    try {
      const res = await apiService.getTransactions({ account_id: account.id, page: 1, page_size: 10 });
      setHistoryRows(res?.results ?? []);
    } catch {
      setHistoryRows([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Accounts</h1>
          <p className="text-gray-600 text-sm">Manage your financial accounts.</p>
        </div>

        {/* actions placeholder */}
        <div className="hidden sm:flex items-center gap-2">
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search accounts"
            className="h-9 w-56 rounded-xl border border-gray-300 px-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <select
            value={filters.page_size}
            onChange={(e) => setFilters((f) => ({ ...f, page_size: Number(e.target.value), page: 1 }))}
            className="h-9 rounded-xl border border-gray-300 px-2 text-sm"
          >
            {[5, 10, 20, 50].map((n) => (
              <option key={n} value={n}>{n}/page</option>
            ))}
          </select>
          <button
            type="button"
            className="h-9 rounded-xl bg-indigo-600 px-3 text-sm font-medium text-white hover:bg-indigo-700"
            onClick={() => setAddOpen(true)}
          >
            + Add Account
          </button>
        </div>
      </div>

      {/* Table card */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        {/* Quick stats to differentiate from transactions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-3">
            <div className="text-xs text-gray-600">Accounts (page / total)</div>
            <div className="mt-1 text-lg font-semibold">{totalOnPage} / {info.total_items}</div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-3">
            <div className="text-xs text-gray-600">Default on page</div>
            <div className="mt-1 text-lg font-semibold">{defaultOnPage}</div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-3">
            <div className="text-xs text-gray-600">Total balance (page)</div>
            <div className="mt-1 text-lg font-semibold">{fmtMoney(totalBalanceOnPage, [...pageCurrencySet][0] || "USD")}</div>
          </div>
        </div>

        {/* Type filter chips */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {[
            { v: undefined, label: "All" },
            { v: "cash", label: "Cash" },
            { v: "bank", label: "Bank" },
            { v: "credit_card", label: "Credit Card" },
            { v: "wallet", label: "Wallet" },
            { v: "other", label: "Other" },
          ].map((opt) => (
            <button
              key={String(opt.v || "all")}
              onClick={() => setFilters((f) => ({ ...f, type: opt.v, page: 1 }))}
              className={`rounded-xl px-3 py-1.5 text-xs border ${
                (filters.type ?? undefined) === opt.v
                  ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                  : "border-gray-300 hover:bg-gray-50"
              }`}
            >
              {opt.label}
            </button>
          ))}
          {(filters.type ?? undefined) !== undefined && (
            <button
              onClick={() => setFilters((f) => ({ ...f, type: undefined, page: 1 }))}
              className="ml-1 rounded-xl px-3 py-1.5 text-xs border border-gray-300 hover:bg-gray-50"
            >
              Clear
            </button>
          )}
        </div>

        {loading ? (
          <div className="text-sm text-gray-600">Loading…</div>
        ) : err ? (
          <div className="text-sm text-red-600">{err}</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500">
                    <th className="py-2">Account</th>
                    <th className="py-2">Type</th>
                    <th className="py-2">Currency</th>
                    <th className="py-2">Balance</th>
                    <th className="py-2">Default</th>
                    <th className="py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((a) => (
                    <tr key={a.id} className={`border-t ${a.is_default ? "bg-emerald-50/30" : ""}`}>
                      <td className="py-2">
                        <div className="flex items-center gap-3">
                          {(() => { const Icon = typeIcon(a.type); return <Icon className="h-5 w-5 text-indigo-600" />; })()}
                          <div>
                            <div className="font-medium">{a.name}</div>
                            <div className="text-xs text-gray-500">ID #{a.id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-2">{TYPE_LABELS[a.type] ?? a.type}</td>
                      <td className="py-2">{a.currency || "-"}</td>
                      <td className="py-2">{fmtMoney(a.balance, a.currency || "USD")}</td>
                      <td className="py-2">
                        {a.is_default ? (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 text-emerald-700 px-2 py-0.5">
                            <Star className="h-3.5 w-3.5" /> Default
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="py-2">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => onOpenEdit(a)}
                            className="rounded-xl border px-3 py-1 text-xs hover:bg-gray-50"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => onOpenHistory(a)}
                            className="rounded-xl border px-3 py-1 text-xs hover:bg-gray-50"
                          >
                            History
                          </button>
                          {!a.is_default && (
                            <button
                              onClick={() => onMakeDefault(a.id)}
                              disabled={settingDefaultId === a.id}
                              className={`rounded-xl px-3 py-1 text-xs ${settingDefaultId === a.id ? "bg-indigo-300 text-white" : "bg-indigo-600 text-white hover:bg-indigo-700"}`}
                            >
                              {settingDefaultId === a.id ? "Setting…" : "Make Default"}
                            </button>
                          )}
                          <button
                            onClick={() => onDelete(a.id)}
                            disabled={deletingId === a.id}
                            className={`rounded-xl px-3 py-1 text-xs text-white ${deletingId === a.id ? "bg-red-300" : "bg-red-600 hover:bg-red-700"}`}
                          >
                            {deletingId === a.id ? "Deleting…" : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {!rows.length && (
                    <tr>
                      <td className="py-6 text-center text-gray-500" colSpan={6}>
                        No accounts yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="mt-4 flex items-center justify-between text-sm">
              <div className="text-gray-600">
                Showing page <span className="font-medium">{info.current_page}</span> of {info.total_pages}
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="rounded-xl border px-3 py-1 hover:bg-gray-50"
                  onClick={() => onChangePage(info.current_page - 1)}
                  disabled={info.current_page <= 1}
                >
                  Prev
                </button>
                {pages.map((p) => (
                  <button
                    key={p}
                    onClick={() => onChangePage(p)}
                    className={`rounded-xl px-3 py-1 border ${p === info.current_page ? "bg-indigo-600 text-white border-indigo-600" : "hover:bg-gray-50"}`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  className="rounded-xl border px-3 py-1 hover:bg-gray-50"
                  onClick={() => onChangePage(info.current_page + 1)}
                  disabled={info.current_page >= info.total_pages}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ===== History Modal ===== */}
      {historyFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setHistoryFor(null)} />
          <div className="relative w-full max-w-2xl rounded-2xl border border-gray-200 bg-white p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">Recent Activity — {historyFor.name}</h3>
              <button onClick={() => setHistoryFor(null)} className="rounded-xl border px-3 py-1 text-xs hover:bg-gray-50">Close</button>
            </div>
            <div className="mt-4">
              {historyLoading ? (
                <div className="text-sm text-gray-600">Loading…</div>
              ) : historyRows.length === 0 ? (
                <div className="text-sm text-gray-500">No recent transactions.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500">
                        <th className="py-2">Date</th>
                        <th className="py-2">Description</th>
                        <th className="py-2">Type</th>
                        <th className="py-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyRows.map((t) => (
                        <tr key={t.id} className="border-t">
                          <td className="py-2">{t.date ? new Date(t.date).toLocaleString() : "-"}</td>
                          <td className="py-2">{t.description || "-"}</td>
                          <td className="py-2">{t.type}</td>
                          <td className={`py-2 text-right ${Number(t.amount) < 0 ? "text-red-600" : "text-emerald-700"}`}>
                            {Number(t.amount) < 0 ? "-" : "+"}
                            {new Intl.NumberFormat(undefined, { style: "currency", currency: t.currency || "USD" }).format(Math.abs(Number(t.amount || 0)))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== Create Modal ===== */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setAddOpen(false)} />
          <div className="relative w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-5 shadow-lg">
            <h3 className="text-base font-semibold">Add Account</h3>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="sm:col-span-2">
                <label className="block text-gray-700 mb-1">Name</label>
                <input
                  value={addForm.name}
                  onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g., Checking"
                />
              </div>
              <div>
                <label className="block text-gray-700 mb-1">Type</label>
                <select
                  value={addForm.type}
                  onChange={(e) => setAddForm((f) => ({ ...f, type: e.target.value }))}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2"
                >
                  {Object.entries(TYPE_LABELS).map(([v, lbl]) => (
                    <option key={v} value={v}>{lbl}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-gray-700 mb-1">Currency</label>
                <input
                  value={addForm.currency}
                  readOnly
                  onChange={(e) => setAddForm((f) => ({ ...f, currency: e.target.value.toUpperCase().slice(0,3) }))}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2"
                  placeholder="USD"
                  aria-readonly="true"
                />
              </div>
              <div>
                <label className="block text-gray-700 mb-1">Balance (optional)</label>
                <input
                  type="number"
                  step="0.01"
                  value={addForm.balance}
                  onChange={(e) => setAddForm((f) => ({ ...f, balance: e.target.value }))}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2"
                  placeholder="0.00"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="add-default"
                  type="checkbox"
                  checked={addForm.is_default}
                  onChange={(e) => setAddForm((f) => ({ ...f, is_default: e.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <label htmlFor="add-default" className="text-gray-700">Set as default</label>
              </div>
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button onClick={() => setAddOpen(false)} className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50">Cancel</button>
              <button
                onClick={onCreate}
                disabled={creating}
                className={`rounded-xl px-3 py-2 text-sm text-white ${creating ? "bg-indigo-300" : "bg-indigo-600 hover:bg-indigo-700"}`}
              >
                {creating ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Edit Modal ===== */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setEditing(null)} />
          <div className="relative w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-5 shadow-lg">
            <h3 className="text-base font-semibold">Edit Account</h3>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="sm:col-span-2">
                <label className="block text-gray-700 mb-1">Name</label>
                <input
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-gray-700 mb-1">Type</label>
                <select
                  value={editForm.type}
                  onChange={(e) => setEditForm((f) => ({ ...f, type: e.target.value }))}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2"
                >
                  {Object.entries(TYPE_LABELS).map(([v, lbl]) => (
                    <option key={v} value={v}>{lbl}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-gray-700 mb-1">Currency</label>
                <input
                  value={editForm.currency}
                  onChange={(e) => setEditForm((f) => ({ ...f, currency: e.target.value.toUpperCase().slice(0,3) }))}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-gray-700 mb-1">Balance (optional)</label>
                <input
                  type="number"
                  step="0.01"
                  value={editForm.balance}
                  onChange={(e) => setEditForm((f) => ({ ...f, balance: e.target.value }))}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="edit-default"
                  type="checkbox"
                  checked={editForm.is_default}
                  onChange={(e) => setEditForm((f) => ({ ...f, is_default: e.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <label htmlFor="edit-default" className="text-gray-700">Set as default</label>
              </div>
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button onClick={() => setEditing(null)} className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50">Cancel</button>
              <button
                onClick={onSaveEdit}
                disabled={saving}
                className={`rounded-xl px-3 py-2 text-sm text-white ${saving ? "bg-indigo-300" : "bg-indigo-600 hover:bg-indigo-700"}`}
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
