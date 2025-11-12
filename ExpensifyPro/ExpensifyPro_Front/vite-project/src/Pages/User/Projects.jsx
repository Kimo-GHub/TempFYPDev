import { useEffect, useMemo, useState } from "react";
import { apiService } from "../../api";

export default function Projects() {
  const currentUserId = (() => { try { return JSON.parse(localStorage.getItem("exp_user") || "{}").id || null; } catch { return null; } })();

  const [rows, setRows] = useState([]);
  const [info, setInfo] = useState({ current_page: 1, total_pages: 1, total_items: 0 });
  const [filters, setFilters] = useState({ page: 1, page_size: 9, q: "", user_id: currentUserId });
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => { setSearchInput(filters.q || ""); }, []);
  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => ({ ...f, q: searchInput, page: 1 })), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const fetchData = async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await apiService.getProjects(filters);
      setRows(res?.results ?? []);
      setInfo(res?.info ?? { current_page: 1, total_pages: 1, total_items: 0 });
    } catch (e) {
      setErr(e?.message || "Failed to load projects");
      setRows([]);
      setInfo({ current_page: 1, total_pages: 1, total_items: 0 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.page, filters.page_size, filters.q, filters.user_id]);

  const onChangePage = (page) => { if (page < 1 || page > info.total_pages) return; setFilters((f) => ({ ...f, page })); };
  const pages = useMemo(() => {
    const arr = [];
    const { current_page, total_pages } = info;
    const start = Math.max(1, current_page - 2);
    const end = Math.min(total_pages, start + 4);
    for (let p = start; p <= end; p++) arr.push(p);
    return arr;
  }, [info]);

  // Create modal (simple)
  const [addOpen, setAddOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", description: "", is_active: true, account: "", budget_amount: "", start_date: "", end_date: "" });
  const [accounts, setAccounts] = useState([]);
  const [viewing, setViewing] = useState(null);
  const [budgetsLoading, setBudgetsLoading] = useState(false);
  const [budgetRows, setBudgetRows] = useState([]);

  // load user's accounts for the account selector
  useEffect(() => {
    (async () => {
      try {
        const res = await apiService.getAccounts({ user_id: currentUserId, page: 1, page_size: 100 });
        setAccounts(res?.results ?? []);
      } catch {
        setAccounts([]);
      }
    })();
  }, [currentUserId]);
  const onCreate = async () => {
    if (!form.name.trim()) { setErr("Project name is required"); return; }
    if (!currentUserId) { setErr("Missing user session"); return; }
    setCreating(true); setErr("");
    try {
      const payload = {
        name: form.name.trim(),
        code: form.code?.trim() || undefined,
        description: form.description?.trim() || undefined,
        is_active: !!form.is_active,
        user: currentUserId,
      };
      const created = await apiService.createProject(payload);

      // If a starting budget is provided, create a budget linked to this project and (optionally) account
      if (form.budget_amount !== "") {
        try {
          const bPayload = {
            name: `${payload.name} Budget`,
            description: `Initial budget for ${payload.name}`,
            amount: Number(form.budget_amount),
            user: currentUserId,
            project: created?.id,
            account: form.account ? Number(form.account) : undefined,
            is_active: true,
            period_start: form.start_date || undefined,
            period_end: form.end_date || undefined,
          };
          await apiService.createBudget(bPayload);
        } catch { /* ignore budget failure so project still gets created */ }
      }

      setAddOpen(false);
      setForm({ name: "", code: "", description: "", is_active: true, account: "", budget_amount: "", start_date: "", end_date: "" });
      fetchData();
    } catch (e) {
      setErr(e?.message || "Failed to create project");
    } finally { setCreating(false); }
  };

  const onView = async (p) => {
    setViewing(p);
    setBudgetsLoading(true);
    setBudgetRows([]);
    try {
      const res = await apiService.getBudgets({ project_id: p.id, page: 1, page_size: 100 });
      setBudgetRows(res?.results ?? []);
    } catch { setBudgetRows([]); }
    finally { setBudgetsLoading(false); }
  };

  const onDelete = async (id) => {
    if (!confirm('Delete this project?')) return;
    try {
      await apiService.deleteProject(id);
      setViewing(null);
      fetchData();
    } catch (e) {
      setErr(e?.message || 'Failed to delete project');
    }
  };

  return (
    <div className="space-y-4">
      {/* Header / actions */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Projects</h1>
          <p className="text-gray-600 text-sm">Group work and budgets by project.</p>
        </div>
        <div className="flex items-center gap-2">
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
              <option key={n} value={n}>{n}/page</option>
            ))}
          </select>
          <button onClick={() => setAddOpen(true)} className="h-9 rounded-xl bg-indigo-600 px-3 text-sm font-medium text-white hover:bg-indigo-700">
            + New Project
          </button>
        </div>
      </div>

      {/* Grid of project cards */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        {loading ? (
          <div className="text-sm text-gray-600">Loading…</div>
        ) : err ? (
          <div className="text-sm text-red-600">{err}</div>
        ) : (
          <>
            {rows.length === 0 ? (
              <div className="text-sm text-gray-500 py-8 text-center">No projects yet.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {rows.map((p) => (
                  <div key={p.id} className="rounded-2xl border border-gray-200 bg-white shadow-sm p-0 overflow-hidden">
                    <div className="bg-linear-to-r from-indigo-50 to-purple-50 p-4 border-b">
                      <div className="flex items-center justify-between">
                        <div className="text-base font-semibold">{p.name}</div>
                        <span className={`text-xs rounded-lg px-2 py-0.5 ${p.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>{p.is_active ? 'Active' : 'Archived'}</span>
                      </div>
                      {p.code && <div className="text-xs text-gray-500 mt-0.5">Code: {p.code}</div>}
                    </div>
                    <div className="p-4">
                      {p.description && <p className="text-sm text-gray-700 line-clamp-3">{p.description}</p>}
                      <div className="mt-3 flex items-center justify-end gap-2">
                        <button onClick={() => onView(p)} className="rounded-xl border px-3 py-1 text-xs hover:bg-gray-50">View</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            <div className="mt-4 flex items-center justify-between text-sm">
              <div className="text-gray-600">Showing page <span className="font-medium">{info.current_page}</span> of {info.total_pages}</div>
              <div className="flex items-center gap-2">
                <button className="rounded-xl border px-3 py-1 hover:bg-gray-50" onClick={() => onChangePage(info.current_page - 1)} disabled={info.current_page <= 1}>Prev</button>
                {pages.map((p) => (
                  <button key={p} onClick={() => onChangePage(p)} className={`rounded-xl px-3 py-1 border ${p === info.current_page ? "bg-indigo-600 text-white border-indigo-600" : "hover:bg-gray-50"}`}>{p}</button>
                ))}
                <button className="rounded-xl border px-3 py-1 hover:bg-gray-50" onClick={() => onChangePage(info.current_page + 1)} disabled={info.current_page >= info.total_pages}>Next</button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Create modal */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setAddOpen(false)} />
          <div className="relative w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-5 shadow-lg">
            <h3 className="text-base font-semibold">New Project</h3>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="sm:col-span-2">
                <label className="block text-gray-700 mb-1">Name</label>
                <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="w-full rounded-xl border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-gray-700 mb-1">Code</label>
                <input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} className="w-full rounded-xl border border-gray-300 px-3 py-2" />
              </div>
              <div>
                <label className="block text-gray-700 mb-1">Active</label>
                <select value={form.is_active ? "1" : "0"} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.value === "1" }))} className="w-full rounded-xl border border-gray-300 px-3 py-2">
                  <option value="1">Active</option>
                  <option value="0">Archived</option>
                </select>
              </div>
              <div>
                <label className="block text-gray-700 mb-1">Account (optional)</label>
                <select value={form.account} onChange={(e) => setForm((f) => ({ ...f, account: e.target.value }))} className="w-full rounded-xl border border-gray-300 px-3 py-2">
                  <option value="">Select account</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-gray-700 mb-1">Starting Budget</label>
                <input type="number" step="0.01" value={form.budget_amount} onChange={(e) => setForm((f) => ({ ...f, budget_amount: e.target.value }))} className="w-full rounded-xl border border-gray-300 px-3 py-2" placeholder="0.00" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-gray-700 mb-1">Description</label>
                <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="w-full rounded-xl border border-gray-300 px-3 py-2" rows={3} />
              </div>
              <div>
                <label className="block text-gray-700 mb-1">Start Date</label>
                <input type="date" value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} className="w-full rounded-xl border border-gray-300 px-3 py-2" />
              </div>
              <div>
                <label className="block text-gray-700 mb-1">End Date</label>
                <input type="date" value={form.end_date} onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))} className="w-full rounded-xl border border-gray-300 px-3 py-2" />
              </div>
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button onClick={() => setAddOpen(false)} className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50">Cancel</button>
              <button onClick={onCreate} disabled={creating} className={`rounded-xl px-3 py-2 text-sm text-white ${creating ? "bg-indigo-300" : "bg-indigo-600 hover:bg-indigo-700"}`}>{creating ? "Creating…" : "Create"}</button>
            </div>
          </div>
        </div>
      )}

      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setViewing(null)} />
          <div className="relative w-full max-w-2xl rounded-2xl border border-gray-200 bg-white p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">{viewing.name}</h3>
              <button onClick={() => setViewing(null)} className="rounded-xl border px-3 py-1 text-xs hover:bg-gray-50">Close</button>
            </div>
            <div className="mt-2 text-sm text-gray-700">
              {viewing.code && <div className="text-xs text-gray-500">Code: {viewing.code}</div>}
              {viewing.description && <p className="mt-2">{viewing.description}</p>}
            </div>
            <div className="mt-4">
              <div className="text-sm font-medium mb-2">Budgets</div>
              {budgetsLoading ? (
                <div className="text-sm text-gray-600">Loading…</div>
              ) : budgetRows.length === 0 ? (
                <div className="text-sm text-gray-500">No budgets for this project.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500">
                        <th className="py-2">Name</th>
                        <th className="py-2">Amount</th>
                        <th className="py-2">Period</th>
                      </tr>
                    </thead>
                    <tbody>
                      {budgetRows.map((b) => (
                        <tr key={b.id} className="border-t">
                          <td className="py-2">{b.name || '-'}</td>
                          <td className="py-2">{new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(Number(b.amount || 0))}</td>
                          <td className="py-2">{(b.period_start || '').slice(0,10)}{b.period_end ? ` → ${String(b.period_end).slice(0,10)}` : ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button onClick={() => onDelete(viewing.id)} className="rounded-xl px-3 py-2 text-xs text-white bg-red-600 hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
