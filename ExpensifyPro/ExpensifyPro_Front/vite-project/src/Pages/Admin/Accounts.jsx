import { useEffect, useMemo, useState } from "react";
import { apiService } from "../../api";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";

// ---------- Color helpers ----------
const PALETTE = [
  "#6366F1", "#22C55E", "#F59E0B", "#EF4444", "#3B82F6",
  "#A855F7", "#06B6D4", "#84CC16", "#E11D48", "#F97316",
];

const TYPE_COLORS = {
  bank: "#3B82F6",
  cash: "#22C55E",
  credit: "#EF4444",
  other: "#6366F1",
};

function pickColor(key) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  const idx = Math.abs(h) % PALETTE.length;
  return PALETTE[idx];
}

// ---------- Utils ----------
function classNames(...xs) { return xs.filter(Boolean).join(" "); }
const TYPE_LABEL = (t) => (t ? t[0].toUpperCase() + t.slice(1) : "-");
const fmtMoney = (v, currency = "USD") =>
  new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 })
    .format(Number(v || 0));

export default function Accounts() {
  // Table state
  const [rows, setRows] = useState([]);
  const [info, setInfo] = useState({ current_page: 1, total_pages: 1, total_items: 0 });
  const [filters, setFilters] = useState({
    page: 1, page_size: 10, q: "",
    user_id: undefined, type: undefined, currency: undefined,
  });
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // Charts state (now independent)
  const [chartScope, setChartScope] = useState("page");   // 'page' | 'all'
  const [chartMode, setChartMode] = useState("account");  // 'account' | 'type'
  const [chartFollowTableFilters, setChartFollowTableFilters] = useState(false); // NEW
  const [allForCharts, setAllForCharts] = useState([]);
  const [chartsLoading, setChartsLoading] = useState(false);
  const [chartsErr, setChartsErr] = useState("");

  // Debounce search (table only)
  useEffect(() => { setSearchInput(filters.q || ""); }, []);
  useEffect(() => {
    const t = setTimeout(() => setFilters(f => ({ ...f, q: searchInput, page: 1 })), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Fetch table data
  const fetchData = async () => {
    setLoading(true); setErr("");
    try {
      const res = await apiService.getAccounts(filters);
      setRows(res?.results ?? []);
      setInfo(res?.info ?? { current_page: 1, total_pages: 1, total_items: 0 });
    } catch (e) {
      setErr(e?.message || "Failed to load accounts");
      setRows([]); setInfo({ current_page: 1, total_pages: 1, total_items: 0 });
    } finally { setLoading(false); }
  };
  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.page, filters.page_size, filters.q, filters.user_id, filters.type, filters.currency]);

  // Robust "fetch ALL accounts" for charts (decoupled from table pagination)
  useEffect(() => {
    if (chartScope !== "all") return;
    let ignore = false;
    (async () => {
      setChartsLoading(true);
      setChartsErr("");
      try {
        const pageSize = 100;
        let page = 1;
        let acc = [];

        const common = chartFollowTableFilters
          ? { q: filters.q, type: filters.type, currency: filters.currency, user_id: filters.user_id }
          : {}; // ignore table filters when toggle is off

        const first = await apiService.getAccounts({ page, page_size: pageSize, ...common });
        const firstResults = first?.results ?? [];
        acc = acc.concat(firstResults);

        const totalItems = first?.info?.total_items ?? 0;
        let totalPages = totalItems
          ? Math.max(1, Math.ceil(totalItems / pageSize))
          : (first?.info?.total_pages || 1);

        const MAX_EXTRA_PAGES = 50;
        const targetPages = Math.min(totalPages, 1 + MAX_EXTRA_PAGES);

        while (page < targetPages) {
          page += 1;
          const resp = await apiService.getAccounts({ page, page_size: pageSize, ...common });
          const chunk = resp?.results ?? [];
          if (chunk.length === 0) break;
          acc = acc.concat(chunk);
        }

        if (!ignore) setAllForCharts(acc);
      } catch (e) {
        if (!ignore) {
          setChartsErr(e?.message || "Failed to load full accounts for charts");
          setAllForCharts([]);
        }
      } finally {
        if (!ignore) setChartsLoading(false);
      }
    })();
    return () => { ignore = true; };
    // IMPORTANT: do NOT depend on table page/page_size; charts ignore pagination.
  }, [chartScope, chartFollowTableFilters, filters.q, filters.type, filters.currency, filters.user_id]);

  // Pagination for table
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

  // ===== Charts data (based on scope + mode) =====
  const chartRows = chartScope === "all" ? allForCharts : rows;

  const barData = useMemo(() => {
    if (chartMode === "type") {
      const byType = {};
      for (const a of chartRows) {
        const k = a.type || "other";
        byType[k] = (byType[k] || 0) + Number(a.balance || 0);
      }
      return Object.entries(byType).map(([type, balance]) => ({
        name: TYPE_LABEL(type),
        balance,
        _color: TYPE_COLORS[type] || pickColor(type),
      }));
    }
    return chartRows.map((a) => ({
      name: a.name || `#${a.id}`,
      balance: Number(a.balance || 0),
      currency: a.currency || "USD",
      _color: pickColor(a.name || String(a.id)),
    }));
  }, [chartRows, chartMode]);

  const pieData = useMemo(() => {
    const acc = {};
    for (const a of chartRows) {
      const k = a.type || "other";
      const bal = Number(a.balance || 0);
      acc[k] = (acc[k] || 0) + bal;
    }
    return Object.entries(acc).map(([k, v]) => ({
      name: TYPE_LABEL(k),
      value: v,
      _color: TYPE_COLORS[k] || pickColor(k),
    }));
  }, [chartRows]);

  const axisCurrency = chartRows[0]?.currency || "USD";

  return (
    <div className="space-y-6">
      {/* Header + Controls (TABLE ONLY) */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-semibold">Accounts</h2>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name…"
            className="h-9 w-56 rounded-xl border border-gray-300 px-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <select
            value={filters.page_size}
            onChange={(e) => setFilters(f => ({ ...f, page_size: Number(e.target.value), page: 1 }))}
            className="h-9 rounded-xl border border-gray-300 px-2 text-sm"
          >
            {[5, 10, 20, 50].map(n => <option key={n} value={n}>{n}/page</option>)}
          </select>
          <select
            value={filters.type || ""}
            onChange={(e) => setFilters(f => ({ ...f, type: e.target.value || undefined, page: 1 }))}
            className="h-9 rounded-xl border border-gray-300 px-2 text-sm"
          >
            <option value="">All types</option>
            <option value="cash">Cash</option>
            <option value="bank">Bank</option>
            <option value="credit">Credit</option>
            <option value="other">Other</option>
          </select>
          <select
            value={filters.currency || ""}
            onChange={(e) => setFilters(f => ({ ...f, currency: e.target.value || undefined, page: 1 }))}
            className="h-9 rounded-xl border border-gray-300 px-2 text-sm"
          >
            <option value="">All currencies</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="LBP">LBP</option>
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
                    <th className="py-2">Name</th>
                    <th className="py-2">Type</th>
                    <th className="py-2">Currency</th>
                    <th className="py-2">Balance</th>
                    <th className="py-2">Default</th>
                    <th className="py-2">User ID</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((a) => (
                    <tr key={a.id} className="border-t">
                      <td className="py-2">{a.id}</td>
                      <td className="py-2">{a.name}</td>
                      <td className="py-2">{TYPE_LABEL(a.type)}</td>
                      <td className="py-2">{a.currency}</td>
                      <td className="py-2">{fmtMoney(a.balance, a.currency)}</td>
                      <td className="py-2">{a.is_default ? "Yes" : "No"}</td>
                      <td className="py-2">{a.user_id}</td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-gray-500">No accounts found.</td>
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

      {/* Charts controls (INDEPENDENT) */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <div className="rounded-xl border border-gray-200 bg-white px-3 py-2">
          <span className="mr-2 font-medium text-gray-700">Scope:</span>
          <select
            value={chartScope}
            onChange={(e) => setChartScope(e.target.value)}
            className="rounded-lg border px-2 py-1"
          >
            <option value="page">This page</option>
            <option value="all">All accounts</option>
          </select>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white px-3 py-2">
          <span className="mr-2 font-medium text-gray-700">Mode:</span>
          <select
            value={chartMode}
            onChange={(e) => setChartMode(e.target.value)}
            className="rounded-lg border px-2 py-1"
          >
            <option value="account">Per account</option>
            <option value="type">By type</option>
          </select>
        </div>
        <label className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2">
          <input
            type="checkbox"
            checked={chartFollowTableFilters}
            onChange={(e) => setChartFollowTableFilters(e.target.checked)}
          />
          <span>Use table filters</span>
        </label>

        {chartScope === "all" && (chartsLoading || chartsErr) && (
          <div
            className={classNames(
              "rounded-xl px-3 py-2",
              chartsErr ? "border border-red-200 bg-red-50 text-red-700" : "border border-gray-200 bg-white text-gray-600"
            )}
          >
            {chartsErr ? chartsErr : "Loading full dataset…"}
          </div>
        )}
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Bar chart */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <div className="mb-2 text-sm font-medium text-gray-700">
            {chartMode === "type" ? "Balances by Type" : "Balances by Account"}
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                <XAxis dataKey="name" interval={0} angle={-15} textAnchor="end" height={40} />
                <YAxis tickFormatter={(v) => fmtMoney(v, axisCurrency)} />
                <Tooltip formatter={(v) => fmtMoney(v, axisCurrency)} />
                <Bar dataKey="balance">
                  {barData.map((d, i) => (
                    <Cell key={`bar-${i}`} fill={d._color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie chart */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <div className="mb-2 text-sm font-medium text-gray-700">Balance Distribution by Type</div>
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
                    <Cell key={`pie-${i}`} fill={d._color} />
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
