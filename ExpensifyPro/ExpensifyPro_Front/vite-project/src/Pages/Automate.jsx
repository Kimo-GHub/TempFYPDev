import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiService } from "../api";
import useCategories from "../hooks/useCategories";
import { useNotifications } from "../components/NotificationContext.jsx";

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

  const { categories } = useCategories();

  const accountsMap = useMemo(() => {
    const map = new Map();
    accounts.forEach((acc) => map.set(acc.id, acc.name));
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
      if (editing) {
        await apiService.updateTransaction(editing.id, payload);
      } else {
        await apiService.createTransaction(payload);
      }
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
      setDeleteTarget(null);
      await loadAutomations();
    } catch (err) {
      alert(err?.message || "Failed to delete automation");
    } finally {
      setDeleting(false);
    }
  };

  const goToTransactions = (automation) => {
    const params = new URLSearchParams();
    params.set("recurring", "1");
    if (automation.description) params.set("q", automation.description);
    if (automation.account_id) params.set("account_id", automation.account_id);
    if (isAdmin && automation.user_id) params.set("user_id", automation.user_id);
    navigate(`/user/transactions?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/50 via-white to-white" style={{ backgroundImage: "url('/assets/BackgroundImg1.png')" }}>
      <nav className="sticky top-0 z-20 border-b border-white/60 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="text-lg font-semibold text-emerald-600">
            ExpensifyPro
          </Link>
          <Link
            to={dashboardPath}
            className="rounded-full border border-emerald-100 px-4 py-1.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
          >
            Go to dashboard
          </Link>
        </div>
      </nav>

      <header className="mx-auto max-w-4xl px-6 py-16 text-center">
        <span className="inline-flex items-center rounded-full bg-emerald-100 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
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
          >
            + New automation
          </button>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-3xl border border-emerald-100 bg-white/90 p-6 shadow-sm backdrop-blur">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-emerald-600">New automation</p>
                <h2 className="mt-1 text-xl font-semibold text-slate-900">Create a rule</h2>
                <p className="mt-2 text-sm text-slate-500">
                  Choose the type, amount, frequency, and destination account to auto-post recurring activity.
                </p>
              </div>
              <div className="rounded-2xl bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Draft</div>
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
              className="mt-6 w-full rounded-2xl bg-emerald-600 py-3 text-sm font-semibold text-white shadow-lg hover:bg-emerald-700"
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
                      onClick={() => goToTransactions(automation)}
                      className="rounded-full border border-slate-200 px-4 py-1.5 text-xs font-semibold text-slate-600 hover:border-emerald-200 hover:text-emerald-700"
                    >
                      View log
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
