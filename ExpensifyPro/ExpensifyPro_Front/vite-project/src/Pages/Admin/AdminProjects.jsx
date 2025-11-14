import { useEffect, useMemo, useState } from "react";
import { apiService } from "../../api";

const currencyFmt = (value, currency = "USD") =>
  new Intl.NumberFormat(undefined, { style: "currency", currency }).format(Number(value || 0));

const emptyForm = {
  name: "",
  code: "",
  description: "",
  is_active: true,
  user: "",
  account: "",
  budget_amount: "",
  start_date: "",
  end_date: "",
};

export default function AdminProjects() {
  const [rows, setRows] = useState([]);
  const [info, setInfo] = useState({ current_page: 1, total_pages: 1, total_items: 0 });
  const [filters, setFilters] = useState({ page: 1, page_size: 9, q: "" });
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [users, setUsers] = useState([]);
  const [accounts, setAccounts] = useState([]);

  const [form, setForm] = useState({ ...emptyForm });
  const [addOpen, setAddOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);

  const [viewing, setViewing] = useState(null);
  const [budgetsLoading, setBudgetsLoading] = useState(false);
  const [budgetRows, setBudgetRows] = useState([]);

  useEffect(() => {
    setSearchInput(filters.q || "");
  }, [filters.q]);

  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => ({ ...f, q: searchInput, page: 1 })), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const fetchProjects = async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await apiService.getProjects(filters);
      setRows(res?.results ?? []);
      setInfo(res?.info ?? { current_page: 1, total_pages: 1, total_items: 0 });
    } catch (e) {
      setRows([]);
      setInfo({ current_page: 1, total_pages: 1, total_items: 0 });
      setErr(e?.message || "Failed to load projects");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.page, filters.page_size, filters.q]);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiService.getUsers({ page: 1, page_size: 100 });
        setUsers(res?.results ?? []);
      } catch {
        setUsers([]);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiService.getAccounts({ page: 1, page_size: 100 });
        setAccounts(res?.results ?? []);
      } catch {
        setAccounts([]);
      }
    })();
  }, []);

  const userLabel = (id) => {
    const user = users.find((u) => u.id === id);
    return user?.name || user?.email || (id ? `User ${id}` : "-");
  };

  const filteredAccounts = useMemo(() => {
    if (!form.user) return accounts;
    return accounts.filter((acc) => Number(acc.user_id) === Number(form.user));
  }, [accounts, form.user]);

  const filteredEditAccounts = useMemo(() => {
    if (!editForm.user) return accounts;
    return accounts.filter((acc) => Number(acc.user_id) === Number(editForm.user));
  }, [accounts, editForm.user]);

  const onChangePage = (page) => {
    if (page < 1 || page > info.total_pages) return;
    setFilters((f) => ({ ...f, page }));
  };

  const pages = useMemo(() => {
    const arr = [];
    const { current_page, total_pages } = info;
    const start = Math.max(1, current_page - 2);
    const end = Math.min(total_pages, start + 4);
    for (let p = start; p <= end; p += 1) arr.push(p);
    return arr;
  }, [info]);

  const openCreateModal = () => {
    setErr("");
    setForm({ ...emptyForm });
    setAddOpen(true);
  };

  const onCreate = async () => {
    if (!form.name.trim()) {
      setErr("Project name is required");
      return;
    }
    if (!form.user) {
      setErr("Assign a user to this project");
      return;
    }

    setCreating(true);
    setErr("");
    try {
      const payload = {
        name: form.name.trim(),
        code: form.code?.trim() || undefined,
        description: form.description?.trim() || undefined,
        is_active: !!form.is_active,
        user: Number(form.user),
      };
      const created = await apiService.createProject(payload);

      if (form.budget_amount) {
        try {
          await apiService.createBudget({
            name: `${payload.name} Budget`,
            description: `Initial budget for ${payload.name}`,
            amount: Number(form.budget_amount),
            user: Number(form.user),
            project: created?.id,
            account: form.account ? Number(form.account) : undefined,
            is_active: true,
            period_start: form.start_date || undefined,
            period_end: form.end_date || undefined,
          });
        } catch {
          /* ignore budget failure but keep the project */
        }
      }

      setAddOpen(false);
      setForm({ ...emptyForm });
      fetchProjects();
    } catch (e) {
      setErr(e?.message || "Failed to create project");
    } finally {
      setCreating(false);
    }
  };

  const onOpenEdit = (project) => {
    setEditing(project);
    setErr("");
    setEditForm({
      name: project.name || "",
      code: project.code || "",
      description: project.description || "",
      is_active: !!project.is_active,
      user: project.user_id || "",
      account: "",
      budget_amount: "",
      start_date: "",
      end_date: "",
    });
  };

  const onSaveEdit = async () => {
    if (!editing) return;
    if (!editForm.name.trim()) {
      setErr("Project name is required");
      return;
    }
    if (!editForm.user) {
      setErr("Assign a user to this project");
      return;
    }

    setSaving(true);
    setErr("");
    try {
      const payload = {
        name: editForm.name.trim(),
        code: editForm.code?.trim() || undefined,
        description: editForm.description?.trim() || undefined,
        is_active: !!editForm.is_active,
        user: Number(editForm.user),
      };
      await apiService.updateProject(editing.id, payload);
      setEditing(null);
      fetchProjects();
    } catch (e) {
      setErr(e?.message || "Failed to update project");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (projectId) => {
    if (!window.confirm("Delete this project?")) return;
    setErr("");
    try {
      await apiService.deleteProject(projectId);
      setViewing((v) => (v?.id === projectId ? null : v));
      const isLastItem = rows.length === 1 && info.current_page > 1;
      setFilters((f) => ({
        ...f,
        page: isLastItem ? info.current_page - 1 : info.current_page,
      }));
      if (!isLastItem) fetchProjects();
    } catch (e) {
      setErr(e?.message || "Failed to delete project");
    }
  };

  const onView = async (project) => {
    setViewing(project);
    setBudgetsLoading(true);
    setBudgetRows([]);
    try {
      const res = await apiService.getBudgets({ project_id: project.id, page: 1, page_size: 100 });
      setBudgetRows(res?.results ?? []);
    } catch {
      setBudgetRows([]);
    } finally {
      setBudgetsLoading(false);
    }
  };

  const renderFormFields = (state, setState, accountOptions, includeBudget = false) => (
    <div className="mt-4 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label className="mb-1 block text-gray-700">Name</label>
        <input
          value={state.name}
          onChange={(e) => setState((prev) => ({ ...prev, name: e.target.value }))}
          className="w-full rounded-xl border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>
      <div>
        <label className="mb-1 block text-gray-700">Project Code</label>
        <input
          value={state.code}
          onChange={(e) => setState((prev) => ({ ...prev, code: e.target.value }))}
          className="w-full rounded-xl border border-gray-300 px-3 py-2"
        />
      </div>
      <div>
        <label className="mb-1 block text-gray-700">Status</label>
        <select
          value={state.is_active ? "1" : "0"}
          onChange={(e) => setState((prev) => ({ ...prev, is_active: e.target.value === "1" }))}
          className="w-full rounded-xl border border-gray-300 px-3 py-2"
        >
          <option value="1">Active</option>
          <option value="0">Archived</option>
        </select>
      </div>
      <div className="sm:col-span-2">
        <label className="mb-1 block text-gray-700">Assign to user</label>
        <select
          value={state.user}
          onChange={(e) => setState((prev) => ({ ...prev, user: e.target.value }))}
          className="w-full rounded-xl border border-gray-300 px-3 py-2"
        >
          <option value="">Select user</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name || u.email || `User ${u.id}`}
            </option>
          ))}
        </select>
      </div>
      {includeBudget && (
        <>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-gray-700">Link to account (optional)</label>
            <select
              value={state.account}
              onChange={(e) => setState((prev) => ({ ...prev, account: e.target.value }))}
              className="w-full rounded-xl border border-gray-300 px-3 py-2"
            >
              <option value="">Select account</option>
              {accountOptions.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-gray-700">Starting budget</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={state.budget_amount}
              onChange={(e) => setState((prev) => ({ ...prev, budget_amount: e.target.value }))}
              className="w-full rounded-xl border border-gray-300 px-3 py-2"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="mb-1 block text-gray-700">Start date</label>
            <input
              type="date"
              value={state.start_date}
              onChange={(e) => setState((prev) => ({ ...prev, start_date: e.target.value }))}
              className="w-full rounded-xl border border-gray-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-gray-700">End date</label>
            <input
              type="date"
              value={state.end_date}
              onChange={(e) => setState((prev) => ({ ...prev, end_date: e.target.value }))}
              className="w-full rounded-xl border border-gray-300 px-3 py-2"
            />
          </div>
        </>
      )}
      <div className="sm:col-span-2">
        <label className="mb-1 block text-gray-700">Description</label>
        <textarea
          value={state.description}
          onChange={(e) => setState((prev) => ({ ...prev, description: e.target.value }))}
          rows={3}
          className="w-full rounded-xl border border-gray-300 px-3 py-2"
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Projects</h1>
          <p className="text-sm text-gray-600">Assign workstreams to users and monitor their budgets.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search projects"
            className="h-9 w-56 rounded-xl border border-gray-300 px-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <select
            value={filters.page_size}
            onChange={(e) => setFilters((f) => ({ ...f, page_size: Number(e.target.value), page: 1 }))}
            className="h-9 rounded-xl border border-gray-300 px-2 text-sm"
          >
            {[6, 9, 12].map((n) => (
              <option key={n} value={n}>
                {n}/page
              </option>
            ))}
          </select>
          <button
            onClick={openCreateModal}
            className="h-9 rounded-xl bg-indigo-600 px-3 text-sm font-medium text-white hover:bg-indigo-700"
          >
            + New Project
          </button>
        </div>
      </div>

      {err && <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}

      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        {loading ? (
          <div className="py-8 text-center text-sm text-gray-600">Loading...</div>
        ) : rows.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-500">No projects found.</div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map((project) => (
                <div key={project.id} className="flex h-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                  <div className="border-b bg-gradient-to-r from-indigo-50 to-purple-50 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-base font-semibold">{project.name}</div>
                        {project.code && <div className="text-xs text-gray-500">Code: {project.code}</div>}
                      </div>
                      <span
                        className={`rounded-lg px-2 py-0.5 text-xs ${project.is_active ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-600"}`}
                      >
                        {project.is_active ? "Active" : "Archived"}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col justify-between p-4 text-sm text-gray-600">
                    <div className="space-y-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Assigned user</div>
                      <div className="text-gray-800">{userLabel(project.user_id)}</div>
                      {project.description && <p className="text-gray-600 line-clamp-3">{project.description}</p>}
                    </div>
                    <div className="mt-4 flex items-center justify-end gap-2">
                      <button
                        onClick={() => onView(project)}
                        className="rounded-xl border px-3 py-1 text-xs hover:bg-gray-50"
                      >
                        View
                      </button>
                      <button
                        onClick={() => onOpenEdit(project)}
                        className="rounded-xl border px-3 py-1 text-xs hover:bg-gray-50"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => onDelete(project.id)}
                        className="rounded-xl border border-red-200 px-3 py-1 text-xs text-red-600 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm">
              <div className="text-gray-600">
                Showing page <span className="font-medium">{info.current_page}</span> of {info.total_pages}
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="rounded-xl border px-3 py-1 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                  onClick={() => onChangePage(info.current_page - 1)}
                  disabled={info.current_page <= 1}
                >
                  Prev
                </button>
                {pages.map((p) => (
                  <button
                    key={p}
                    onClick={() => onChangePage(p)}
                    className={`rounded-xl px-3 py-1 border ${
                      p === info.current_page ? "border-indigo-600 bg-indigo-600 text-white" : "hover:bg-gray-50"
                    }`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  className="rounded-xl border px-3 py-1 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
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

      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setAddOpen(false)} />
          <div className="relative w-full max-w-2xl rounded-2xl border border-gray-200 bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">New project</h3>
              <button onClick={() => setAddOpen(false)} className="rounded-xl border px-3 py-1 text-xs hover:bg-gray-50">
                Close
              </button>
            </div>
            {renderFormFields(form, setForm, filteredAccounts, true)}
            <div className="mt-5 flex items-center justify-end gap-2">
              <button onClick={() => setAddOpen(false)} className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={onCreate}
                disabled={creating}
                className={`rounded-xl px-3 py-2 text-sm text-white ${
                  creating ? "bg-indigo-300" : "bg-indigo-600 hover:bg-indigo-700"
                }`}
              >
                {creating ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setEditing(null)} />
          <div className="relative w-full max-w-2xl rounded-2xl border border-gray-200 bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">Edit project</h3>
              <button onClick={() => setEditing(null)} className="rounded-xl border px-3 py-1 text-xs hover:bg-gray-50">
                Close
              </button>
            </div>
            {renderFormFields(editForm, setEditForm, filteredEditAccounts, false)}
            <div className="mt-5 flex items-center justify-end gap-2">
              <button onClick={() => setEditing(null)} className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={onSaveEdit}
                disabled={saving}
                className={`rounded-xl px-3 py-2 text-sm text-white ${
                  saving ? "bg-indigo-300" : "bg-indigo-600 hover:bg-indigo-700"
                }`}
              >
                {saving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setViewing(null)} />
          <div className="relative w-full max-w-3xl rounded-2xl border border-gray-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">{viewing.name}</h3>
                {viewing.code && <div className="text-xs text-gray-500">Code: {viewing.code}</div>}
              </div>
              <button onClick={() => setViewing(null)} className="rounded-xl border px-3 py-1 text-xs hover:bg-gray-50">
                Close
              </button>
            </div>
            <div className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Assigned user</div>
                <div className="text-gray-800">{userLabel(viewing.user_id)}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Status</div>
                <div className="text-gray-800">{viewing.is_active ? "Active" : "Archived"}</div>
              </div>
              {viewing.description && (
                <div className="sm:col-span-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Description</div>
                  <p className="mt-1 text-gray-700">{viewing.description}</p>
                </div>
              )}
            </div>
            <div className="mt-6">
              <div className="text-sm font-semibold text-gray-800">Budgets</div>
              {budgetsLoading ? (
                <div className="mt-2 text-sm text-gray-600">Loading budgets...</div>
              ) : budgetRows.length === 0 ? (
                <div className="mt-2 text-sm text-gray-500">No budgets linked to this project yet.</div>
              ) : (
                <div className="mt-3 overflow-x-auto rounded-2xl border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                        <th className="px-3 py-2">Name</th>
                        <th className="px-3 py-2">Amount</th>
                        <th className="px-3 py-2">Period</th>
                        <th className="px-3 py-2">Account</th>
                      </tr>
                    </thead>
                    <tbody>
                      {budgetRows.map((budget) => (
                        <tr key={budget.id} className="border-t">
                          <td className="px-3 py-2">{budget.name || "-"}</td>
                          <td className="px-3 py-2">{currencyFmt(budget.amount, budget.currency || "USD")}</td>
                          <td className="px-3 py-2">
                            {(budget.period_start || "").slice(0, 10)}
                            {budget.period_end ? ` -> ${String(budget.period_end).slice(0, 10)}` : ""}
                          </td>
                          <td className="px-3 py-2">
                            {budget.account_id ? accounts.find((a) => a.id === budget.account_id)?.name || `#${budget.account_id}` : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                onClick={() => onDelete(viewing.id)}
                className="rounded-xl border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                Delete project
              </button>
              <button onClick={() => setViewing(null)} className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
