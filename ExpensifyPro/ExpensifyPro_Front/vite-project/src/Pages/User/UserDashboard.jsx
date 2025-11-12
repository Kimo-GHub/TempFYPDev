import { useEffect, useMemo, useState } from "react";
import StatCard from "../Admin/components/StatCard";
import RecentTransactions from "../Admin/components/RecentTransactions";
import TopAccounts from "../Admin/components/TopAccounts";
import { apiService } from "../../api";

export default function UserDashboard() {
  // current session user (local only)
  const sessionUser = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("exp_user") || "{}"); } catch { return {}; }
  }, []);
  const currentUserId = sessionUser?.id ?? null;

  const [kpis, setKpis] = useState([]);
  const [recent, setRecent] = useState([]);
  const [topAccounts, setTopAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let ignore = false;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        // Keep existing KPIs (org-level) but compute lists per-user for accuracy
        try {
          const data = await apiService.getDashboardOverview({ currency: "USD", recent_limit: 0, accounts_limit: 0 });
          const filteredKpis = (data?.kpis ?? []).filter((k) => !/active\s*users/i.test(k?.label ?? k?.name ?? ""));
          if (!ignore) setKpis(filteredKpis);
        } catch { /* ignore KPI issues */ }

        // Build user-scoped lists
        const [accRes, txRes] = await Promise.all([
          apiService.getAccounts({ user_id: currentUserId, page: 1, page_size: 100 }),
          apiService.getTransactions({ user_id: currentUserId, page: 1, page_size: 6 }),
        ]);

        if (ignore) return;
        const accounts = accRes?.results ?? [];
        const txs = txRes?.results ?? [];

        // Top accounts by balance (max 3)
        const top = [...accounts]
          .sort((a, b) => Number(b.balance || 0) - Number(a.balance || 0))
          .slice(0, 3)
          .map((a) => ({ id: a.id, name: a.name, type: a.type, balance: Number(a.balance || 0) }));

        // Map account id -> name
        const accName = new Map(accounts.map((a) => [a.id, a.name]));
        // Recent transactions (convert amount sign like overview does)
        const rec = txs.map((t) => ({
          id: t.id,
          date: t.date,
          description: t.description,
          account: accName.get(t.account_id) || `#${t.account_id}`,
          amount: t.type === "expense" ? -Math.abs(Number(t.amount || 0)) : Math.abs(Number(t.amount || 0)),
          currency: t.currency || "USD",
        }));

        setRecent(rec);
        setTopAccounts(top);

        // Compute user-scoped KPIs (Total Spend, This Month, Transactions 30d)
        const currency = "USD";
        const sumNet = async (extraFilters = {}, hardLimitPages = 20) => {
          let page = 1, net = 0, totalPages = 1;
          do {
            const res = await apiService.getTransactions({ user_id: currentUserId, page, page_size: 100, ...extraFilters });
            const items = res?.results || [];
            for (const t of items) {
              const amt = Number(t.amount || 0);
              if (t.type === "income") net += Math.abs(amt);
              else if (t.type === "expense") net -= Math.abs(amt);
            }
            totalPages = res?.info?.total_pages || 1;
            page += 1;
          } while (page <= totalPages && page <= hardLimitPages);
          return net;
        };

        const totalNet = await sumNet();
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthNet = await sumNet({ date_from: monthStart.toISOString().slice(0, 10) });

        let tx30 = 0;
        try {
          const days30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
          const resCnt = await apiService.getTransactions({ user_id: currentUserId, date_from: days30.toISOString().slice(0, 10), page: 1, page_size: 1 });
          tx30 = resCnt?.info?.total_items || 0;
        } catch { tx30 = 0; }

        const kpiData = [
          { label: "Total Spend", value: new Intl.NumberFormat(undefined, { style: "currency", currency }).format(totalNet), delta: "+0.0%", up: true },
          { label: "This Month", value: new Intl.NumberFormat(undefined, { style: "currency", currency }).format(monthNet), delta: "+0.0%", up: true },
          { label: "Transactions (30d)", value: String(tx30), delta: "+0.0%", up: true },
        ];
        setKpis(kpiData);
      } catch (e) {
        if (ignore) return;
        setErr(e?.message || "Failed to load dashboard");
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Your Overview</h1>
        <p className="text-gray-600 text-sm">
          Track your accounts and transactions at a glance.
        </p>
        {sessionUser?.email && (
          <div className="mt-1 text-xs inline-flex items-center gap-2 rounded-xl border px-2 py-1 bg-white/70">
            <span className="text-gray-600">Signed in as</span>
            <span className="font-medium text-gray-800">{sessionUser.name || sessionUser.email}</span>
          </div>
        )}
      </div>

      {err && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {err}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {(loading && kpis.length === 0 ? Array.from({ length: 4 }) : kpis).map((k, i) => (
          <StatCard
            key={k?.label || i}
            label={k?.label ?? "—"}
            value={k?.value ?? "…"}
            delta={k?.delta ?? ""}
            up={k?.up ?? true}
          />
        ))}
      </div>

      {/* Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <RecentTransactions items={recent} loading={loading} />
        </div>
        <div className="lg:col-span-1">
          <TopAccounts items={topAccounts} loading={loading} currency="USD" />
        </div>
      </div>
    </div>
  );
}
