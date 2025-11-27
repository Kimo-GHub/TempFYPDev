import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import MainNavbar from "../components/MainNavbar";
import { apiService } from "../api";
import useCategories from "../hooks/useCategories";
import { useNotifications } from "../components/NotificationContext.jsx";
import { expensiPalettes } from "../theme/expensiPalette";

const formatMoney = (value, currency = "USD") =>
  new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(value || 0));

const intervalOptions = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

const defaultForm = {
  type: "expense",
  description: "",
  amount: "",
  currency: "USD",
  account: "",
  category: "",
  interval: "monthly",
  nextRun: "",
};

const formatDateLabel = (value) => {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return value;
  }
};

const toInputDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 16);
};

export default function Automate() {
  const navigate = useNavigate();
  const notify = useNotifications();
  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("exp_user") || "null");
    } catch {
      return null;
    }
  }, []);
  const currentUserId = currentUser?.id;
  const isAdmin = currentUser?.role === 1;
  const dashboardPath =
    currentUser?.role === 1 ? "/admin" : currentUser?.role ? "/user" : "/login";

  const [automations, setAutomations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [accounts, setAccounts] = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [logAutomationId, setLogAutomationId] = useState(null);
  const [logEntries, setLogEntries] = useState([]);
  const [logLoading, setLogLoading] = useState(false);
  const [logError, setLogError] = useState("");

  const { categories } = useCategories();
  const palette = isAdmin ? expensiPalettes.admin : expensiPalettes.user;

  const accountsMap = useMemo(() => {
    const map = new Map();
    accounts.forEach((acc) => map.set(acc.id, acc.name));
    return map;
  }, [accounts]);
  const accountById = useMemo(() => {
    const map = new Map();
    accounts.forEach((acc) => map.set(acc.id, acc));
    return map;
  }, [accounts]);
  const selectedUserId = isAdmin ? (form.user || currentUserId || null) : currentUserId;
  const accountsForForm = useMemo(() => {
    if (!isAdmin) return accounts;
    if (!selectedUserId) return [];
    return accounts.filter((acc) => Number(acc.user_id ?? acc.user) === Number(selectedUserId));
  }, [accounts, isAdmin, selectedUserId]);

  const categoriesMap = useMemo(() => {
    const map = new Map();
    categories.forEach((cat) => map.set(cat.id, cat.name));
    return map;
  }, [categories]);
  const usersMap = useMemo(() => {
    const map = new Map();
    users.forEach((u) => map.set(u.id, u.name || u.email || `User ${u.id}`));
    return map;
  }, [users]);

  const loadAutomations = async () => {
    if (!currentUserId) {
      setAutomations([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await apiService.getTransactions({
        page: 1,
        page_size: 200,
        is_recurring: true,
        user_id: isAdmin ? undefined : currentUserId,
      });
      setAutomations(res?.results ?? []);
    } catch (e) {
      setError(e?.message || "Failed to load automations");
      setAutomations([]);
    } finally {
      setLoading(false);
    }
  };

  const loadAccounts = async () => {
    setAccountsLoading(true);
    try {
      const res = await apiService.getAccounts({
        page: 1,
        page_size: 200,
        user_id: isAdmin ? undefined : currentUserId,
      });
      setAccounts(res?.results ?? []);
    } catch {
      setAccounts([]);
    } finally {
      setAccountsLoading(false);
    }
  };

  const loadUsers = async () => {
    if (!isAdmin) return;
    setUsersLoading(true);
    try {
      const res = await apiService.getUsers({ page: 1, page_size: 200 });
      setUsers(res?.results ?? []);
    } catch {
      setUsers([]);
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    loadAutomations();
    loadAccounts();
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...defaultForm, user: isAdmin ? "" : currentUserId });
    setModalOpen(true);
  };

  const openEdit = (automation) => {
    setEditing(automation);
    setForm({
      type: automation.type,
      description: automation.description || "",
      amount: automation.amount,
      currency: (automation.currency || "USD").toUpperCase(),
      account: automation.account_id || "",
      category: automation.category_id || "",
      interval: automation.recurring_interval || "monthly",
      nextRun: toInputDate(automation.next_recurring_date || automation.date),
      user: automation.user_id || automation.user || (isAdmin ? "" : currentUserId),
    });
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.account || !form.amount || !form.nextRun) return;
    const ownerId = isAdmin ? form.user || currentUserId : currentUserId;
    if (isAdmin && !ownerId) {
      notify({ type: "error", message: "Select a user for this automation." });
      return;
    }
    setSaving(true);
    const payload = {
      type: form.type,
      amount: Number(form.amount),
      currency: form.currency ? form.currency.toUpperCase().slice(0, 3) : "USD",
      description: form.description,
      date: new Date(form.nextRun).toISOString(),
      account: Number(form.account),
      category: form.category ? Number(form.category) : undefined,
      is_recurring: true,
      recurring_interval: form.interval,
      next_recurring_date: new Date(form.nextRun).toISOString(),
      user: ownerId,
    };
    try {
      const prev = editing;
      if (editing) {
        await apiService.updateTransaction(editing.id, payload);
        await applyTxEffect(prev, -1);
      } else {
        await apiService.createTransaction(payload);
      }
      await applyTxEffect(
        {
          ...payload,
          account_id: payload.account,
          to_account_id: payload.to_account,
        },
        +1,
      );
      setModalOpen(false);
      setEditing(null);
      setForm({ ...defaultForm, user: isAdmin ? "" : currentUserId });
      await loadAutomations();
    } catch (err) {
      alert(err?.message || "Unable to save automation");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (automation) => {
    setDeleteTarget(automation);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiService.deleteTransaction(deleteTarget.id);
      await applyTxEffect(deleteTarget, -1);
      setDeleteTarget(null);
      await loadAutomations();
    } catch (err) {
      alert(err?.message || "Failed to delete automation");
    } finally {
      setDeleting(false);
    }
  };

  const toggleLog = async (automation) => {
    if (logAutomationId === automation.id) {
      setLogAutomationId(null);
      return;
    }
    setLogAutomationId(automation.id);
    setLogLoading(true);
    setLogError("");
    try {
      const res = await apiService.getTransactions({
        q: automation.description || undefined,
        account_id: automation.account_id || undefined,
        user_id: isAdmin ? automation.user_id || undefined : currentUserId,
        page_size: 20,
      });
      setLogEntries(res?.results ?? []);
    } catch (err) {
      setLogEntries([]);
      setLogError(err?.message || "Unable to load log");
    } finally {
      setLogLoading(false);
    }
  };

  const goToTransactions = (automation) => {
    toggleLog(automation);
  };

  const applyTxEffect = async (tx, mult) => {
    const amt = Number(tx?.amount || 0);
    if (!amt || Number.isNaN(amt)) return;
    const type = tx?.type;
    const deltas = new Map();
    if (type === "expense") {
      const acct = Number(tx.account ?? tx.account_id);
      if (acct) deltas.set(acct, -(amt * mult));
    } else if (type === "income") {
      const acct = Number(tx.account ?? tx.account_id);
      if (acct) deltas.set(acct, +(amt * mult));
    } else if (type === "transfer") {
      const fromId = Number(tx.account ?? tx.account_id);
      const toId = Number(tx.to_account ?? tx.to_account_id);
      if (fromId) deltas.set(fromId, -(amt * mult));
      if (toId) deltas.set(toId, +(amt * mult));
    }

    for (const [id, delta] of deltas.entries()) {
      const acc = accountById.get(id);
      if (!acc) continue;
      const before = Number(acc.balance || 0);
      const after = before + delta;
      try {
        await apiService.updateAccount(id, { balance: after });
        acc.balance = after;
      } catch {
        // balance sync failures should not block UX
      }
    }

    try {
      localStorage.setItem("accounts:refresh", String(Date.now()));
      window.dispatchEvent(new Event("accounts:refresh"));
    } catch {
      // ignore storage dispatch errors
    }
  };

  return (
    <div
      className="min-h-screen bg-gradient-to-b from-emerald-50/50 via-white to-white"
      style={{
        backgroundImage: isAdmin
          ? "url('/assets/BackgroundImg1.png')"
          : "url('/assets/BGPURPLE.png')",
        backgroundRepeat: "no-repeat",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <MainNavbar buttonPalette={isAdmin ? undefined : palette} />

      <header className="mx-auto max-w-4xl px-6 py-16 text-center">
        <span
          className="inline-flex items-center rounded-full px-4 py-1 text-xs font-semibold uppercase tracking-wide"
          style={
            isAdmin
              ? { backgroundColor: "#d1fae5", color: "#065f46" }
              : { backgroundColor: palette.chipBg, color: palette.chipText }
          }
        >
          Automation Suite
        </span>
        <h1 className="mt-5 text-4xl font-semibold text-slate-900">Automated Transactions</h1>
        <p className="mt-4 text-base text-slate-500">
          Schedule repeating expenses or income once and let ExpensifyPro push them to your ledger on time—no reminders or spreadsheets
          needed.
        </p>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-24">
          <div className="flex items-center justify-between gap-3 pb-4">
            <div>
              <p className="text-sm font-semibold text-slate-500">
                {loading ? "Loading automations..." : `${automations.length} automation${automations.length === 1 ? "" : "s"}`}
              </p>
              {error && <p className="text-sm text-red-500">{error}</p>}
            </div>
            <button
              onClick={openCreate}
              className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-700"
              style={isAdmin ? undefined : { backgroundColor: palette.buttonBg }}
            >
              + New automation
            </button>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-3xl border border-emerald-100 bg-white/90 p-6 shadow-sm backdrop-blur">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-emerald-600" style={isAdmin ? undefined : { color: palette.primary }}>New automation</p>
                <h2 className="mt-1 text-xl font-semibold text-slate-900">Create a rule</h2>
                <p className="mt-2 text-sm text-slate-500">
                  Choose the type, amount, frequency, and destination account to auto-post recurring activity.
                </p>
              </div>
              <div className="rounded-2xl px-3 py-1 text-xs font-semibold text-emerald-700" style={isAdmin ? { backgroundColor: '#ecfdf3', color: '#047857' } : { backgroundColor: palette.chipBg, color: palette.chipText }}>Draft</div>
            </div>
            <div className="mt-6 space-y-4 text-sm">
              <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3">
                <div className="text-xs text-slate-500">Type</div>
                <div className="font-semibold text-slate-800">Expense · or Income</div>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3">
                <div className="text-xs text-slate-500">Frequency</div>
                <div className="font-semibold text-slate-800">Daily, weekly, monthly...</div>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3">
                <div className="text-xs text-slate-500">Account</div>
                <div className="font-semibold text-slate-800">
                  {accountsLoading ? "Loading accounts..." : accounts.length ? `${accounts.length} available` : "No accounts"}
                </div>
              </div>
            </div>
            <button
              onClick={openCreate}
              className="mt-6 w-full rounded-2xl py-3 text-sm font-semibold text-white shadow-lg bg-emerald-600 hover:bg-emerald-700"
              style={isAdmin ? undefined : { backgroundColor: palette.buttonBg }}
            >
              + Build automation
            </button>
          </div>

          {loading ? (
            <div className="md:col-span-2 lg:col-span-2 grid gap-4">
              {Array.from({ length: 2 }).map((_, idx) => (
                <div key={idx} className="rounded-3xl border border-slate-100 bg-white/70 p-6 shadow animate-pulse">
                  <div className="h-4 w-24 rounded bg-slate-200" />
                  <div className="mt-4 h-6 w-48 rounded bg-slate-200" />
                  <div className="mt-6 space-y-3">
                    <div className="h-4 w-full rounded bg-slate-200" />
                    <div className="h-4 w-2/3 rounded bg-slate-200" />
                    <div className="h-4 w-1/2 rounded bg-slate-200" />
                  </div>
                </div>
              ))}
            </div>
          ) : automations.length === 0 ? (
            <div className="md:col-span-2 lg:col-span-2 rounded-3xl border border-dashed border-emerald-200 bg-white/70 p-8 text-center text-slate-500">
              <p className="text-lg font-semibold text-slate-700">No automations yet</p>
              <p className="mt-2 text-sm">Create your first recurring rule to keep expenses and income up to date automatically.</p>
              <button
                onClick={openCreate}
                className="mt-4 rounded-2xl border border-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-600 hover:bg-emerald-50"
              >
                Start now
              </button>
            </div>
          ) : (
            automations.map((automation) => {
              const badgeColor = automation.type === "income" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700";
              return (
                <div
                  key={automation.id}
                  className={`rounded-3xl border ${automation.type === "income" ? "border-emerald-100 bg-emerald-50/40" : "border-rose-100 bg-rose-50/40"} p-6 shadow-sm`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${badgeColor}`}>
                        {automation.type === "income" ? "Income" : "Expense"}
                      </span>
                      <h3 className="mt-3 text-xl font-semibold text-slate-900">{automation.description || "Untitled automation"}</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        Linked to {accountsMap.get(automation.account_id) || "account"} ·{" "}
                        {automation.recurring_interval ? intervalOptions.find((opt) => opt.value === automation.recurring_interval)?.label : "Custom"}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-xs uppercase tracking-wide text-slate-400">Amount</div>
                      <div className={`text-2xl font-semibold ${automation.type === "income" ? "text-emerald-600" : "text-rose-600"}`}>
                        {formatMoney(automation.amount, automation.currency || "USD")}
                      </div>
                    </div>
                  </div>
              <div className="mt-6 space-y-3 text-sm text-slate-700">
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase tracking-wide text-slate-400">Next run</span>
                  <span className="font-semibold text-slate-900">{formatDateLabel(automation.next_recurring_date)}</span>
                </div>
                {isAdmin ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs uppercase tracking-wide text-slate-400">Owner</span>
                    <span className="font-semibold text-slate-900">
                      {usersMap.get(automation.user_id) || automation.user_id || "Unknown"}
                    </span>
                  </div>
                ) : null}
                {automation.category_id && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs uppercase tracking-wide text-slate-400">Category</span>
                    <span className="font-semibold text-slate-900">{categoriesMap.get(automation.category_id) || automation.category_id}</span>
                  </div>
                    )}
                {automation.last_processed && (
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span>Last run:</span>
                    <span>{formatDateLabel(automation.last_processed)}</span>
                  </div>
                )}
              </div>
              <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
                <button
                  onClick={() => toggleLog(automation)}
                  className="rounded-full border border-slate-200 px-4 py-1.5 text-xs font-semibold text-slate-600 hover:border-emerald-200 hover:text-emerald-700"
                >
                  {logAutomationId === automation.id ? "Hide log" : "View log"}
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={() => openEdit(automation)}
                    className="rounded-full border border-slate-200 px-4 py-1.5 text-xs font-semibold text-slate-600 hover:border-emerald-200 hover:text-emerald-700"
                      >
                        Manage
                      </button>
                      <button
                        onClick={() => confirmDelete(automation)}
                        className="rounded-full border border-rose-200 px-4 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  {logAutomationId === automation.id && (
                    <div className="mt-4 rounded-2xl border border-slate-100 bg-white/80 p-4 shadow-sm">
                      {logLoading ? (
                        <p className="text-sm text-slate-500">Loading log…</p>
                      ) : logError ? (
                        <p className="text-sm text-rose-600">{logError}</p>
                      ) : logEntries.length === 0 ? (
                        <p className="text-sm text-slate-500">No log entries yet.</p>
                      ) : (
                        <div className="space-y-2 text-sm text-slate-700">
                          {logEntries.map((entry) => (
                            <div key={entry.id} className="flex justify-between rounded-xl bg-slate-50 px-3 py-2">
                              <span className="font-medium">{entry.description || "Run"}</span>
                              <span className="text-slate-500">{formatDateLabel(entry.date || entry.created_at)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </main>

      {modalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setModalOpen(false)} />
          <div className="relative w-full max-w-2xl rounded-3xl border border-slate-100 bg-white p-6 shadow-2xl">
            <h3 className="text-xl font-semibold text-slate-900">{editing ? "Edit automation" : "Create automation"}</h3>
            <p className="text-sm text-slate-500">Tell ExpensifyPro how and when to generate this transaction.</p>
            <form className="mt-6 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2" onSubmit={handleSave}>
              <div>
                <label className="text-xs font-semibold text-slate-500">Type</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value }))}
                  className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2"
                  required
                >
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500">Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
                  className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2"
                  required
                />
              </div>
              {isAdmin ? (
                <div>
                  <label className="text-xs font-semibold text-slate-500">User</label>
                  <select
                    value={form.user || ""}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        user: e.target.value,
                        account: "", // clear account when switching user
                      }))
                    }
                    className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2"
                    required
                  >
                    <option value="">{usersLoading ? "Loading users..." : "Select user"}</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name || u.email || `User ${u.id}`}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              <div>
                <label className="text-xs font-semibold text-slate-500">Currency</label>
                <input
                  value={form.currency}
                  onChange={(e) => setForm((prev) => ({ ...prev, currency: e.target.value.toUpperCase().slice(0, 3) }))}
                  className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500">Frequency</label>
                <select
                  value={form.interval}
                  onChange={(e) => setForm((prev) => ({ ...prev, interval: e.target.value }))}
                  className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2"
                >
                  {intervalOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-slate-500">Description</label>
                <input
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2"
                  placeholder="Workspace rent, contractor retainer..."
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500">Account</label>
                <select
                  value={form.account}
                  onChange={(e) => setForm((prev) => ({ ...prev, account: e.target.value }))}
                  className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2"
                  required
                  disabled={isAdmin && !selectedUserId}
                >
                  <option value="">
                    {isAdmin && !selectedUserId
                      ? "Select user first"
                      : accountsLoading
                      ? "Loading..."
                      : "Select account"}
                  </option>
                  {accountsForForm.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500">Category (optional)</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
                  className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2"
                >
                  <option value="">Uncategorized</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-slate-500">Next run</label>
                <input
                  type="datetime-local"
                  value={form.nextRun}
                  onChange={(e) => setForm((prev) => ({ ...prev, nextRun: e.target.value }))}
                  className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2"
                  required
                />
              </div>
              <div className="sm:col-span-2 flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setModalOpen(false);
                    setEditing(null);
                  }}
                  className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                style={isAdmin ? undefined : { backgroundColor: palette.buttonBg }}
              >
                {saving ? "Saving..." : editing ? "Save changes" : "Create automation"}
              </button>
            </div>
          </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setDeleteTarget(null)} />
          <div className="relative w-full max-w-md rounded-3xl border border-slate-100 bg-white p-6 shadow-2xl">
            <h4 className="text-lg font-semibold text-slate-900">Delete automation</h4>
            <p className="mt-2 text-sm text-slate-500">
              This will remove <span className="font-semibold text-slate-800">{deleteTarget.description || "this automation"}</span>. Future runs
              will stop immediately.
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-2xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
