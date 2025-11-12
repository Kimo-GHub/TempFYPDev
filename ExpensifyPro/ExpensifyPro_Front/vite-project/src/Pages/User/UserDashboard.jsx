import { useEffect, useState } from "react";
import StatCard from "../Admin/components/StatCard";
import RecentTransactions from "../Admin/components/RecentTransactions";
import TopAccounts from "../Admin/components/TopAccounts";
import { apiService } from "../../api";

export default function UserDashboard() {
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
        // tweak limits / currency if you want
        const data = await apiService.getDashboardOverview({
          currency: "USD",
          recent_limit: 6,
          accounts_limit: 3,
        });
        if (ignore) return;
        // remove the "Active Users" KPI
        const filteredKpis = (data?.kpis ?? []).filter(k =>
         !/active\s*users/i.test(k?.label ?? k?.name ?? "")
          );

            setKpis(filteredKpis);
            setRecent(data?.recent ?? []);
            setTopAccounts(data?.top_accounts ?? []);
        //if u want to make active users appear again uncomment the bottom 3 lines of code and delete everything from line 27 la 34
        //setKpis(data?.kpis ?? []);
        //setRecent(data?.recent ?? []);
        //setTopAccounts(data?.top_accounts ?? []);
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
