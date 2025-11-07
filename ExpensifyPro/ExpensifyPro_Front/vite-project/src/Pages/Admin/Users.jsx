import { useEffect, useMemo, useState } from "react";
import { apiService } from "../../api"; // adjust if needed

const ROLE_LABELS = { 1: "Admin", 2: "Employee", 3: "Guest" };

const ROLE_OPTIONS = [
  { value: 2, label: "Employee" },
  { value: 3, label: "Guest" },
];

function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

export default function Users() {
  const [rows, setRows] = useState([]);
  const [info, setInfo] = useState({ current_page: 1, total_pages: 1, total_items: 0 });
  const [filters, setFilters] = useState({ page: 1, page_size: 10, q: "" });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // Create modal state
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", email: "", role: 2, password: "" }); // default role: Employee
  const [creating, setCreating] = useState(false);

  // Edit modal state
  const [editing, setEditing] = useState(null); // {id, name, email, role}
  const [editForm, setEditForm] = useState({ name: "", email: "", role: 2, password: "" });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // Debounce search
  const [searchInput, setSearchInput] = useState("");
  useEffect(() => { setSearchInput(filters.q || ""); }, []); // init
  useEffect(() => {
    const t = setTimeout(() => setFilters(f => ({ ...f, q: searchInput, page: 1 })), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const fetchData = async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await apiService.getUsers(filters);
      setRows(res?.results ?? []);
      setInfo(res?.info ?? { current_page: 1, total_pages: 1, total_items: 0 });
    } catch (e) {
      setErr(e?.message || "Failed to load users");
      setRows([]);
      setInfo({ current_page: 1, total_pages: 1, total_items: 0 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.page, filters.page_size, filters.q]);

  // Open Edit
  const onOpenEdit = (u) => {
    setEditing(u);
    setEditForm({
      name: u.name || "",
      email: u.email || "",
      role: u.role ?? 2,
      password: "",
    });
  };

  // Save Edit
  const onSaveEdit = async () => {
    if (!editing) return;
    // minimal client validation
    if (!editForm.email.trim()) { setErr("Email is required"); return; }
    setSaving(true);
    setErr("");
    try {
      const payload = {
        name: editForm.name?.trim() || "",
        email: editForm.email.trim(),
        role: Number(editForm.role),
      };
      if (editForm.password?.trim()) payload.password = editForm.password.trim();
      await apiService.updateUser(editing.id, payload);
      setEditing(null);
      await fetchData();
    } catch (e) {
      setErr(e?.message || "Failed to update user");
    } finally {
      setSaving(false);
    }
  };

  // Delete
  const onDelete = async (id) => {
    if (!confirm("Delete this user?")) return;
    setDeletingId(id);
    setErr("");
    try {
      await apiService.deleteUser(id);
      const isLastItemOnPage = rows.length === 1 && filters.page > 1;
      setFilters((f) => ({ ...f, page: isLastItemOnPage ? f.page - 1 : f.page }));
      if (!isLastItemOnPage) fetchData();
    } catch (e) {
      setErr(e?.message || "Failed to delete user");
    } finally {
      setDeletingId(null);
    }
  };

  // Create
  const onCreate = async () => {
    // basic client checks
    if (!addForm.email.trim()) { setErr("Email is required"); return; }
    if (!addForm.password.trim()) { setErr("Password is required"); return; }

    setCreating(true);
    setErr("");
    try {
      const payload = {
        email: addForm.email.trim(),
        name: addForm.name?.trim() || "",
        role: Number(addForm.role), // 1/2/3
        password: addForm.password.trim(),
      };
      await apiService.createUser(payload); // org is taken from X-Org-Id by authFetch
      setAddOpen(false);
      setAddForm({ name: "", email: "", role: 2, password: "" });
      // refresh, keep current page unless empty
      const wasEmpty = rows.length === 0;
      if (wasEmpty) setFilters((f) => ({ ...f, page: 1 })); else await fetchData();
    } catch (e) {
      setErr(e?.message || "Failed to create user");
    } finally {
      setCreating(false);
    }
  };

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold">Users</h2>
        <div className="flex items-center gap-2">
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search name or email…"
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

          {/* NEW: Add User button */}
          <button
            onClick={() => setAddOpen(true)}
            className="h-9 rounded-xl bg-indigo-600 px-3 text-sm font-medium text-white hover:bg-indigo-700"
          >
            + Add User
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4">
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
                    <th className="py-2">ID</th>
                    <th className="py-2">Name</th>
                    <th className="py-2">Email</th>
                    <th className="py-2">Role</th>
                    <th className="py-2">Password</th>
                    <th className="py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((u) => (
                    <tr key={u.id} className="border-t">
                      <td className="py-2">{u.id}</td>
                      <td className="py-2">{u.name || "-"}</td>
                      <td className="py-2">{u.email}</td>
                      <td className="py-2">{ROLE_LABELS[u.role] ?? u.role}</td>
                      <td className="py-2">••••••••</td>
                      <td className="py-2">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => onOpenEdit(u)}
                            className="rounded-xl border px-3 py-1 text-xs hover:bg-gray-50"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => onDelete(u.id)}
                            disabled={deletingId === u.id}
                            className={classNames(
                              "rounded-xl px-3 py-1 text-xs text-white",
                              deletingId === u.id ? "bg-red-300" : "bg-red-600 hover:bg-red-700"
                            )}
                          >
                            {deletingId === u.id ? "Deleting…" : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td className="py-6 text-center text-gray-500" colSpan={6}>
                        No users found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="mt-4 flex items-center justify-between text-sm">
              <div className="text-gray-600">
                Showing page <span className="font-medium">{info.current_page}</span> of{" "}
                <span className="font-medium">{info.total_pages}</span> — {info.total_items} total
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onChangePage(info.current_page - 1)}
                  disabled={info.current_page <= 1}
                  className="rounded-lg border px-2 py-1 disabled:opacity-50"
                >
                  Prev
                </button>
                {pages.map((p) => (
                  <button
                    key={p}
                    onClick={() => onChangePage(p)}
                    className={classNames(
                      "rounded-lg border px-3 py-1",
                      p === info.current_page ? "bg-gray-900 text-white" : "bg-white hover:bg-gray-50"
                    )}
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => onChangePage(info.current_page + 1)}
                  disabled={info.current_page >= info.total_pages}
                  className="rounded-lg border px-2 py-1 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ====== Create Modal ====== */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Add User</h3>
              <button onClick={() => setAddOpen(false)} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <label className="text-sm">
                <div className="mb-1 text-gray-600">Name</div>
                <input
                  value={addForm.name}
                  onChange={(e) => setAddForm((s) => ({ ...s, name: e.target.value }))}
                  className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </label>

              <label className="text-sm">
                <div className="mb-1 text-gray-600">Email *</div>
                <input
                  value={addForm.email}
                  onChange={(e) => setAddForm((s) => ({ ...s, email: e.target.value }))}
                  className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </label>

              <label className="text-sm">
                <div className="mb-1 text-gray-600">Role</div>
                <select
                  value={addForm.role}
                  onChange={(e) => setAddForm((s) => ({ ...s, role: Number(e.target.value) }))}
                  className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {ROLE_OPTIONS.map(r => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm">
                <div className="mb-1 text-gray-600">Password *</div>
                <input
                  type="password"
                  value={addForm.password}
                  onChange={(e) => setAddForm((s) => ({ ...s, password: e.target.value }))}
                  className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </label>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button onClick={() => setAddOpen(false)} className="rounded-xl border px-4 py-2 text-sm">
                Cancel
              </button>
              <button
                onClick={onCreate}
                disabled={creating}
                className={classNames(
                  "rounded-xl px-4 py-2 text-sm text-white",
                  creating ? "bg-indigo-300" : "bg-indigo-600 hover:bg-indigo-700"
                )}
              >
                {creating ? "Creating…" : "Create user"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====== Edit Modal ====== */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Edit User</h3>
              <button onClick={() => setEditing(null)} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <label className="text-sm">
                <div className="mb-1 text-gray-600">Name</div>
                <input
                  value={editForm.name}
                  onChange={(e) => setEditForm((s) => ({ ...s, name: e.target.value }))}
                  className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </label>

              <label className="text-sm">
                <div className="mb-1 text-gray-600">Email *</div>
                <input
                  value={editForm.email}
                  onChange={(e) => setEditForm((s) => ({ ...s, email: e.target.value }))}
                  className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </label>

              <label className="text-sm">
                <div className="mb-1 text-gray-600">Role</div>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm((s) => ({ ...s, role: Number(e.target.value) }))}
                  className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </label>

              <label className="text-sm">
                <div className="mb-1 text-gray-600">Set New Password (optional)</div>
                <input
                  type="password"
                  value={editForm.password}
                  onChange={(e) => setEditForm((s) => ({ ...s, password: e.target.value }))}
                  placeholder="Leave blank to keep current password"
                  className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </label>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button onClick={() => setEditing(null)} className="rounded-xl border px-4 py-2 text-sm">
                Cancel
              </button>
              <button
                onClick={onSaveEdit}
                disabled={saving}
                className={classNames(
                  "rounded-xl px-4 py-2 text-sm text-white",
                  saving ? "bg-indigo-300" : "bg-indigo-600 hover:bg-indigo-700"
                )}
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
