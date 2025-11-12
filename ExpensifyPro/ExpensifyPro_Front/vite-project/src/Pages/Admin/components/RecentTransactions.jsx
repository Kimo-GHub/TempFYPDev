/* RecentTransactions.jsx */
export default function RecentTransactions({ items = [], loading = false, showUser = false }) {
  const fmtDate = (iso) =>
    iso
      ? new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "2-digit", day: "2-digit" })
      : "-";

  const fmtMoney = (amt, curr = "USD") =>
    new Intl.NumberFormat(undefined, { style: "currency", currency: curr }).format(Math.abs(Number(amt || 0)));

  return (
    <div className="rounded-2xl border border-gray-200 bg-white">
      <div className="px-4 py-3 border-b">
        <h3 className="text-sm font-medium">Recent Transactions</h3>
      </div>

      <div className="p-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500">
              <th className="py-2">Date</th>
              <th className="py-2">Description</th>
              {showUser && <th className="py-2">User</th>}
              <th className="py-2">Account</th>
              <th className="py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {loading && items.length === 0 && (
              <>
                <tr><td colSpan={showUser ? 5 : 4} className="py-6"><div className="h-5 animate-pulse rounded bg-gray-100" /></td></tr>
                <tr><td colSpan={showUser ? 5 : 4} className="py-6"><div className="h-5 animate-pulse rounded bg-gray-100" /></td></tr>
                <tr><td colSpan={showUser ? 5 : 4} className="py-6"><div className="h-5 animate-pulse rounded bg-gray-100" /></td></tr>
              </>
            )}

            {!loading && items.map((t) => {
              // API sends signed amount (income positive, expense negative) in USD by default
              const sign = Number(t.amount) < 0 ? "-" : "+";
              const color = Number(t.amount) < 0 ? "text-red-600" : "text-emerald-700";
              return (
                <tr key={t.id} className="border-t">
                  <td className="py-2">{fmtDate(t.date)}</td>
                  <td className="py-2">{t.description || "-"}</td>
                  {showUser && (<td className="py-2">{t.user_name || t.user || "-"}</td>)}
                  <td className="py-2">{t.account || "-"}</td>
                  <td className={`py-2 text-right ${color}`}>
                    {sign}{fmtMoney(t.amount, t.currency || "USD")}
                  </td>
                </tr>
              );
            })}

            {!loading && items.length === 0 && (
              <tr>
                <td className="py-6 text-center text-gray-500" colSpan={showUser ? 5 : 4}>
                  No transactions yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
