import { useEffect, useMemo, useState } from "react";
import { apiService } from "../../api";
import { bumpCategoriesVersion } from "../../hooks/useCategories";

const KIND_FILTERS = [
  { value: "all", label: "All" },
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
];

const emptyForm = {
  name: "",
  description: "",
  kind: "expense",
};

const loadDepartments = () => {
  try {
    return JSON.parse(localStorage.getItem("category_departments") || "{}");
  } catch {
    return {};
  }
};

const currentAdminId = (() => {
  try {
    return JSON.parse(localStorage.getItem("exp_user") || "{}").id || null;
  } catch {
    return null;
  }
})();

export default function AdminCategories() {
  const [rows, setRows] = useState([]);
  const [info, setInfo] = useState({ current_page: 1, total_pages: 1, total_items: 0 });
  const [filters, setFilters] = useState({ page: 1, page_size: 10, q: "", kind: "all" });
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({ ...emptyForm });
  const [createOpen, setCreateOpen] = useState(false);

  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({ ...emptyForm });
  const [updating, setUpdating] = useState(false);

  const [deleting, setDeleting] = useState(null);
  const [deletingBusy, setDeletingBusy] = useState(false);
  const [deptMap, setDeptMap] = useState(loadDepartments());
  const [deptModal, setDeptModal] = useState(null);
  const [deptForm, setDeptForm] = useState({ name: "", notes: "" });
  const [deptSaving, setDeptSaving] = useState(false);

  useEffect(() => setSearchInput(filters.q || ""), [filters.q]);

  useEffect(() => {
    const id = setTimeout(() => setFilters((prev) => ({ ...prev, q: searchInput, page: 1 })), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  useEffect(() => {
    let ignore = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await apiService.getCategories({
          page: filters.page,
          page_size: filters.page_size,
          q: filters.q,
          kind: filters.kind === "all" ? undefined : filters.kind,
        });
        if (ignore) return;
        setRows(res?.results ?? []);
        setInfo(res?.info ?? { current_page: 1, total_pages: 1, total_items: 0 });
      } catch (e) {
        if (ignore) return;
        setError(e?.message || "Failed to load categories");
        setRows([]);
        setInfo({ current_page: 1, total_pages: 1, total_items: 0 });
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [filters.page, filters.page_size, filters.kind, filters.q]);

  const pages = useMemo(() => {
    const list = [];
    const start = Math.max(1, info.current_page - 2);
    const end = Math.min(info.total_pages, start + 4);
    for (let i = start; i <= end; i += 1) list.push(i);
    return list;
  }, [info]);

  const openCreateModal = () => {
    setCreateForm({ ...emptyForm, kind: filters.kind === "income" ? "income" : "expense" });
    setCreateOpen(true);
  };

  const closeCreateModal = () => {
    if (creating) return;
    setCreateOpen(false);
  };

  const submitCreate = async () => {
    if (!currentAdminId) {
      setError("Missing admin user context. Please re-login.");
      return;
    }
    if (!createForm.name.trim()) {
      setError("Category name is required");
      return;
    }
    setCreating(true);
    setError("");
    try {
      const payload = {
        name: createForm.name.trim(),
        description: createForm.description?.trim() || undefined,
        kind: createForm.kind,
        user: currentAdminId,
      };
      await apiService.createCategory(payload);
      bumpCategoriesVersion();
      setCreateOpen(false);
      setCreateForm({ ...emptyForm });
      setFilters((f) => ({ ...f }));
    } catch (e) {
      setError(e?.message || "Failed to create category");
    } finally {
      setCreating(false);
    }
  };

  const openEditModal = (category) => {
    setEditing(category);
    setEditForm({
      name: category.name || "",
      description: category.description || "",
      kind: category.kind || "expense",
    });
    setError("");
  };

  const closeEditModal = () => {
    if (updating) return;
    setEditing(null);
  };

  const submitEdit = async () => {
    if (!editing) return;
    if (!editForm.name.trim()) {
      setError("Category name is required");
      return;
    }
    setUpdating(true);
    setError("");
    try {
      await apiService.updateCategory(editing.id, {
        name: editForm.name.trim(),
        description: editForm.description?.trim() || null,
        kind: editForm.kind,
      });
      bumpCategoriesVersion();
      setEditing(null);
      setFilters((f) => ({ ...f }));
    } catch (e) {
      setError(e?.message || "Failed to update category");
    } finally {
      setUpdating(false);
    }
  };

  const confirmDelete = (category) => {
    setDeleting(category);
    setError("");
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setDeletingBusy(true);
    setError("");
    try {
      await apiService.deleteCategory(deleting.id);
      bumpCategoriesVersion();
      setDeleting(null);
      setFilters((f) => ({ ...f }));
    } catch (e) {
      setError(e?.message || "Failed to delete category");
    } finally {
      setDeletingBusy(false);
    }
  };

  const renderModal = (open, title, content, footer) => {
    if (!open) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b px-6 py-4">
            <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
            <button
              type="button"
              onClick={() => {
                if (footer === "create") closeCreateModal();
                else if (footer === "edit") closeEditModal();
                else setDeleting(null);
              }}
              className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
            >
              ×
            </button>
          </div>
          <div className="px-6 py-5">{content}</div>
          <div className="flex items-center justify-end gap-2 border-t bg-slate-50 px-6 py-3">
            {footer === "create" && (
              <>
                <button
                  type="button"
                  onClick={closeCreateModal}
                  className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitCreate}
                  disabled={creating}
                  className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow disabled:opacity-50"
                >
                  {creating ? "Saving..." : "Save"}
                </button>
              </>
            )}
            {footer === "edit" && (
              <>
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitEdit}
                  disabled={updating}
                  className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow disabled:opacity-50"
                >
                  {updating ? "Saving..." : "Update"}
                </button>
              </>
            )}
            {footer === "delete" && (
              <>
                <button
                  type="button"
                  onClick={() => setDeleting(null)}
                  className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deletingBusy}
                  className="rounded-2xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow disabled:opacity-50"
                >
                  {deletingBusy ? "Deleting..." : "Delete"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  const formFields = (state, setState) => (
    <div className="space-y-4 text-sm">
      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Name</label>
        <input
          value={state.name}
          onChange={(e) => setState((prev) => ({ ...prev, name: e.target.value }))}
          className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-2.5 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
        />
      </div>
      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Kind</label>
        <div className="mt-2 flex gap-2 rounded-2xl bg-slate-100 p-1">
          {["expense", "income"].map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => setState((prev) => ({ ...prev, kind }))}
              className={`flex-1 rounded-2xl px-4 py-2 text-sm font-semibold transition ${state.kind === kind ? "bg-white shadow" : "text-slate-500"
                }`}
            >
              {kind === "expense" ? "Expense" : "Income"}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Description
        </label>
        <textarea
          rows={3}
          value={state.description}
          onChange={(e) => setState((prev) => ({ ...prev, description: e.target.value }))}
          className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-2.5 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
          placeholder="Optional details that help teammates pick the right category."
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-500">Control</p>
          <h1 className="text-3xl font-bold text-slate-900">Categories</h1>
          <p className="text-sm text-slate-500">
            Create organization-wide income & expense categories for everyone to use.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:-translate-y-0.5 hover:bg-emerald-500"
        >
          + New category
        </button>
      </header>

      <div className="flex flex-wrap items-center gap-4 rounded-3xl border border-slate-200 bg-white/80 p-4 shadow-sm">
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
              d="m21 21-4.35-4.35m0-5.4a6.75 6.75 0 1 1-13.5 0 6.75 6.75 0 0 1 13.5 0Z"
            />
          </svg>
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search categories..."
            className="flex-1 border-none bg-transparent text-sm text-slate-700 outline-none"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {KIND_FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => setFilters((prev) => ({ ...prev, kind: filter.value, page: 1 }))}
              className={`rounded-2xl px-3 py-2 text-sm font-semibold transition ${filters.kind === filter.value
                ? "bg-emerald-600 text-white shadow"
                : "border border-slate-200 bg-white text-slate-600 hover:border-emerald-200 hover:text-emerald-600"
                }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {loading
          ? Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              className="h-48 animate-pulse rounded-3xl bg-gradient-to-br from-slate-100 to-slate-200"
            />
          ))
          : rows.length ? (
            rows.map((category) => (
              <article
                key={category.id}
                className="flex flex-col rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm ring-1 ring-slate-100"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">{category.name}</h3>
                    <p className="text-xs text-slate-400">ID: {category.id}</p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${category.kind === "income"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-amber-50 text-amber-700"
                      }`}
                  >
                    {category.kind === "income" ? "Income" : "Expense"}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-500">
                  {category.description || "No description provided."}
                </p>
                <p className="mt-2 text-xs text-slate-400">
                  Created{" "}
                  <span className="font-semibold text-slate-700">
                    {category.created_at
                      ? new Date(category.created_at).toLocaleDateString()
                      : "—"}
                  </span>
                </p>
                <div className="mt-4 flex flex-wrap gap-2 text-sm">
                  <button
                    type="button"
                    onClick={() => openEditModal(category)}
                    className="rounded-xl border border-slate-200 px-3 py-1 font-semibold text-slate-600 hover:border-emerald-200 hover:text-emerald-600"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => confirmDelete(category)}
                    className="rounded-xl border border-rose-200 px-3 py-1 font-semibold text-rose-600 hover:bg-rose-50"
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDeptModal(category);
                      setDeptForm({ name: "", notes: "" });
                    }}
                    className="rounded-xl border border-slate-200 px-3 py-1 font-semibold text-slate-600 hover:border-indigo-200 hover:text-indigo-600"
                  >
                    Manage departments
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                  {(deptMap[category.id] || []).slice(0, 4).map((dept, idx) => (
                    <span key={`${dept.name}-${idx}`} className="rounded-full bg-slate-100 px-3 py-1">
                      {dept.name}
                    </span>
                  ))}
                  {(deptMap[category.id] || []).length > 4 ? (
                    <span className="text-slate-400">
                      +{deptMap[category.id].length - 4} more
                    </span>
                  ) : null}
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white/80 px-6 py-16 text-center text-slate-500">
              <p className="text-lg font-semibold text-slate-700">No categories yet</p>
              <p className="mt-2 text-sm">Click “New category” to add your first one.</p>
            </div>
          )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-white/80 px-5 py-4 text-sm text-slate-600">
        <p>
          Showing {rows.length ? (info.current_page - 1) * filters.page_size + 1 : 0}-
          {rows.length ? (info.current_page - 1) * filters.page_size + rows.length : 0} of{" "}
          {info.total_items || 0}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFilters((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
            disabled={info.current_page <= 1}
            className="rounded-2xl border border-slate-200 px-3 py-1 text-sm font-semibold disabled:opacity-40"
          >
            Prev
          </button>
          {pages.map((page) => (
            <button
              key={page}
              type="button"
              onClick={() => setFilters((prev) => ({ ...prev, page }))}
              className={`h-9 w-9 rounded-2xl text-sm font-semibold ${info.current_page === page
                ? "bg-emerald-600 text-white"
                : "border border-slate-200 text-slate-600"
                }`}
            >
              {page}
            </button>
          ))}
          <button
            type="button"
            onClick={() =>
              setFilters((prev) => ({
                ...prev,
                page: Math.min(info.total_pages, prev.page + 1),
              }))
            }
            disabled={info.current_page >= info.total_pages}
            className="rounded-2xl border border-slate-200 px-3 py-1 text-sm font-semibold disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>

      {renderModal(
        createOpen,
        "Create category",
        <>
          {error ? (
            <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
              {error}
            </div>
          ) : null}
          {formFields(createForm, setCreateForm)}
        </>,
        "create",
      )}

      {renderModal(
        Boolean(editing),
        "Edit category",
        editing ? (
          <>
            {error ? (
              <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
                {error}
              </div>
            ) : null}
            {formFields(editForm, setEditForm)}
          </>
        ) : null,
        "edit",
      )}

      {renderModal(
        Boolean(deleting),
        "Delete category",
        deleting ? (
          <div className="space-y-3 text-sm text-slate-600">
            <p>
              Are you sure you want to delete <strong>{deleting.name}</strong>? This will remove it
              from category pickers across the workspace.
            </p>
            <p className="text-xs text-slate-500">Budgets and transactions keep their history.</p>
          </div>
        ) : null,
        "delete",
      )}

      {deptModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-emerald-500">Departments</p>
                <h3 className="text-lg font-semibold text-slate-900">{deptModal.name}</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDeptModal(null);
                  setDeptForm({ name: "", notes: "" });
                }}
                className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
              >
                ×
              </button>
            </div>
            <div className="px-6 py-5 space-y-4 text-sm">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Existing departments
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(deptMap[deptModal.id] || []).length ? (
                    deptMap[deptModal.id].map((dept, idx) => (
                      <span
                        key={`${dept.name}-${idx}`}
                        className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
                      >
                        {dept.name}
                      </span>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400">No departments yet.</p>
                  )}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Add department
                </p>
                <input
                  value={deptForm.name}
                  onChange={(e) => setDeptForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Department name"
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-2 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                />
                <textarea
                  rows={2}
                  value={deptForm.notes}
                  onChange={(e) => setDeptForm((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Notes (optional)"
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-2 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                />
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      if (!deptForm.name.trim()) return;
                      setDeptSaving(true);
                      const next = { ...deptMap };
                      const bucket = next[deptModal.id] ? [...next[deptModal.id]] : [];
                      bucket.push({
                        name: deptForm.name.trim(),
                        notes: deptForm.notes?.trim() || "",
                        created_at: new Date().toISOString(),
                      });
                      next[deptModal.id] = bucket;
                      localStorage.setItem("category_departments", JSON.stringify(next));
                      setDeptMap(next);
                      setDeptForm({ name: "", notes: "" });
                      setDeptSaving(false);
                    }}
                    disabled={deptSaving || !deptForm.name.trim()}
                    className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow disabled:opacity-50"
                  >
                    {deptSaving ? "Adding..." : "Add department"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
