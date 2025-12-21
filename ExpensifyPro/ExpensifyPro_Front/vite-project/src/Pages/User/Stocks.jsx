import { useEffect, useMemo, useState } from "react";
import { LineChart, ArrowUpRight, ArrowDownRight, Play, Pause, Plus, DollarSign } from "lucide-react";
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

export default function Stocks() {
  const [stocks, setStocks] = useState([]);
  const [selected, setSelected] = useState(null);
  const [mode, setMode] = useState("market");
  const [side, setSide] = useState("buy");
  const [quantity, setQuantity] = useState(10);
  const [cash, setCash] = useState(5000);
  const currency = "USD";
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [trades, setTrades] = useState([]);
  const [tradeError, setTradeError] = useState(null);
  const [simCash, setSimCash] = useState(5000);
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    apiService
      .getStocks("AAPL,MSFT,NVDA,GOOGL,AMZN")
      .then((data) => {
        if (!isMounted) return;
        const list = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
        setStocks(list);
        if (list.length > 0) {
          setSelected(list[0]);
        }
      })
      .catch((err) => {
        console.error("Failed to load stocks", err);
        if (isMounted) setError("Failed to load stocks data.");
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    apiService
      .getAccounts({ page_size: 50, user_id: localStorage.getItem("user_id") })
      .then((res) => {
        if (!isMounted) return;
        const list = Array.isArray(res?.results) ? res.results : Array.isArray(res) ? res : [];
        setAccounts(list);
        if (list.length > 0) setSelectedAccount(list[0]);
      })
      .catch(() => {
        /* keep silent; trade simulation will still work with no account */
      });

    // load stored simulated trades
    try {
      const stored = localStorage.getItem("sim_trades");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) setTrades(parsed);
      }
    } catch {
      /* ignore */
    }

    return () => {
      isMounted = false;
    };
  }, []);

  const holdings = useMemo(() => {
    const map = {};
    trades.forEach((t) => {
      const qty = Number(t.quantity) || 0;
      const sign = String(t.side).toLowerCase() === "sell" ? -1 : 1;
      map[t.symbol] = (map[t.symbol] || 0) + sign * qty;
    });
    return map;
  }, [trades]);

  const addTrade = () => {
    if (!selected || !selectedAccount) return;
    setTradeError(null);
    const qty = Number(quantity) || 0;
    if (qty <= 0) {
      setTradeError("Quantity must be greater than zero.");
      return;
    }
    const estTotal = qty * (selected?.price || 0);
    // Prevent buying if not enough balance
    if (side === "buy") {
      const balance = Number(selectedAccount.balance ?? 0);
      if (estTotal > balance) {
        setTradeError("Insufficient funds in this account for this buy.");
        return;
      }
    }
    if (side === "sell") {
      const owned = holdings[selected.symbol] || 0;
      if (owned < qty) {
        setTradeError("Cannot sell more than you own.");
        return;
      }
    }

    const newTrade = {
      id: crypto.randomUUID ? crypto.randomUUID() : Date.now(),
      symbol: selected.symbol,
      side,
      quantity: qty,
      price: selected.price,
      mode,
      account: {
        id: selectedAccount.id,
        name: selectedAccount.name,
        type: selectedAccount.type,
      },
    };

    setTrades((prev) => {
      const next = [...prev, newTrade];
      localStorage.setItem("sim_trades", JSON.stringify(next));
      return next;
    });
  };

  const deleteTrade = (id) => {
    setTrades((prev) => {
      const next = prev.filter((t) => t.id !== id);
      localStorage.setItem("sim_trades", JSON.stringify(next));
      return next;
    });
  };

  const estTotal = useMemo(() => {
    return (Number(quantity) || 0) * (selected?.price || 0);
  }, [quantity, selected]);

  const projectedCash = useMemo(() => {
    const base = Number(selectedAccount?.balance ?? simCash) || 0;
    const total = estTotal;
    if (side === "buy") return base - total;
    if (side === "sell") return base + total;
    return base;
  }, [selectedAccount, simCash, estTotal, side]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Stocks</h1>
          <p className="text-sm text-gray-600">Track live tickers and simulate trades.</p>
        </div>
        <div className="flex gap-2">
          <button className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-white px-3 py-2 text-sm font-medium text-indigo-700 shadow-sm hover:bg-indigo-50">
            <Plus className="h-4 w-4" /> Watchlist
          </button>
          <button className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500">
            <LineChart className="h-4 w-4" /> New Simulation
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <div className="overflow-hidden rounded-2xl border border-indigo-100 bg-white/90 shadow-sm backdrop-blur">
            <div className="flex items-center justify-between border-b border-indigo-100/70 px-4 py-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Market overview</h2>
                <p className="text-sm text-gray-600">Quick view of top watchlist tickers.</p>
              </div>
            </div>
            {loading ? (
              <div className="p-4 text-sm text-gray-600">Loading stocks...</div>
            ) : (
              <div className="divide-y divide-indigo-50/80">
                {stocks.map((stock) => {
                  const change = Number(stock.change ?? 0);
                  const changePct = Number(stock.changePct ?? 0);
                  const up = changePct >= 0;
                  return (
                    <button
                      key={stock.symbol}
                      onClick={() => setSelected(stock)}
                      className={`flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-indigo-50/60 ${
                        selected?.symbol === stock.symbol ? "bg-indigo-50" : ""
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-700 grid place-content-center font-semibold">
                          {stock.symbol}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{stock.symbol}</p>
                          <p className="text-xs text-gray-600">{stock.name}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-gray-900">{fmtCurrency(stock.price)}</p>
                        <div
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                            up ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                          }`}
                        >
                          {up ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                          {change.toFixed(2)} ({changePct.toFixed(1)}%)
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-indigo-100 bg-white/90 p-4 shadow-sm backdrop-blur">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Simulate trade</h3>
                <p className="text-sm text-gray-600">No live orders are sent. Estimate fills and impact.</p>
              </div>
              <div className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                {selected?.symbol}
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="space-y-1 md:col-span-3">
                <label className="text-xs font-medium text-gray-600">Account</label>
                <select
                  value={selectedAccount?.id || ""}
                  onChange={(e) => {
                    const a = accounts.find((acc) => String(acc.id) === e.target.value);
                    setSelectedAccount(a || null);
                  }}
                  className="w-full rounded-xl border border-indigo-100 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-300 focus:outline-none"
                >
                  {accounts.length === 0 && <option value="">No accounts available</option>}
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.type}) {acc.balance != null}
                    </option>
                  ))}
                </select>
                {selectedAccount?.balance != null && (
                  <p className="text-xs text-gray-600">
                    Balance: <span className="font-semibold">{fmtCurrency(selectedAccount.balance, selectedAccount.currency || currency)}</span>
                  </p>
                )}
                {tradeError && (
                  <p className="text-xs text-rose-600 font-semibold">{tradeError}</p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Order type</label>
                <div className="flex rounded-xl border border-indigo-100 bg-indigo-50/70 p-1 text-xs font-semibold text-indigo-700">
                  {[
                    { id: "market", label: "Market" },
                    { id: "limit", label: "Limit" },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => setMode(opt.id)}
                      className={`flex-1 rounded-lg px-3 py-2 transition ${
                        mode === opt.id ? "bg-white shadow" : "hover:bg-white/60"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Side</label>
                <div className="flex rounded-xl border border-indigo-100 bg-indigo-50/70 p-1 text-xs font-semibold text-indigo-700">
                  {[
                    { id: "buy", label: "Buy" },
                    { id: "sell", label: "Sell" },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => setSide(opt.id)}
                      className={`flex-1 rounded-lg px-3 py-2 transition ${
                        side === opt.id ? "bg-white shadow" : "hover:bg-white/60"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Quantity</label>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full rounded-xl border border-indigo-100 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-300 focus:outline-none"
                  min={0}
                />
                <p className="text-xs text-gray-500">Shares</p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Est. total</label>
                <div className="rounded-xl border border-indigo-100 bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm">
                  {fmtCurrency(estTotal, currency)}
                </div>
                <p className="text-xs text-gray-500">Based on latest price</p>
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Simulated cash</label>
                <div className="flex items-center gap-2 rounded-xl border border-indigo-100 bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm">
                  <DollarSign className="h-4 w-4 text-indigo-600" />
                  {fmtCurrency(selectedAccount?.balance ?? simCash, currency)}
                </div>
                <p className="text-xs text-gray-500">
                  {side === "buy"
                    ? `After buy: ${fmtCurrency(projectedCash, currency)}`
                    : `After sell: ${fmtCurrency(projectedCash, currency)}`}
                </p>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Limit price (if limit)</label>
                <input
                  type="number"
                  placeholder={selected?.price}
                  className="w-full rounded-xl border border-indigo-100 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-300 focus:outline-none"
                />
              </div>
              <div className="space-y-2 md:pt-6">
                <div className="flex gap-2">
                  <button
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
                    onClick={addTrade}
                  >
                    <Play className="h-4 w-4" /> Simulate
                  </button>
                  <button className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-white px-3 py-2 text-sm font-semibold text-indigo-700 shadow-sm hover:bg-indigo-50">
                    <Pause className="h-4 w-4" /> Hold
                  </button>
                </div>
                <p className="text-xs text-gray-500">No live orders are placed.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-indigo-100 bg-white/90 p-4 shadow-sm backdrop-blur">
            <h3 className="text-sm font-semibold text-gray-900">Position preview</h3>
            <p className="text-xs text-gray-600">How this simulated order would impact your holdings.</p>
            <div className="mt-3 space-y-2 text-sm text-gray-800">
              <div className="flex justify-between">
                <span>Symbol</span>
                <span className="font-semibold">{selected?.symbol}</span>
              </div>
              <div className="flex justify-between">
                <span>Last price</span>
                <span className="font-semibold">{fmtCurrency(selected?.price, currency)}</span>
              </div>
              <div className="flex justify-between">
                <span>Quantity (simulated)</span>
                <span className="font-semibold">{quantity}</span>
              </div>
              <div className="flex justify-between">
                <span>Est. cost</span>
                <span className="font-semibold">{fmtCurrency(estTotal, currency)}</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-indigo-100 bg-white/90 p-4 shadow-sm backdrop-blur">
            <h3 className="text-sm font-semibold text-gray-900">Alerts</h3>
            <p className="text-xs text-gray-600">Set simple client-side alerts (no backend).</p>
            <div className="mt-3 space-y-2 text-sm text-gray-800">
              <div className="flex justify-between">
                <span>Price crosses</span>
                <span className="font-semibold">{fmtCurrency((selected?.price || 0) * 1.02, currency)}</span>
              </div>
              <div className="flex justify-between">
                <span>Daily move threshold</span>
                <span className="font-semibold">1.5%</span>
              </div>
              <button className="mt-3 w-full rounded-xl border border-indigo-200 bg-white px-3 py-2 text-sm font-semibold text-indigo-700 shadow-sm hover:bg-indigo-50">
                Save alert
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-indigo-100 bg-white/90 p-4 shadow-sm backdrop-blur">
            <h3 className="text-sm font-semibold text-gray-900">Simulated trades</h3>
            <p className="text-xs text-gray-600">Local-only list to prep for real trades.</p>
            <div className="mt-3 space-y-2 text-sm text-gray-800">
              {trades.length === 0 ? (
                <p className="text-xs text-gray-500">No simulated trades yet.</p>
              ) : (
                trades.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between rounded-xl border border-indigo-50 bg-white px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {t.side.toUpperCase()} {t.symbol}
                      </p>
                      <p className="text-xs text-gray-600">
                        {t.quantity} @ {fmtCurrency(t.price, currency)} ({t.mode})
                        {t.account?.name ? ` • ${t.account.name}` : ""}
                      </p>
                    </div>
                    <button
                      onClick={() => deleteTrade(t.id)}
                      className="text-xs font-semibold text-rose-600 hover:text-rose-700"
                    >
                      Delete
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
