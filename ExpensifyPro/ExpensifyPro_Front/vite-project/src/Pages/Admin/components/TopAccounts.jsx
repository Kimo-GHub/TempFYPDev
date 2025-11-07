/* TopAccounts.jsx */
export default function TopAccounts({ items = [], loading = false, currency = "USD" }) {
  const fmtMoney = (v) =>
    new Intl.NumberFormat(undefined, { style: "currency", currency }).format(Number(v || 0));

  const tidy = (s) => (s ? s[0].toUpperCase() + s.slice(1) : "-");

  return (
    <div className="rounded-2xl border border-gray-200 bg-white">
      <div className="px-4 py-3 border-b">
        <h3 className="text-sm font-medium">Top Accounts</h3>
      </div>

      <ul className="p-4 space-y-3">
        {loading && items.length === 0 && (
          <>
            <li className="h-10 animate-pulse rounded-lg bg-gray-100" />
            <li className="h-10 animate-pulse rounded-lg bg-gray-100" />
            <li className="h-10 animate-pulse rounded-lg bg-gray-100" />
          </>
        )}

        {!loading && items.map((a) => (
          <li key={a.id} className="flex items-center justify-between">
            <div className="text-sm">
              <div className="font-medium">{a.name}</div>
              <div className="text-gray-500">{tidy(a.type)}</div>
            </div>
            <div className="text-sm font-semibold">{fmtMoney(a.balance)}</div>
          </li>
        ))}

        {!loading && items.length === 0 && (
          <li className="text-center text-gray-500 py-6">No accounts.</li>
        )}
      </ul>
    </div>
  );
}
