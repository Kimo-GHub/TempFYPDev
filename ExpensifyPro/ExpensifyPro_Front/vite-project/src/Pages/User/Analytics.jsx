import { useEffect, useMemo, useState } from "react";
import { apiService } from "../../api";
import useCategories from "../../hooks/useCategories";

const PERIODS = [
  { label: "30 days", value: 30 },
  { label: "90 days", value: 90 },
  { label: "Year", value: 365 },
];

const fmtMoney = (value, currency = "USD") =>
  new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(
    Number(value || 0),
  );

const fmtFullMoney = (value, currency = "USD") =>
  new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }).format(
    Number(value || 0),
  );

const tidy = (s) => (s ? s[0].toUpperCase() + s.slice(1) : "-");

export default function Analytics() {
  const currentUserId = (() => {
    try {
      return JSON.parse(localStorage.getItem("exp_user") || "{}").id || null;
    } catch {
      return null;
    }
  })();

  const [period, setPeriod] = useState(90);
  const [transactions, setTransactions] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { categories, categoriesMap } = useCategories();

  useEffect(() => {
    const fetchAnalytics = async () => {
      if (!currentUserId) return;
      setLoading(true);
      setError("");
      try {
        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - period);
        const date_from = fromDate.toISOString().slice(0, 10);

        const txns = [];
        const pageSize = 100;
        let page = 1;
        let totalPages = 1;
        do {
          const res = await apiService.getTransactions({
            page,
            page_size: pageSize,
            date_from,
            user_id: currentUserId,
          });
          txns.push(...(res?.results ?? []));
          totalPages = res?.info?.total_pages ?? 1;
          page += 1;
        } while (page <= totalPages && page <= 6);

        const budgetsRes = await apiService.getBudgets({
          page: 1,
          page_size: 200,
          user_id: currentUserId,
        });

        setTransactions(txns);
        setBudgets(budgetsRes?.results ?? []);
      } catch (e) {
        setError(e?.message || "Failed to load analytics data");
        setTransactions([]);
        setBudgets([]);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [currentUserId, period]);

  const summary = useMemo(() => {
    let income = 0;
    let expense = 0;
    transactions.forEach((tx) => {
      if (tx.type === "income") income += Number(tx.amount || 0);
      if (tx.type === "expense") expense += Number(tx.amount || 0);
    });
    return {
      income,
      expense,
      net: income - expense,
      count: transactions.length,
    };
  }, [transactions]);

  const categoryBreakdown = useMemo(() => {
    const map = new Map();
    transactions.forEach((tx) => {
      if (!tx.category_id) return;
      if (tx.type !== "expense" && tx.type !== "income") return;
      const prev = map.get(tx.category_id) || { total: 0, count: 0, kind: tx.type };
      map.set(tx.category_id, {
        total: prev.total + Math.abs(Number(tx.amount || 0)),
        count: prev.count + 1,
        kind: tx.type,
      });
    });
    return Array.from(map.entries())
      .map(([categoryId, info]) => ({
        categoryId,
        ...info,
        name: categoriesMap[categoryId]?.name || `Category ${categoryId}`,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [transactions, categoriesMap]);

  const monthlyTrend = useMemo(() => {
    const buckets = new Map();
    transactions.forEach((tx) => {
      const date = tx.date ? new Date(tx.date) : null;
      if (!date) return;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const prev = buckets.get(key) || { income: 0, expense: 0 };
      if (tx.type === "income") prev.income += Number(tx.amount || 0);
      if (tx.type === "expense") prev.expense += Number(tx.amount || 0);
      buckets.set(key, prev);
    });
    return Array.from(buckets.entries())
      .map(([month, values]) => ({
        month,
        ...values,
        net: values.income - values.expense,
      }))
      .sort((a, b) => (a.month > b.month ? 1 : -1));
  }, [transactions]);

  const budgetsSummary = useMemo(() => {
    const activeBudgets = budgets.filter((b) => b.is_active);
    const allocated = activeBudgets.reduce((sum, b) => sum + Number(b.amount || 0), 0);
    return {
      count: activeBudgets.length,
      allocated,
    };
  }, [budgets]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-500">
            Insights
          </p>
          <h1 className="text-3xl font-bold text-slate-900">Analytics</h1>
          <p className="text-sm text-slate-500">
            Understand where your money goes and how budgets are performing.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm">
          <span className="text-slate-500">Period:</span>
          <div className="mt-2 flex gap-2">
            {PERIODS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setPeriod(option.value)}
                className={`rounded-xl px-3 py-1 font-semibold transition ${period === option.value
                  ? "bg-indigo-600 text-white shadow"
                  : "border border-slate-200 text-slate-600 hover:border-indigo-200 hover:text-indigo-600"
                  }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-3xl bg-white/90 p-5 shadow-sm ring-1 ring-slate-100">
          <p className="text-xs uppercase tracking-wide text-slate-400">Income</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{fmtMoney(summary.income)}</p>
          <p className="text-xs text-slate-400">
            {summary.count} transactions over the last {period} days
          </p>
        </div>
        <div className="rounded-3xl bg-white/90 p-5 shadow-sm ring-1 ring-slate-100">
          <p className="text-xs uppercase tracking-wide text-slate-400">Expenses</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{fmtMoney(summary.expense)}</p>
          <p className="text-xs text-slate-400">Includes all spending accounts</p>
        </div>
        <div className="rounded-3xl bg-white/90 p-5 shadow-sm ring-1 ring-slate-100">
          <p className="text-xs uppercase tracking-wide text-slate-400">Net</p>
          <p
            className={`mt-2 text-3xl font-semibold ${summary.net >= 0 ? "text-emerald-600" : "text-rose-600"
              }`}
          >
            {fmtMoney(summary.net)}
          </p>
          <p className="text-xs text-slate-400">Income minus expenses</p>
        </div>
        <div className="rounded-3xl bg-white/90 p-5 shadow-sm ring-1 ring-slate-100">
          <p className="text-xs uppercase tracking-wide text-slate-400">Active budgets</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{budgetsSummary.count}</p>
          <p className="text-xs text-slate-400">
            {fmtFullMoney(budgetsSummary.allocated)} allocated
          </p>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm ring-1 ring-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Top categories</h2>
              <p className="text-xs text-slate-400">
                Highest spend/income categories for the selected period
              </p>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {loading ? (
              <p className="text-sm text-slate-400">Loading…</p>
            ) : categoryBreakdown.length ? (
              categoryBreakdown.map((cat) => (
                <div key={cat.categoryId}>
                  <div className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-semibold text-slate-900">{cat.name}</p>
                      <p className="text-xs text-slate-400">
                        {cat.count} {cat.kind === "income" ? "credits" : "spends"}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-slate-900">
                      {fmtFullMoney(cat.total)}
                    </p>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-slate-200">
                    <span
                      className={`block h-2 rounded-full ${cat.kind === "income" ? "bg-emerald-500" : "bg-rose-500"
                        }`}
                      style={{
                        width: `${Math.min(
                          100,
                          (cat.total / categoryBreakdown[0].total) * 100 || 0,
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400">No categorized transactions yet.</p>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm ring-1 ring-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Trend</h2>
              <p className="text-xs text-slate-400">Monthly income vs expenses</p>
            </div>
          </div>
          <div className="mt-4 overflow-x-auto">
            {loading ? (
              <p className="text-sm text-slate-400">Loading…</p>
            ) : monthlyTrend.length ? (
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-slate-400">
                    <th className="py-2">Month</th>
                    <th className="py-2">Income</th>
                    <th className="py-2">Expense</th>
                    <th className="py-2">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyTrend.map((row) => (
                    <tr key={row.month} className="border-t text-sm text-slate-600">
                      <td className="py-2">{row.month}</td>
                      <td className="py-2 text-emerald-600">{fmtFullMoney(row.income)}</td>
                      <td className="py-2 text-rose-600">{fmtFullMoney(row.expense)}</td>
                      <td
                        className={`py-2 font-semibold ${row.net >= 0 ? "text-emerald-600" : "text-rose-600"
                          }`}
                      >
                        {fmtFullMoney(row.net)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-slate-400">No data available for this period.</p>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm ring-1 ring-slate-100">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Budgets snapshot</h2>
            <p className="text-xs text-slate-400">Quick view of your active budgets</p>
          </div>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {loading ? (
            <p className="text-sm text-slate-400">Loading…</p>
          ) : budgetsSummary.count ? (
            budgets
              .filter((b) => b.is_active)
              .slice(0, 6)
              .map((budget) => (
                <article
                  key={budget.id}
                  className="rounded-2xl border border-slate-200 p-4 text-sm text-slate-600"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-slate-900">{budget.name}</p>
                    <span className="text-xs text-slate-400">
                      {budget.category_id ? categoriesMap[budget.category_id]?.name : "General"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    Amount {fmtFullMoney(budget.amount, budget.currency || "USD")}
                  </p>
                  <p className="mt-2 text-xs text-slate-400">
                    Period {budget.period_start || "—"} to {budget.period_end || "—"}
                  </p>
                  <button
                    type="button"
                    onClick={() => (window.location.href = "/user/budgets")}
                    className="mt-3 text-xs font-semibold text-indigo-600 hover:underline"
                  >
                    Manage budget
                  </button>
                </article>
              ))
          ) : (
            <p className="text-sm text-slate-400">No active budgets yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}

