import { useEffect, useMemo, useState } from "react";
import { apiService } from "../../api";
const tidy = (s) => (s ? s[0].toUpperCase() + s.slice(1) : "-");
const fmtMoney = (value, currency = "USD") =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const KIND_FILTERS = [
  { value: "all", label: "All" },
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
];

const getVersion = () => localStorage.getItem("categories_version") || "0";

export default function Categories() {
  const currentUserId = (() => {
    try {
      return JSON.parse(localStorage.getItem("exp_user") || "{}").id || null;
    } catch {
      return null;
    }
  })();
  const [rows, setRows] = useState([]);
  const [info, setInfo] = useState({ current_page: 1, total_pages: 1, total_items: 0 });
  const [filters, setFilters] = useState({ page: 1, page_size: 9, q: "", kind: "all" });
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(getVersion());
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [detailBudgets, setDetailBudgets] = useState([]);
  const [detailTransactions, setDetailTransactions] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  useEffect(() => {
    const storageHandler = (event) => {
      if (event.key === "categories_version") setVersion(event.newValue || Date.now().toString());
    };
    const customHandler = () => setVersion(Date.now().toString());
    window.addEventListener("storage", storageHandler);
    window.addEventListener("categories:updated", customHandler);
    return () => {
      window.removeEventListener("storage", storageHandler);
      window.removeEventListener("categories:updated", customHandler);
    };
  }, []);

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
  }, [filters.page, filters.page_size, filters.kind, filters.q, version]);

  const pages = useMemo(() => {
    const list = [];
    const start = Math.max(1, info.current_page - 2);
    const end = Math.min(info.total_pages, start + 4);
    for (let i = start; i <= end; i += 1) list.push(i);
    return list;
  }, [info]);

  const fetchDetails = async (category) => {
    if (!category) return;
    setDetailLoading(true);
    setDetailError("");
    try {
      const [budgetRes, txRes] = await Promise.all([
        apiService.getBudgets({
          page: 1,
          page_size: 100,
          category_id: category.id,
          user_id: currentUserId,
        }),
        apiService.getTransactions({
          page: 1,
          page_size: 100,
          category_id: category.id,
          user_id: currentUserId,
        }),
      ]);
      setDetailBudgets(budgetRes?.results ?? []);
      setDetailTransactions(txRes?.results ?? []);
    } catch (e) {
      setDetailError(e?.message || "Failed to load usage");
      setDetailBudgets([]);
      setDetailTransactions([]);
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-500">Library</p>
          <h1 className="text-3xl font-bold text-slate-900">Categories</h1>
          <p className="text-sm text-slate-500">
            These categories are provided by your admin. Pick them when creating budgets or
            transactions to keep reporting consistent.
          </p>
        </div>
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
                ? "bg-indigo-600 text-white shadow"
                : "border border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:text-indigo-600"
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
              className="h-44 animate-pulse rounded-3xl bg-gradient-to-br from-slate-100 to-slate-200"
            />
          ))
          : rows.map((category) => (
            <article
              key={category.id}
              onClick={() => {
                setSelectedCategory(category);
                fetchDetails(category);
              }}
              className="flex cursor-pointer flex-col rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm ring-1 ring-slate-100 transition hover:-translate-y-0.5 hover:shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900">{category.name}</h3>
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
              <div className="mt-4 flex flex-col gap-1 text-xs text-slate-500">
                <p>
                  Created{" "}
                  <span className="font-semibold text-slate-800">
                    {category.created_at
                      ? new Date(category.created_at).toLocaleDateString()
                      : "—"}
                  </span>
                </p>
                <p>
                  Category ID: <span className="font-mono text-slate-700">{category.id}</span>
                </p>
              </div>
            </article>
          ))}
      </div>

      {!loading && !rows.length ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white/70 px-6 py-16 text-center text-slate-500">
          <p className="text-lg font-semibold text-slate-700">No categories yet</p>
          <p className="mt-2 text-sm">
            Your admin hasn’t created any categories. Reach out if you need one added.
          </p>
        </div>
      ) : null}

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
                ? "bg-indigo-600 text-white"
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

      {selectedCategory ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-3xl rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-500">
                  Category usage
                </p>
                <h3 className="text-xl font-semibold text-slate-900">{selectedCategory.name}</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory(null);
                  setDetailBudgets([]);
                  setDetailTransactions([]);
                }}
                className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
              >
                ×
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto px-6 py-5 space-y-6">
              {detailError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
                  {detailError}
                </div>
              ) : null}
              {detailLoading ? (
                <div className="text-sm text-slate-500">Loading usage…</div>
              ) : (
                <>
                  <section>
                    <h4 className="text-sm font-semibold text-slate-800">Budgets</h4>
                    {detailBudgets.length ? (
                      <ul className="mt-3 space-y-2 text-sm">
                        {detailBudgets.map((budget) => (
                          <li
                            key={budget.id}
                            className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-2"
                          >
                            <div>
                              <p className="font-semibold text-slate-900">{budget.name}</p>
                              <p className="text-xs text-slate-400">
                                Amount {fmtMoney(budget.amount, budget.currency || "USD")}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedCategory(null);
                                window.location.href = "/user/budgets";
                              }}
                              className="text-xs font-semibold text-indigo-600 hover:underline"
                            >
                              View budget
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-xs text-slate-400">No budgets use this category.</p>
                    )}
                  </section>
                  <section>
                    <h4 className="text-sm font-semibold text-slate-800">Transactions</h4>
                    {detailTransactions.length ? (
                      <ul className="mt-3 space-y-2 text-sm">
                        {detailTransactions.map((tx) => (
                          <li
                            key={tx.id}
                            className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-2"
                          >
                            <div>
                              <p className="font-semibold text-slate-900">{tx.description || tidy(tx.type)}</p>
                              <p className="text-xs text-slate-400">
                                {new Date(tx.date).toLocaleDateString()} •{" "}
                                {fmtMoney(tx.amount, tx.currency || "USD")}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedCategory(null);
                                window.location.href = "/user/transactions";
                              }}
                              className="text-xs font-semibold text-indigo-600 hover:underline"
                            >
                              View transaction
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-xs text-slate-400">
                        No transactions use this category yet.
                      </p>
                    )}
                  </section>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
