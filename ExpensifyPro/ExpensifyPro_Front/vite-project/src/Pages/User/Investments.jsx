import { useEffect, useMemo, useState } from "react";
import { TrendingUp, Wallet, Coins, LineChart, Pencil, PauseCircle, Trash2 } from "lucide-react";
import { apiService } from "../../api";

const fmtCurrency = (value, currency = "USD") => {
  const n = Number(value || 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
};

export default function Investments() {
  const [summary, setSummary] = useState(null);
  const [positions, setPositions] = useState([]);
  const [simulatedPositions, setSimulatedPositions] = useState([]);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const currency = summary?.currency || "USD";

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [summaryRes, positionsRes, rulesRes] = await Promise.all([
          apiService.getUserInvestmentsSummary(),
          apiService.getUserInvestmentsPositions(),
          apiService.getUserInvestmentsRules(),
        ]);

        if (!isMounted) return;

        setSummary(summaryRes?.data || summaryRes);

        const posPayload = positionsRes?.data || positionsRes;
        const posArray = Array.isArray(posPayload?.results)
          ? posPayload.results
          : Array.isArray(posPayload)
            ? posPayload
            : [];
        setPositions(posArray);

        // merge in simulated holdings from localStorage trades
        const tradesRaw = localStorage.getItem("sim_trades");
        if (tradesRaw) {
          try {
            const trades = JSON.parse(tradesRaw) || [];
            const bySymbol = {};
            trades.forEach((t) => {
              const qty = Number(t.quantity) || 0;
              const price = Number(t.price) || 0;
              const key = t.symbol;
              if (!bySymbol[key]) {
                bySymbol[key] = { symbol: key, name: t.symbol, quantity: 0, totalCost: 0 };
              }
              const sign = String(t.side).toLowerCase() === "sell" ? -1 : 1;
              bySymbol[key].quantity += sign * qty;
              if (sign > 0) {
                bySymbol[key].totalCost += qty * price;
              }
            });
            const simPositions = Object.values(bySymbol)
              .filter((p) => p.quantity > 0.0001) // keep only net long positions
              .map((p) => {
                const avgPrice = p.totalCost && p.quantity ? p.totalCost / p.quantity : 0;
                return {
                  symbol: p.symbol,
                  name: p.name,
                  quantity: p.quantity,
                  avg_price: avgPrice,
                  current_price: avgPrice,
                  pnl_value: 0,
                  is_simulated: true,
                };
              });
            setSimulatedPositions(simPositions);
          } catch {
            setSimulatedPositions([]);
          }
        } else {
          setSimulatedPositions([]);
        }

        const rulePayload = rulesRes?.data || rulesRes;
        const ruleArray = Array.isArray(rulePayload?.results)
          ? rulePayload.results
          : Array.isArray(rulePayload)
            ? rulePayload
            : [];
        setRules(ruleArray);
      } catch (err) {
        console.error("Failed to load user investments", err);
        if (isMounted) {
          setError("Failed to load investments data.");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    load();
    return () => {
      isMounted = false;
    };
  }, []);

  const summaryCards = useMemo(() => {
    if (!summary) {
      return [
        { label: "Total Portfolio Value", value: "-", delta: "0.0%", icon: Wallet },
        { label: "Simulated Cash", value: "-", delta: "0.0%", icon: Coins },
        { label: "Total PnL", value: "-", delta: "0.0%", icon: LineChart },
      ];
    }

    const totalValue = summary.total_portfolio_value ?? summary.total_value ?? summary.totalValue;
    const simulatedCash = summary.simulated_cash ?? summary.simulatedCash;
    const totalPnl = summary.total_pnl_value ?? summary.total_pnl ?? summary.totalPnl;

    const totalValueDelta = summary.total_value_delta ?? "+0.0%";
    const simulatedCashDelta = summary.simulated_cash_delta ?? "+0.0%";
    const totalPnlDelta = summary.total_pnl_delta ?? "+0.0%";

    return [
      {
        label: "Total Portfolio Value",
        value: fmtCurrency(totalValue, currency),
        delta: totalValueDelta,
        icon: Wallet,
      },
      {
        label: "Simulated Cash",
        value: fmtCurrency(simulatedCash, currency),
        delta: simulatedCashDelta,
        icon: Coins,
      },
      {
        label: "Total PnL",
        value: fmtCurrency(totalPnl, currency),
        delta: totalPnlDelta,
        icon: LineChart,
      },
    ];
  }, [summary, currency]);

  const allPositions = useMemo(() => {
    return [...positions, ...simulatedPositions];
  }, [positions, simulatedPositions]);

  const isEmpty = !loading && !error && allPositions.length === 0 && rules.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Investments</h1>
          <p className="text-sm text-gray-600">Your portfolio, simulations, and guardrails.</p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500">
          <TrendingUp className="h-4 w-4" />
          New Simulation
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {isEmpty && (
        <div className="rounded-xl border border-indigo-100 bg-white px-4 py-3 text-sm text-gray-700">
          No investment data yet. Add securities, positions, or rules to see them here.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {summaryCards.map(({ label, value, delta, icon: Icon }) => (
          <div
            key={label}
            className="rounded-2xl border border-indigo-100 bg-white/90 p-4 shadow-sm backdrop-blur"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">{label}</p>
              <div className="rounded-full bg-indigo-50 p-2 text-indigo-700">
                <Icon className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 text-2xl font-semibold text-gray-900">
              {loading && !summary ? "." : value}
            </div>
            <div
              className={`mt-1 text-xs font-medium ${
                String(delta).startsWith("+") ? "text-emerald-600" : "text-amber-600"
              }`}
            >
              {delta}
            </div>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-indigo-100 bg-white/90 shadow-sm backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-indigo-100/70 px-4 py-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Positions</h2>
            <p className="text-sm text-gray-600">Personal holdings and simulated trades.</p>
          </div>
          <div className="flex gap-2">
            <button className="rounded-lg border border-indigo-200 px-3 py-2 text-xs font-medium text-indigo-700 hover:bg-indigo-50">
              Export
            </button>
            <button
              className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-500"
              onClick={() => window.location.reload()}
            >
              Sync
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-indigo-50/60 text-left text-xs font-semibold uppercase tracking-wide text-indigo-900">
              <tr>
                <th className="px-4 py-3">Symbol</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3 text-right">Quantity</th>
                <th className="px-4 py-3 text-right">Avg Price</th>
                <th className="px-4 py-3 text-right">Current Price</th>
                <th className="px-4 py-3 text-right">PnL</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-indigo-50/80 text-gray-800">
              {loading && allPositions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-xs text-gray-500">
                    Loading positions.
                  </td>
                </tr>
              ) : allPositions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-xs text-gray-500">
                    No positions yet.
                  </td>
                </tr>
              ) : (
                allPositions.map((pos) => (
                  <tr key={pos.id ?? pos.symbol} className="hover:bg-indigo-50/40">
                    <td className="px-4 py-3 font-semibold text-gray-900">
                      {pos.symbol}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{pos.name}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {pos.quantity}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {fmtCurrency(pos.avg_price ?? pos.avgPrice, currency)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {fmtCurrency(pos.current_price ?? pos.currentPrice, currency)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-semibold tabular-nums ${
                        (pos.pnl_value ?? pos.pnl) >= 0 ? "text-emerald-600" : "text-red-600"
                      }`}
                    >
                      {fmtCurrency(pos.pnl_value ?? pos.pnl, currency)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50">
                          <Pencil className="h-4 w-4" />
                          Edit
                        </button>
                        <button className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50">
                          <PauseCircle className="h-4 w-4" />
                          Pause
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-indigo-100 bg-white/90 p-4 shadow-sm backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-indigo-100/70 pb-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Automated Trading Rules</h2>
            <p className="text-sm text-gray-600">Placeholders for your automations - no live trades.</p>
          </div>
          <button className="rounded-lg border border-indigo-200 px-3 py-2 text-xs font-medium text-indigo-700 hover:bg-indigo-50">
            Add rule
          </button>
        </div>

        <div className="mt-3 space-y-3">
          {loading && rules.length === 0 ? (
            <p className="px-1 text-xs text-gray-500">Loading rules.</p>
          ) : rules.length === 0 ? (
            <p className="px-1 text-xs text-gray-500">No rules configured yet.</p>
          ) : (
            rules.map((rule) => (
              <div
                key={rule.id ?? rule.title}
                className="flex flex-col gap-3 rounded-xl border border-indigo-100 bg-white/60 p-4 md:flex-row md:items-center md:justify-between"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900">
                      {rule.name ?? rule.title}
                    </p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        (rule.status ?? "active").toLowerCase() === "active"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {(rule.status ?? "Active").toString()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">
                    {rule.description ?? "-"}
                  </p>
                  <p className="text-xs text-gray-500">
                    Last run {rule.last_run_at ?? rule.lastRun ?? "-"}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50">
                    <Pencil className="h-4 w-4" />
                    Edit
                  </button>
                  <button className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50">
                    <PauseCircle className="h-4 w-4" />
                    Pause
                  </button>
                  <button className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50">
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
