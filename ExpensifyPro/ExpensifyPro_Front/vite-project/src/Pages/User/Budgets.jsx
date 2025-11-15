import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiService } from "../../api";

const STATUS_FILTERS = [
  { value: "all", label: "All budgets" },
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
];

const emptyForm = {
  name: "",
  amount: "",
  account: "",
  project: "",
  description: "",
  period_start: "",
  period_end: "",
  warn_at_percent: "",
  is_active: true,
};

const fmtMoney = (value, currency = "USD") =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const fmtDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "-";

const Modal = ({ open, title, onClose, children, footer }) => {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/70 px-4 py-10"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl rounded-3xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100"
            aria-label="Close modal"
          >
            x
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">{children}</div>
        {footer ? (
          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default function Budgets() {
  const navigate = useNavigate();
  const currentUserId = (() => {
    try {
      return JSON.parse(localStorage.getItem("exp_user") || "{}").id || null;
    } catch {
      return null;
    }
  })();

  const [rows, setRows] = useState([]);
  const [info, setInfo] = useState({ current_page: 1, total_pages: 1, total_items: 0 });
  const [filters, setFilters] = useState({ page: 1, page_size: 6, q: "", status: "active" });
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [formError, setFormError] = useState("");
  const [accounts, setAccounts] = useState([]);
  const [projects, setProjects] = useState([]);
  const [reloadKey, setReloadKey] = useState(0);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);

  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({ ...emptyForm });
  const [updating, setUpdating] = useState(false);

  const [viewing, setViewing] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setSearchInput(filters.q || "");
  }, [filters.q]);

  useEffect(() => {
    const timer = setTimeout(() => setFilters((prev) => ({ ...prev, q: searchInput, page: 1 })), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (!currentUserId) {
      setRows([]);
      setLoading(false);
      return;
    }
    let ignore = false;
    (async () => {
      setLoading(true);
      setPageError("");
      const query = {
        page: filters.page,
        page_size: filters.page_size,
        q: filters.q,
        user_id: currentUserId,
        is_active: filters.status === "all" ? undefined : filters.status === "active",
      };
      try {
        const res = await apiService.getBudgets(query);
        if (ignore) return;
        setRows(res?.results ?? []);
        setInfo(res?.info ?? { current_page: 1, total_pages: 1, total_items: 0 });
      } catch (error) {
        if (ignore) return;
        setRows([]);
        setInfo({ current_page: 1, total_pages: 1, total_items: 0 });
        setPageError(error?.message || "Failed to load budgets");
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [filters.page, filters.page_size, filters.status, filters.q, currentUserId, reloadKey]);

  useEffect(() => {
    if (!currentUserId) return;
    (async () => {
      try {
        const res = await apiService.getAccounts({ user_id: currentUserId, page: 1, page_size: 100 });
        setAccounts(res?.results ?? []);
      } catch {
        setAccounts([]);
      }
    })();
    (async () => {
      try {
        const res = await apiService.getProjects({ user_id: currentUserId, page: 1, page_size: 100 });
        setProjects(res?.results ?? []);
      } catch {
        setProjects([]);
      }
    })();
  }, [currentUserId]);

  const accountsMap = useMemo(() => {
    const map = new Map();
    accounts.forEach((acc) => map.set(acc.id, acc.name));
    return map;
  }, [accounts]);

  const projectsMap = useMemo(() => {
    const map = new Map();
    projects.forEach((proj) => map.set(proj.id, proj.name));
    return map;
  }, [projects]);

  const summary = useMemo(() => {
    const activeBudgets = rows.filter((b) => b.is_active);
    const archivedBudgets = rows.length - activeBudgets.length;
    const totalAmount = activeBudgets.reduce((sum, b) => sum + Number(b.amount || 0), 0);
    return {
      currency: rows[0]?.currency || "USD",
      active: activeBudgets.length,
      archived: archivedBudgets,
      totalAmount,
    };
  }, [rows]);

  const pages = useMemo(() => {
    const arr = [];
    const start = Math.max(1, info.current_page - 2);
    const end = Math.min(info.total_pages, start + 4);
    for (let page = start; page <= end; page += 1) arr.push(page);
    return arr;
  }, [info]);

  const refreshBudgets = () => setReloadKey((key) => key + 1);

  const accountLabel = (budget) =>
    budget?.account_name ||
    accountsMap.get(budget?.account_id ?? budget?.account) ||
    "Any account";

  const projectLabel = (budget) =>
    budget?.project_name ||
    projectsMap.get(budget?.project_id ?? budget?.project) ||
    "General budget";

  const pageStart = rows.length ? (info.current_page - 1) * filters.page_size + 1 : 0;
  const pageEnd = rows.length ? pageStart + rows.length - 1 : 0;

  const openCreateModal = () => {
    setCreateForm({ ...emptyForm, is_active: true });
    setFormError("");
    setCreateOpen(true);
  };

  const closeCreateModal = () => {
    if (saving) return;
    setCreateOpen(false);
    setFormError("");
  };

  const submitCreate = async () => {
    if (!currentUserId) {
      setFormError("Missing user session");
      return;
    }
    if (!createForm.name.trim()) {
      setFormError("Budget name is required");
      return;
    }
    if (createForm.amount === "" || Number(createForm.amount) <= 0) {
      setFormError("Enter a valid amount");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      await apiService.createBudget({
        user: currentUserId,
        name: createForm.name.trim(),
        amount: Number(createForm.amount),
        account: createForm.account ? Number(createForm.account) : undefined,
        project: createForm.project ? Number(createForm.project) : undefined,
        description: createForm.description?.trim() || undefined,
        period_start: createForm.period_start || undefined,
        period_end: createForm.period_end || undefined,
        warn_at_percent: createForm.warn_at_percent ? Number(createForm.warn_at_percent) : undefined,
        is_active: !!createForm.is_active,
      });
      setCreateOpen(false);
      setCreateForm({ ...emptyForm, is_active: true });
      refreshBudgets();
    } catch (error) {
      setFormError(error?.message || "Failed to create budget");
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (budget) => {
    if (!budget) return;
    setViewing(null);
    setEditing(budget);
    setEditForm({
      name: budget.name || "",
      amount: budget.amount ?? "",
      account: budget.account_id ?? budget.account ?? "",
      project: budget.project_id ?? budget.project ?? "",
      description: budget.description || "",
      period_start: budget.period_start || "",
      period_end: budget.period_end || "",
      warn_at_percent: budget.warn_at_percent ?? "",
      is_active: !!budget.is_active,
    });
    setFormError("");
  };

  const closeEditModal = () => {
    if (updating) return;
    setEditing(null);
    setFormError("");
  };

  const submitEdit = async () => {
    if (!editing) return;
    if (!editForm.name.trim()) {
      setFormError("Budget name is required");
      return;
    }
    setUpdating(true);
    setFormError("");
    try {
      await apiService.updateBudget(editing.id, {
        name: editForm.name.trim(),
        amount: editForm.amount === "" ? undefined : Number(editForm.amount),
        account: editForm.account ? Number(editForm.account) : null,
        project: editForm.project ? Number(editForm.project) : null,
        description: editForm.description?.trim() || null,
        period_start: editForm.period_start || null,
        period_end: editForm.period_end || null,
        warn_at_percent: editForm.warn_at_percent ? Number(editForm.warn_at_percent) : null,
        is_active: !!editForm.is_active,
      });
      setEditing(null);
      refreshBudgets();
    } catch (error) {
      setFormError(error?.message || "Failed to update budget");
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async (budgetId) => {
    if (!budgetId) return;
    if (!window.confirm("Delete this budget? This cannot be undone.")) return;
    setDeleting(true);
    setFormError("");
    try {
      await apiService.deleteBudget(budgetId);
      setViewing((prev) => (prev && prev.id === budgetId ? null : prev));
      setEditing((prev) => (prev && prev.id === budgetId ? null : prev));
      refreshBudgets();
    } catch (error) {
      setFormError(error?.message || "Failed to delete budget");
    } finally {
      setDeleting(false);
    }
  };

  const renderFormFields = (state, setState) => (
    <div className="mt-4 grid gap-4 text-sm md:grid-cols-2">
      <div className="md:col-span-2">
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Budget name
        </label>
        <input
          value={state.name}
          onChange={(event) => setState((prev) => ({ ...prev, name: event.target.value }))}
          className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-slate-800 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-200"
        />
      </div>
      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Amount
        </label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={state.amount}
          onChange={(event) => setState((prev) => ({ ...prev, amount: event.target.value }))}
          className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-slate-800 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-200"
        />
      </div>
      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Warn at %
        </label>
        <input
          type="number"
          min="0"
          max="100"
          step="1"
          value={state.warn_at_percent}
          onChange={(event) => setState((prev) => ({ ...prev, warn_at_percent: event.target.value }))}
          className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-slate-800 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-200"
        />
      </div>
      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Account
        </label>
        <select
          value={state.account}
          onChange={(event) => setState((prev) => ({ ...prev, account: event.target.value }))}
          className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-slate-800 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-200"
        >
          <option value="">Any account</option>
          {accounts.map((acc) => (
            <option key={acc.id} value={acc.id}>
              {acc.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Project
        </label>
        <select
          value={state.project}
          onChange={(event) => setState((prev) => ({ ...prev, project: event.target.value }))}
          className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-slate-800 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-200"
        >
          <option value="">General budget</option>
          {projects.map((proj) => (
            <option key={proj.id} value={proj.id}>
              {proj.name}
            </option>
          ))}
        </select>
      </div>
      <div className="md:col-span-2">
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Period
        </label>
        <div className="mt-1 grid gap-3 md:grid-cols-2">
          <input
            type="date"
            value={state.period_start}
            onChange={(event) => setState((prev) => ({ ...prev, period_start: event.target.value }))}
            className="rounded-2xl border border-slate-200 px-4 py-2.5 text-slate-800 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-200"
          />
          <input
            type="date"
            value={state.period_end}
            onChange={(event) => setState((prev) => ({ ...prev, period_end: event.target.value }))}
            className="rounded-2xl border border-slate-200 px-4 py-2.5 text-slate-800 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-200"
          />
        </div>
      </div>
      <div className="md:col-span-2">
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Description
        </label>
        <textarea
          rows={3}
          value={state.description}
          onChange={(event) => setState((prev) => ({ ...prev, description: event.target.value }))}
          className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-slate-800 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-200"
          placeholder="Add helpful context for teammates..."
        />
      </div>
      <div className="md:col-span-2 flex items-center justify-between rounded-2xl bg-slate-100 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-slate-800">Active budget</p>
          <p className="text-xs text-slate-500">Inactive budgets stay visible but stop tracking.</p>
        </div>
        <button
          type="button"
          onClick={() => setState((prev) => ({ ...prev, is_active: !prev.is_active }))}
          className={`flex h-9 w-16 items-center rounded-full p-1 transition ${
            state.is_active ? "bg-indigo-600" : "bg-slate-300"
          }`}
        >
          <span
            className={`h-7 w-7 rounded-full bg-white shadow transition ${
              state.is_active ? "translate-x-7" : ""
            }`}
          />
        </button>
      </div>
    </div>
  );

  const renderCards = () => {
    if (loading) {
      return (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div
              key={idx}
              className="h-60 animate-pulse rounded-3xl bg-gradient-to-br from-slate-100 to-slate-200"
            />
          ))}
        </div>
      );
    }
    if (!rows.length) {
      return (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white/70 px-6 py-16 text-center text-slate-500">
          <p className="text-lg font-semibold text-slate-700">No budgets yet</p>
          <p className="mt-2 text-sm">Create your first budget to start tracking planned spend.</p>
          <button
            type="button"
            onClick={openCreateModal}
            className="mt-6 inline-flex items-center justify-center rounded-2xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:-translate-y-0.5 hover:bg-indigo-500"
          >
            + Add budget
          </button>
        </div>
      );
    }

    return (
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((budget) => {
          const amount = Number(budget.amount || 0);
          const spent = Number(budget.spent_amount ?? budget.actual_spend ?? 0);
          const pct = amount ? Math.min(100, Math.round((spent / amount) * 100)) : 0;
          return (
            <div
              key={budget.id}
              className="flex flex-col rounded-3xl border border-slate-200 bg-white/80 p-5 shadow-sm ring-1 ring-slate-100 transition hover:-translate-y-1 hover:shadow-xl"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Budget</p>
                  <h3 className="mt-1 text-lg font-semibold text-slate-900">{budget.name}</h3>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    budget.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {budget.is_active ? "Active" : "Archived"}
                </span>
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-slate-500">
                {budget.description || "No description provided."}
              </p>
              <dl className="mt-4 space-y-2 text-sm text-slate-600">
                <div className="flex justify-between">
                  <dt>Amount</dt>
                  <dd className="font-semibold text-slate-900">
                    {fmtMoney(budget.amount, summary.currency)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt>Account</dt>
                  <dd className="font-medium text-slate-800">{accountLabel(budget)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Project</dt>
                  <dd className="font-medium text-slate-800">{projectLabel(budget)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Period</dt>
                  <dd>
                    {fmtDate(budget.period_start)} - {fmtDate(budget.period_end)}
                  </dd>
                </div>
              </dl>
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Usage</span>
                  <span>{pct}%</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-slate-200">
                  <span
                    className={`block h-2 rounded-full ${
                      pct > 85 ? "bg-rose-500" : pct > 65 ? "bg-amber-500" : "bg-indigo-500"
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="mt-1 flex justify-between text-xs text-slate-500">
                  <span>{fmtMoney(spent, summary.currency)} spent</span>
                  <span>
                    Warn at {budget.warn_at_percent ? `${budget.warn_at_percent}%` : "not set"}
                  </span>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-2 text-sm">
                <button
                  type="button"
                  onClick={() => setViewing(budget)}
                  className="flex-1 rounded-2xl border border-slate-200 px-3 py-2 font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  Details
                </button>
                <button
                  type="button"
                  onClick={() => openEditModal(budget)}
                  className="rounded-2xl border border-transparent bg-indigo-600 px-4 py-2 font-semibold text-white transition hover:bg-indigo-500"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/user/transactions")}
                  className="rounded-2xl border border-slate-200 px-3 py-2 font-semibold text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                >
                  Transactions
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-500">Planning</p>
          <h1 className="text-3xl font-bold text-slate-900">Budgets</h1>
          <p className="text-sm text-slate-500">Keep allocations aligned across accounts and projects.</p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:-translate-y-0.5 hover:bg-indigo-500"
        >
          <span className="text-base">+</span> New budget
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl bg-white/80 p-5 shadow-sm ring-1 ring-slate-100">
          <p className="text-sm text-slate-500">Active budgets</p>
          <p className="mt-1 text-3xl font-semibold text-slate-900">{summary.active}</p>
        </div>
        <div className="rounded-3xl bg-white/80 p-5 shadow-sm ring-1 ring-slate-100">
          <p className="text-sm text-slate-500">Allocated</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {fmtMoney(summary.totalAmount, summary.currency)}
          </p>
        </div>
        <div className="rounded-3xl bg-white/80 p-5 shadow-sm ring-1 ring-slate-100">
          <p className="text-sm text-slate-500">Archived</p>
          <p className="mt-1 text-3xl font-semibold text-slate-900">{summary.archived}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-slate-200 bg-white/80 p-4 shadow-sm">
        <div className="flex flex-1 items-center gap-3 rounded-2xl border border-slate-200 px-3 py-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="h-5 w-5 text-slate-400"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-4.35-4.35m0-5.4a6.75 6.75 0 1 1-13.5 0 6.75 6.75 0 0 1 13.5 0z"
            />
          </svg>
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search budgets..."
            className="flex-1 border-none bg-transparent text-sm text-slate-700 outline-none"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => setFilters((prev) => ({ ...prev, status: filter.value, page: 1 }))}
              className={`rounded-2xl px-3 py-2 text-sm font-semibold transition ${
                filters.status === filter.value
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/30"
                  : "border border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:text-indigo-600"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {pageError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {pageError}
        </div>
      ) : null}

      {renderCards()}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-white/80 px-5 py-4 text-sm text-slate-600">
        <p>
          Showing {pageStart || 0}-{pageEnd || 0} of {info.total_items || 0}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFilters((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
            disabled={info.current_page <= 1}
            className="rounded-2xl border border-slate-200 px-3 py-1 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
          >
            Prev
          </button>
          {pages.map((page) => (
            <button
              key={page}
              type="button"
              onClick={() => setFilters((prev) => ({ ...prev, page }))}
              className={`h-9 w-9 rounded-2xl text-sm font-semibold transition ${
                info.current_page === page
                  ? "bg-indigo-600 text-white shadow"
                  : "border border-slate-200 text-slate-600 hover:border-indigo-200 hover:text-indigo-600"
              }`}
            >
              {page}
            </button>
          ))}
          <button
            type="button"
            onClick={() =>
              setFilters((prev) => ({ ...prev, page: Math.min(info.total_pages, prev.page + 1) }))
            }
            disabled={info.current_page >= info.total_pages}
            className="rounded-2xl border border-slate-200 px-3 py-1 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>

      <Modal
        open={createOpen}
        title="Create budget"
        onClose={closeCreateModal}
        footer={
          <>
            <button
              type="button"
              onClick={closeCreateModal}
              className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submitCreate}
              disabled={saving}
              className="rounded-2xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:bg-indigo-500 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save budget"}
            </button>
          </>
        }
      >
        {formError && !editing && !viewing ? (
          <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
            {formError}
          </div>
        ) : null}
        {renderFormFields(createForm, setCreateForm)}
      </Modal>

      <Modal
        open={!!editing}
        title="Edit budget"
        onClose={closeEditModal}
        footer={
          <>
            <button
              type="button"
              onClick={closeEditModal}
              className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submitEdit}
              disabled={updating}
              className="rounded-2xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:bg-indigo-500 disabled:opacity-50"
            >
              {updating ? "Saving..." : "Update budget"}
            </button>
          </>
        }
      >
        {formError && editing ? (
          <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
            {formError}
          </div>
        ) : null}
        {renderFormFields(editForm, setEditForm)}
      </Modal>

      <Modal
        open={!!viewing}
        title="Budget details"
        onClose={() => {
          setViewing(null);
          setFormError("");
        }}
        footer={
          viewing ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setViewing(null);
                  setFormError("");
                }}
                className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => openEditModal(viewing)}
                className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-indigo-200 hover:text-indigo-600"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => handleDelete(viewing.id)}
                disabled={deleting}
                className="rounded-2xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-rose-500/30 transition hover:bg-rose-500 disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </>
          ) : null
        }
      >
        {formError && viewing ? (
          <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
            {formError}
          </div>
        ) : null}
        {viewing ? (
          <div className="space-y-4 text-sm text-slate-700">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Name</p>
              <p className="mt-1 text-base font-semibold text-slate-900">{viewing.name}</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Amount</p>
                <p className="mt-1 font-semibold text-slate-900">
                  {fmtMoney(viewing.amount, summary.currency)}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</p>
                <p className="mt-1 font-semibold text-slate-900">
                  {viewing.is_active ? "Active" : "Archived"}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Account</p>
                <p className="mt-1 font-medium text-slate-800">{accountLabel(viewing)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Project</p>
                <p className="mt-1 font-medium text-slate-800">{projectLabel(viewing)}</p>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Period</p>
              <p className="mt-1">
                {fmtDate(viewing.period_start)} - {fmtDate(viewing.period_end)}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Warn at</p>
              <p className="mt-1">
                {viewing.warn_at_percent ? `${viewing.warn_at_percent}%` : "Not set"}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Description</p>
              <p className="mt-1 whitespace-pre-line">
                {viewing.description || "No additional context provided."}
              </p>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
