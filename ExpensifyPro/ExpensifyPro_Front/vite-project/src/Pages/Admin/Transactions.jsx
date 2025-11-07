import { useEffect, useMemo, useState } from "react";
import { apiService } from "../../api";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";

const COLORS = {
  income: "#22C55E",   // green
  expense: "#EF4444",  // red
  transfer: "#3B82F6", // blue
};

const fmtMoney = (v, currency = "USD") =>
  new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 })
    .format(Number(v || 0));

const tidy = (s) => (s ? s[0].toUpperCase() + s.slice(1) : "-");

export default function Transactions() {
  // Table state
  const [rows, setRows] = useState([]);
  const [info, setInfo] = useState({ current_page: 1, total_pages: 1, total_items: 0 });
  const [filters, setFilters] = useState({ page: 1, page_size: 10, q: "", type: "" });
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // Debounced search (keeps input snappy)
  useEffect(() => { setSearchInput(filters.q || ""); }, []);
  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => ({ ...f, q: searchInput, page: 1 })), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Fetch data (includes type filter now)
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
        setRows([]);
        setInfo({ current_page: 1, total_pages: 1, total_items: 0 });
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, [filters.page, filters.page_size, filters.q, filters.type]); // <-- include type

  // Pagination helpers
  const pages = useMemo(() => {
    const arr = [];
    const start = Math.max(1, info.current_page - 2);
    const end = Math.min(info.total_pages, start + 4);
    for (let p = start; p <= end; p++) arr.push(p);
    return arr;
  }, [info]);

  // Charts (based on current page rows)
  const byDay = useMemo(() => {
    const map = new Map();
    for (const t of rows) {
      const dateISO = (t.date || "").slice(0, 10) || "Unknown";
      const prev = map.get(dateISO) || { date: dateISO, income: 0, expense: 0, transfer: 0 };
      const amt = Number(t.amount || 0);
      if (t.type === "income") prev.income += amt;
      else if (t.type === "expense") prev.expense += amt;
      else if (t.type === "transfer") prev.transfer += amt;
      map.set(dateISO, prev);
    }
    return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [rows]);

  const pieData = useMemo(() => {
    let income = 0, expense = 0, transfer = 0;
    for (const t of rows) {
      const amt = Number(t.amount || 0);
      if (t.type === "income") income += amt;
      else if (t.type === "expense") expense += amt;
      else if (t.type === "transfer") transfer += amt;
    }
    const data = [
      { name: "Income", value: income, fill: COLORS.income },
      { name: "Expense", value: expense, fill: COLORS.expense },
      { name: "Transfer", value: transfer, fill: COLORS.transfer },
    ];
    return data.filter(d => d.value > 0); // hide zero slices
  }, [rows]);

  const axisCurrency = rows[0]?.currency || "USD";
  const fmtDate = (iso) =>
    iso ? new Date(iso).toLocaleString(undefined, { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "-";

  return (
    <div className="space-y-6">
      {/* Header + minimal controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-semibold">Transactions</h2>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search description…"
            className="h-9 w-64 rounded-xl border border-gray-300 px-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {/* Type filter (works with search) */}
          <select
            value={filters.type}
            onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value, page: 1 }))}
            className="h-9 rounded-xl border border-gray-300 px-2 text-sm"
          >
            <option value="">All types</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
            <option value="transfer">Transfer</option>
          </select>
          <select
            value={filters.page_size}
            onChange={(e) => setFilters((f) => ({ ...f, page_size: Number(e.target.value), page: 1 }))}
            className="h-9 rounded-xl border border-gray-300 px-2 text-sm"
          >
            {[5, 10, 20, 50].map((n) => (
              <option key={n} value={n}>{n}/page</option>
            ))}
          </select>
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
                    <th className="py-2">ID</th>
                    <th className="py-2">Date</th>
                    <th className="py-2">Description</th>
                    <th className="py-2">Type</th>
                    <th className="py-2">Amount</th>
                    <th className="py-2">Currency</th>
                    <th className="py-2">Status</th>
                    <th className="py-2">Account</th>
                    <th className="py-2">To</th>
                    <th className="py-2">Project</th>
                    <th className="py-2">Category</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((t) => (
                    <tr key={t.id} className="border-t">
                      <td className="py-2">{t.id}</td>
                      <td className="py-2">{fmtDate(t.date)}</td>
                      <td className="py-2">{t.description || "-"}</td>
                      <td className="py-2">
                        <span
                          className="rounded-full px-2 py-0.5 text-xs font-medium"
                          style={{
                            backgroundColor: `${(COLORS[t.type] || "#888")}20`,
                            color: COLORS[t.type] || "#555",
                          }}
                        >
                          {tidy(t.type)}
                        </span>
                      </td>
                      <td className="py-2">{fmtMoney(t.amount, t.currency)}</td>
                      <td className="py-2">{t.currency}</td>
                      <td className="py-2">{tidy(t.status)}</td>
                      <td className="py-2">{t.account_id}</td>
                      <td className="py-2">{t.to_account_id ?? "-"}</td>
                      <td className="py-2">{t.project_id ?? "-"}</td>
                      <td className="py-2">{t.category_id ?? "-"}</td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={11} className="py-6 text-center text-gray-500">No transactions found.</td>
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
                  onClick={() => setFilters((f) => ({ ...f, page: Math.max(1, f.page - 1) }))}
                  disabled={info.current_page <= 1}
                  className="rounded-lg border px-2 py-1 disabled:opacity-50"
                >
                  Prev
                </button>
                {pages.map((p) => (
                  <button
                    key={p}
                    onClick={() => setFilters((f) => ({ ...f, page: p }))}
                    className={`rounded-lg border px-3 py-1 ${p === info.current_page ? "bg-gray-900 text-white" : "bg-white hover:bg-gray-50"}`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => setFilters((f) => ({ ...f, page: Math.min(info.total_pages, f.page + 1) }))}
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

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Stacked bar by day */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <div className="mb-2 text-sm font-medium text-gray-700">Daily Totals (current page)</div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byDay} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                <XAxis dataKey="date" />
                <YAxis tickFormatter={(v) => fmtMoney(v, axisCurrency)} />
                <Tooltip formatter={(v) => fmtMoney(v, axisCurrency)} />
                <Legend />
                <Bar dataKey="income" stackId="a" fill={COLORS.income} />
                <Bar dataKey="expense" stackId="a" fill={COLORS.expense} />
                <Bar dataKey="transfer" stackId="a" fill={COLORS.transfer} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Donut by type */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <div className="mb-2 text-sm font-medium text-gray-700">Distribution by Type (current page)</div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={95}
                  innerRadius={55}
                  paddingAngle={2}
                >
                  {pieData.map((d, i) => (
                    <Cell key={i} fill={d.fill} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => fmtMoney(v, axisCurrency)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
