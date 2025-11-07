import { useState, useMemo, useEffect } from "react";
import { apiService } from "../../api";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Area, ResponsiveContainer,
} from "recharts";

const COLORS = {
  history: "#ef4444",   // vibrant red
  forecast: "#3b82f6",  // bright blue
  upper: "#22c55e",     // vivid green
  lower: "#a855f7",     // bright purple
  grid: "#e5e7eb",      // light gray for grid
};

const DEFAULT_BODY = {
  target: "net",          // "net" | "income" | "expense"
  model: "arima",         // "arima" | "prophet"
  horizon: 6,             // months ahead
  date_from: null,
  date_to: null,
  currency: "USD",
};

export default function ArimaPage() {
  const [form, setForm] = useState(DEFAULT_BODY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: name === "horizon" ? Number(value) : value }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const payload = {
        ...form,
        date_from: form.date_from || null,
        date_to: form.date_to || null,
      };
      const data = await apiService.postForecast(payload); // ✅ use apiService
      setResult(data);
    } catch (err) {
      setError(err.message || "Forecast failed");
    } finally {
      setLoading(false);
    }
  };

  // optional: auto-run once on mount with defaults
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const data = await apiService.postForecast(DEFAULT_BODY);
        setResult(data);
      } catch (err) {
        // silent on first load
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const chartData = useMemo(() => {
    if (!result) return [];
    const history = (result.history || []).map((p) => ({
      period: p.period,
      history: p.value,
    }));
    const fc = (result.forecast || []).map((p) => ({
      period: p.period,
      forecast: p.yhat,
      lower: p.yhat_lower,
      upper: p.yhat_upper,
    }));

    const map = new Map();
    history.forEach((h) => map.set(h.period, { period: h.period, ...h }));
    fc.forEach((r) => map.set(r.period, { ...(map.get(r.period) || { period: r.period }), ...r }));
    return Array.from(map.values()).sort((a, b) => a.period.localeCompare(b.period));
  }, [result]);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <h1 className="text-2xl font-bold">Forecast (ARIMA / Prophet)</h1>

      <form onSubmit={submit} className="grid md:grid-cols-6 gap-3 bg-white rounded-2xl p-4 shadow">
        <div className="col-span-2">
          <label className="block text-sm font-medium mb-1">Target</label>
          <select name="target" value={form.target} onChange={onChange} className="w-full border rounded-lg p-2">
            <option value="net">Net</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>
        </div>

        <div className="col-span-2">
          <label className="block text-sm font-medium mb-1">Model</label>
          <select name="model" value={form.model} onChange={onChange} className="w-full border rounded-lg p-2">
            <option value="arima">ARIMA</option>
            <option value="prophet">Prophet</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Horizon (months)</label>
          <input type="number" name="horizon" min="1" max="36" value={form.horizon}
            onChange={onChange} className="w-full border rounded-lg p-2" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Currency</label>
          <input type="text" name="currency" value={form.currency} onChange={onChange}
            className="w-full border rounded-lg p-2" />
        </div>

        <div className="col-span-3">
          <label className="block text-sm font-medium mb-1">From (YYYY-MM-DD)</label>
          <input type="date" name="date_from" value={form.date_from || ""} onChange={onChange}
            className="w-full border rounded-lg p-2" />
        </div>
        <div className="col-span-3">
          <label className="block text-sm font-medium mb-1">To (YYYY-MM-DD)</label>
          <input type="date" name="date_to" value={form.date_to || ""} onChange={onChange}
            className="w-full border rounded-lg p-2" />
        </div>

        <div className="col-span-6">
          <button disabled={loading} className="px-4 py-2 rounded-xl bg-black text-white hover:opacity-90 disabled:opacity-50">
            {loading ? "Running..." : "Run Forecast"}
          </button>
          {error && <span className="ml-3 text-red-600 text-sm">{error}</span>}
        </div>
      </form>

      {result && (
        <div className="bg-white rounded-2xl p-4 shadow space-y-3">
          <div className="text-sm text-gray-600">
            <span className="font-semibold">Model:</span> {result.model_info?.model}
            {result.model_info?.order && (
              <> &middot; <span className="font-semibold">Order:</span> {JSON.stringify(result.model_info.order)}</>
            )}
          </div>

          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis />
                <Tooltip
                  contentStyle={{ backgroundColor: "#ffffff", borderRadius: "10px", borderColor: "#d1d5db" }}
                />
                <Legend />
                {/* Confidence intervals */}
                <Line type="monotone" dataKey="upper" name="Upper Bound" stroke={COLORS.upper} strokeDasharray="4 4" dot={false} />
                <Line type="monotone" dataKey="lower" name="Lower Bound" stroke={COLORS.lower} strokeDasharray="4 4" dot={false} />
                {/* Main data lines */}
                <Line type="monotone" dataKey="history" name="History" stroke={COLORS.history} strokeWidth={3} dot={false} />
                <Line type="monotone" dataKey="forecast" name="Forecast" stroke={COLORS.forecast} strokeWidth={3} strokeDasharray="6 4" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
