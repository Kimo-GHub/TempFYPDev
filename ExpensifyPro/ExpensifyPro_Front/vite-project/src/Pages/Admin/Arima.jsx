// src/Pages/Admin/Arima.jsx
import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { apiService } from "../../api";
import { askExpensi } from "../../utils/expensiApi";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const COLORS = {
  history: "#ef4444", // vibrant red
  forecast: "#3b82f6", // bright blue
  upper: "#22c55e", // vivid green
  lower: "#a855f7", // bright purple
  grid: "#e5e7eb", // light gray for grid
};

const DEFAULT_BODY = {
  target: "net", // "net" | "income" | "expense"
  model: "arima", // "arima" | "prophet"
  horizon: 6, // months ahead
  date_from: null,
  date_to: null,
  currency: "USD",
};

export default function ArimaPage() {
  const [form, setForm] = useState(DEFAULT_BODY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  // Expensi explanation state
  const [expensiLoading, setExpensiLoading] = useState(false);
  const [expensiError, setExpensiError] = useState("");
  const [expensiText, setExpensiText] = useState("");

  const navigate = useNavigate(); // ✅ hook inside component

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({
      ...f,
      [name]: name === "horizon" ? Number(value) : value,
    }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    setExpensiText("");
    setExpensiError("");

    try {
      const payload = {
        ...form,
        date_from: form.date_from || null,
        date_to: form.date_to || null,
      };
      const data = await apiService.postForecast(payload);
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
    fc.forEach((r) =>
      map.set(r.period, { ...(map.get(r.period) || { period: r.period }), ...r })
    );
    return Array.from(map.values()).sort((a, b) =>
      a.period.localeCompare(b.period)
    );
  }, [result]);


 // 🔍 Ask Expensi to explain the forecast
const handleAskExpensi = async () => {
  if (!result) return; // no forecast yet

  setExpensiLoading(true);
  setExpensiError("");

  try {
    // what we’ll give Expensi + store for later
    const payloadForExpensi = {
      generated_at: new Date().toISOString(),
      model_info: result?.model_info || null,
      history: result?.history || [],
      forecast: result?.forecast || [],
    };

    const userText = [
      "You are a financial analyst specialised in forecasting.",
      "",
      "Here is the JSON for my forecast chart:",
      "```json",
      JSON.stringify(payloadForExpensi, null, 2),
      "```",
      "",
      "Explain what this chart means in clear, simple language for a finance admin.",
      "Then list the key risks and things I should pay attention to.",
    ].join("\n");

    const reply = await askExpensi([
      { role: "system", content: "You are Expensi, a helpful finance assistant." },
      { role: "user", content: userText },
    ]);

    const text =
      reply?.type === "text"
        ? reply.text
        : JSON.stringify(reply, null, 2);

    // This is what you show in the textbox on the Forecast page
    setExpensiText(text);

    // 🔹 For advisor mode, keep only the chart explanation part (optional but nice)
    let explanationForAdvisor = text;
    const marker = "**Risks and What to Check Next**"; // match your heading text
    const idx = explanationForAdvisor.indexOf(marker);
    if (idx !== -1) {
      explanationForAdvisor = explanationForAdvisor.slice(0, idx).trim();
    }

    // ✅ store everything so ExpensiPage can auto-start “advisor mode”
    try {
      window.localStorage.setItem(
        "expensi_last_forecast",
        JSON.stringify({
          ...payloadForExpensi,
          explanation: explanationForAdvisor,  // <— cleaned version
          // if you want these later, you can add:
          target: form.target,
          horizon: form.horizon,
        })
      );
    } catch (e) {
      console.warn("Failed to store expensi_last_forecast", e);
    }
  } catch (err) {
    console.error(err);
    setExpensiError("Expensi could not analyse this forecast.");
  } finally {
    setExpensiLoading(false);
  }
};


const handleRecommendedActions = () => {
  // optional: if for some reason explanation wasn’t stored, store it now
  try {
    const raw = window.localStorage.getItem("expensi_last_forecast");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (expensiText && !parsed.explanation) {
        parsed.explanation = expensiText;
        window.localStorage.setItem(
          "expensi_last_forecast",
          JSON.stringify(parsed)
        );
      }
    } else if (expensiText && result) {
      // fallback: create minimal payload
      window.localStorage.setItem(
        "expensi_last_forecast",
        JSON.stringify({
          generated_at: new Date().toISOString(),
          model_info: result?.model_info || null,
          history: result?.history || [],
          forecast: result?.forecast || [],
          explanation: expensiText,
        })
      );
    }
  } catch (e) {
    console.warn("Failed to update expensi_last_forecast", e);
  }

  // 🔁 go to ExpensiPage in forecast-advisor mode
  navigate("/expensi", {
    state: { from: "forecast", autoMode: "forecast_advice" },
  });
};


  return (
    <div className="p-4 md:p-6 space-y-6">
      <h1 className="text-2xl font-bold">Forecast (ARIMA / Prophet)</h1>

      <form
        onSubmit={submit}
        className="grid md:grid-cols-6 gap-3 bg-white rounded-2xl p-4 shadow"
      >
        <div className="col-span-2">
          <label className="block text-sm font-medium mb-1">Target</label>
          <select
            name="target"
            value={form.target}
            onChange={onChange}
            className="w-full border rounded-lg p-2"
          >
            <option value="net">Net</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>
        </div>

        <div className="col-span-2">
          <label className="block text-sm font-medium mb-1">Model</label>
          <select
            name="model"
            value={form.model}
            onChange={onChange}
            className="w-full border rounded-lg p-2"
          >
            <option value="arima">Long Term (stable)</option>
            <option value="prophet">Seasonal</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Horizon (months)
          </label>
          <input
            type="number"
            name="horizon"
            min="1"
            max="36"
            value={form.horizon}
            onChange={onChange}
            className="w-full border rounded-lg p-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Currency</label>
          <input
            type="text"
            name="currency"
            value={form.currency}
            onChange={onChange}
            className="w-full border rounded-lg p-2"
          />
        </div>

        <div className="col-span-3">
          <label className="block text-sm font-medium mb-1">
            From (YYYY-MM-DD)
          </label>
          <input
            type="date"
            name="date_from"
            value={form.date_from || ""}
            onChange={onChange}
            className="w-full border rounded-lg p-2"
          />
        </div>
        <div className="col-span-3">
          <label className="block text-sm font-medium mb-1">
            To (YYYY-MM-DD)
          </label>
          <input
            type="date"
            name="date_to"
            value={form.date_to || ""}
            onChange={onChange}
            className="w-full border rounded-lg p-2"
          />
        </div>

        <div className="col-span-6">
          <button
            disabled={loading}
            className="px-4 py-2 rounded-xl bg-black text-white hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Running..." : "Run Forecast"}
          </button>
          {error && (
            <span className="ml-3 text-red-600 text-sm">{error}</span>
          )}
        </div>
      </form>

      {result && (
        <div className="bg-white rounded-2xl p-4 shadow space-y-4">
          <div className="text-sm text-gray-600">
            <span className="font-semibold">Model:</span>{" "}
            {result.model_info?.model}
            {result.model_info?.order && (
              <>
                {" "}
                &middot; <span className="font-semibold">Order:</span>{" "}
                {JSON.stringify(result.model_info.order)}
              </>
            )}
          </div>

          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 10, right: 20, left: 0, bottom: 10 }}
              >
                <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#ffffff",
                    borderRadius: "10px",
                    borderColor: "#d1d5db",
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="upper"
                  name="Upper Bound"
                  stroke={COLORS.upper}
                  strokeDasharray="4 4"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="lower"
                  name="Lower Bound"
                  stroke={COLORS.lower}
                  strokeDasharray="4 4"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="history"
                  name="History"
                  stroke={COLORS.history}
                  strokeWidth={3}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="forecast"
                  name="Forecast"
                  stroke={COLORS.forecast}
                  strokeWidth={3}
                  strokeDasharray="6 4"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* 🧠 Ask Expensi about this forecast */}
          <div className="mt-4 border-t pt-4 space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="text-sm font-semibold">
                  Ask Expensi about this forecast
                </div>
                <div className="text-xs text-gray-500">
                  Expensi will read the same data behind this chart and explain
                  what it means for your organization.
                </div>
              </div>
              <button
                onClick={handleAskExpensi}
                disabled={expensiLoading}
                className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-sm hover:opacity-90 disabled:opacity-50"
              >
                {expensiLoading ? "Asking Expensi..." : "Ask Expensi"}
              </button>
            </div>

            {expensiError && (
              <div className="text-sm text-red-600">{expensiError}</div>
            )}

            {expensiText ? (
              <div className="mt-2 max-h-64 overflow-y-auto text-sm leading-relaxed bg-gray-50 border rounded-xl p-3 whitespace-pre-wrap">
                {expensiText}

                <div className="mt-4 flex justify-end">
                  <button
                    onClick={handleRecommendedActions}
                    className="px-4 py-2 rounded-xl bg-emerald-600 text-white hover:opacity-90 text-sm"
                  >
                    Recommended Actions with Expensi
                  </button>
                </div>
              </div>
            ) : (
              !expensiLoading && (
                <div className="text-xs text-gray-500">
                  Run “Ask Expensi” to see a narrative explanation here.
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
