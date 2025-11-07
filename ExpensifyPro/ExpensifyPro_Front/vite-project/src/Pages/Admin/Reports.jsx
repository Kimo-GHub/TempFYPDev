import { useEffect, useMemo, useState } from "react";
import { apiService } from "../../api";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, Legend,
  PieChart, Pie, Cell, BarChart, Bar,
} from "recharts";

const COLORS = { income: "#22C55E", expense: "#EF4444", net: "#6366F1" };
const PIE = ["#6366F1","#22C55E","#F59E0B","#EF4444","#3B82F6","#A855F7","#06B6D4","#84CC16","#E11D48","#F97316"];

const fmtMoney = (v, curr="USD") =>
  new Intl.NumberFormat(undefined,{style:"currency",currency:curr,maximumFractionDigits:2}).format(Number(v||0));

const quickRanges = [
  { key: "30d", label: "Last 30d", days: 30 },
  { key: "90d", label: "Last 90d", days: 90 },
  { key: "ytd", label: "YTD", ytd: true },
  { key: "12m", label: "12M", months: 12 },
];

function computeRange(key) {
  const now = new Date();
  if (key === "ytd") {
    return { from: new Date(now.getFullYear(),0,1), to: now };
  }
  if (key === "12m") {
    return { from: new Date(now.getFullYear()-1, now.getMonth(), now.getDate()), to: now };
  }
  const item = quickRanges.find(x=>x.key===key) || quickRanges[0];
  const from = new Date(now);
  from.setDate(from.getDate() - (item.days || 30));
  return { from, to: now };
}

function toISO(d){return d.toISOString().slice(0,10);}

export default function Reports() {
  const [rangeKey, setRangeKey] = useState("30d");
  const [currency, setCurrency] = useState("USD");
  const { from, to } = useMemo(()=>computeRange(rangeKey),[rangeKey]);

  const [series, setSeries] = useState({ points: [], granularity: "month" });
  const [cats, setCats] = useState({ slices: [], other_total: 0, kind: "expense" });
  const [bva, setBva] = useState({ rows: [] });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let ignore = false;
    (async () => {
      setLoading(true); setErr("");
      try {
        const params = {
          date_from: toISO(from),
          date_to: toISO(to),
          currency,
          granularity: (rangeKey==="30d" ? "day" : "month"),
        };
        const [ts, cat, b] = await Promise.all([
          apiService.getReportTimeSeries(params),
          apiService.getReportByCategory({ ...params, kind: "expense" }),
          apiService.getReportBudgetVsActual(params),
        ]);
        if (ignore) return;
        setSeries(ts || { points: [], granularity: "month" });
        setCats(cat || { slices: [], other_total: 0, kind: "expense" });
        setBva(b || { rows: [] });
      } catch (e) {
        if (ignore) return;
        setErr(e?.message || "Failed to load reports");
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, [rangeKey, currency]);

  // CSV exports (client-side)
  const downloadCSV = (filename, rows, headers) => {
    const csv = [
      headers.join(","),
      ...rows.map(r => headers.map(h => JSON.stringify(r[h] ?? "")).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  // Data mappings for charts
  const tsData = useMemo(() => series.points.map(p=>({
    period: p.period, income: p.income, expense: p.expense, net: p.net
  })), [series]);

  const pieData = useMemo(() => {
    const arr = [...(cats.slices||[])].sort((a,b)=>b.total-a.total);
    if (cats.other_total && cats.other_total>0) arr.push({ id: 0, name: "Other", total: cats.other_total });
    return arr;
  }, [cats]);

  const bvaData = useMemo(() => (bva.rows||[]).map(r=>({
    name: r.name, budgeted: r.budgeted, actual: r.actual, percent_used: r.percent_used
  })), [bva]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Reports</h2>
          <p className="text-gray-600 text-sm">Spending trends, category insights, budgets, and exports.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl border overflow-hidden">
            {quickRanges.map(r=>(
              <button key={r.key}
                onClick={()=>setRangeKey(r.key)}
                className={`px-3 py-1.5 text-sm ${rangeKey===r.key?"bg-gray-900 text-white":"bg-white hover:bg-gray-50"}`}>
                {r.label}
              </button>
            ))}
          </div>
          <select
            value={currency}
            onChange={(e)=>setCurrency(e.target.value)}
            className="h-9 rounded-xl border border-gray-300 px-2 text-sm"
          >
            <option>USD</option><option>EUR</option><option>LBP</option>
          </select>
        </div>
      </div>

      {err && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div>}

      {/* Cashflow */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm font-medium text-gray-700">Cashflow Over Time</div>
          <button
            onClick={()=>downloadCSV("cashflow.csv", tsData, ["period","income","expense","net"])}
            className="text-xs rounded-lg border px-2 py-1 hover:bg-gray-50"
          >Export CSV</button>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={tsData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
              <XAxis dataKey="period" />
              <YAxis tickFormatter={(v)=>fmtMoney(v,currency)} />
              <Tooltip formatter={(v)=>fmtMoney(v,currency)} />
              <Legend />
              <Area type="monotone" dataKey="income" stroke={COLORS.income} fill={`${COLORS.income}33`} />
              <Area type="monotone" dataKey="expense" stroke={COLORS.expense} fill={`${COLORS.expense}33`} />
              <Area type="monotone" dataKey="net" stroke={COLORS.net} fill={`${COLORS.net}33`} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-medium text-gray-700">Spend by Category</div>
            <button
              onClick={()=>downloadCSV("by-category.csv", pieData.map(x=>({name:x.name,total:x.total})), ["name","total"])}
              className="text-xs rounded-lg border px-2 py-1 hover:bg-gray-50"
            >Export CSV</button>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="total" nameKey="name" outerRadius={110} innerRadius={60} paddingAngle={2}>
                  {pieData.map((_,i)=><Cell key={i} fill={PIE[i%PIE.length]} />)}
                </Pie>
                <Tooltip formatter={(v)=>fmtMoney(v,currency)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Budget vs Actual */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-medium text-gray-700">Budget vs Actual</div>
            <button
              onClick={()=>downloadCSV("budget-vs-actual.csv", bvaData, ["name","budgeted","actual","percent_used"])}
              className="text-xs rounded-lg border px-2 py-1 hover:bg-gray-50"
            >Export CSV</button>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bvaData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                <XAxis dataKey="name" interval={0} angle={-15} textAnchor="end" height={40} />
                <YAxis tickFormatter={(v)=>fmtMoney(v,currency)} />
                <Tooltip formatter={(v)=>fmtMoney(v,currency)} />
                <Legend />
                <Bar dataKey="budgeted" fill="#94A3B8" />
                <Bar dataKey="actual" fill="#0EA5E9" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

     
     
    </div>
  );
}
