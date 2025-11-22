import { useState, useMemo } from "react";
import { apiService } from "../../api";
import {
LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

const COLORS = {
history: "#ef4444",
longTerm: "#3b82f6",
seasonal: "#f97316",
upper: "#22c55e",
lower: "#a855f7",
grid: "#e5e7eb",
};

const DEFAULT_BODY = {
target: "net",
horizon: 6,
date_from: null,
date_to: null,
currency: "USD",
};

export default function ForecastPage() {
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
const payload = { ...form, date_from: form.date_from || null, date_to: form.date_to || null };
const data = await apiService.postForecast(payload);
setResult(data);
} catch (err) {
setError(err.message || "Forecast failed");
} finally {
setLoading(false);
}
};

const prepareChartData = (history, forecast) => {
const map = new Map();
history.forEach((h) => map.set(h.period, { period: h.period, history: h.value }));
forecast.forEach((f) =>
map.set(f.period, { ...(map.get(f.period) || { period: f.period }), forecast: f.yhat, lower: f.yhat_lower, upper: f.yhat_upper })
);
return Array.from(map.values()).sort((a, b) => a.period.localeCompare(b.period));
};

const longTermChart = useMemo(() => {
if (!result?.arima_forecast) return [];
return prepareChartData(result.history || [], result.arima_forecast);
}, [result]);

const seasonalChart = useMemo(() => {
if (!result?.prophet_forecast) return [];
return prepareChartData(result.history || [], result.prophet_forecast);
}, [result]);

return ( <div className="p-4 md:p-6"> <h1 className="text-2xl font-bold mb-4">Forecast</h1>


  <form onSubmit={submit} className="grid md:grid-cols-6 gap-3 bg-white rounded-2xl p-4 shadow mb-6">
    <div className="col-span-2">
      <label className="block text-sm font-medium mb-1">Target</label>
      <select name="target" value={form.target} onChange={onChange} className="w-full border rounded-lg p-2">
        <option value="net">Net</option>
        <option value="income">Income</option>
        <option value="expense">Expense</option>
      </select>
    </div>

    <div>
      <label className="block text-sm font-medium mb-1">Horizon (months)</label>
      <input type="number" name="horizon" min="1" max="36" value={form.horizon} onChange={onChange} className="w-full border rounded-lg p-2" />
    </div>

    <div>
      <label className="block text-sm font-medium mb-1">Currency</label>
      <input type="text" name="currency" value={form.currency} onChange={onChange} className="w-full border rounded-lg p-2" />
    </div>

    <div className="col-span-3">
      <label className="block text-sm font-medium mb-1">From (YYYY-MM-DD)</label>
      <input type="date" name="date_from" value={form.date_from || ""} onChange={onChange} className="w-full border rounded-lg p-2" />
    </div>

    <div className="col-span-3">
      <label className="block text-sm font-medium mb-1">To (YYYY-MM-DD)</label>
      <input type="date" name="date_to" value={form.date_to || ""} onChange={onChange} className="w-full border rounded-lg p-2" />
    </div>

    <div className="col-span-6">
      <button disabled={loading} className="px-4 py-2 rounded-xl bg-black text-white hover:opacity-90 disabled:opacity-50">
        {loading ? "Running..." : "Run Forecast"}
      </button>
      {error && <span className="ml-3 text-red-600 text-sm">{error}</span>}
    </div>
  </form>

  {result && (
    <div className="space-y-4">
      {/* Long Term Chart */}
      <div className="bg-white rounded-2xl p-4 shadow">
        <div className="text-sm text-gray-600 mb-2 font-semibold">Long Term</div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={longTermChart} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
              <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" />
              <XAxis dataKey="period" />
              <YAxis />
              <Tooltip contentStyle={{ backgroundColor: "#ffffff", borderRadius: "10px", borderColor: "#d1d5db" }} />
              <Legend />
              <Line type="monotone" dataKey="upper" name="Upper Bound" stroke={COLORS.upper} strokeDasharray="4 4" dot={false} />
              <Line type="monotone" dataKey="lower" name="Lower Bound" stroke={COLORS.lower} strokeDasharray="4 4" dot={false} />
              <Line type="monotone" dataKey="history" name="History" stroke={COLORS.history} strokeWidth={3} dot={false} />
              <Line type="monotone" dataKey="forecast" name="Forecast" stroke={COLORS.longTerm} strokeWidth={3} strokeDasharray="6 4" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Seasonal Chart */}
      <div className="bg-white rounded-2xl p-4 shadow">
        <div className="text-sm text-gray-600 mb-2 font-semibold">Seasonal</div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={seasonalChart} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
              <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" />
              <XAxis dataKey="period" />
              <YAxis />
              <Tooltip contentStyle={{ backgroundColor: "#ffffff", borderRadius: "10px", borderColor: "#d1d5db" }} />
              <Legend />
              <Line type="monotone" dataKey="upper" name="Upper Bound" stroke={COLORS.upper} strokeDasharray="4 4" dot={false} />
              <Line type="monotone" dataKey="lower" name="Lower Bound" stroke={COLORS.lower} strokeDasharray="4 4" dot={false} />
              <Line type="monotone" dataKey="history" name="History" stroke={COLORS.history} strokeWidth={3} dot={false} />
              <Line type="monotone" dataKey="forecast" name="Forecast" stroke={COLORS.seasonal} strokeWidth={3} strokeDasharray="6 4" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )}
</div>

);
}
