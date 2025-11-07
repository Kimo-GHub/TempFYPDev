export default function StatCard({ label, value, delta, up }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="text-sm text-gray-600">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      <div
        className={`mt-1 inline-flex items-center rounded-lg px-2 py-0.5 text-xs ${
          up
            ? "bg-emerald-50 text-emerald-700"
            : "bg-red-50 text-red-700"
        }`}
      >
        <span>{delta}</span>
      </div>
    </div>
  );
}
