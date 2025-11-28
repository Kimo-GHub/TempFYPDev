import { useState } from "react";
import { Outlet, Link } from "react-router-dom";
import { Menu, Bot } from "lucide-react";
import AdminSidebar from "./AdminSidebar";

export default function AdminLayout() {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen flex bg-linear-to-br from-emerald-50 via-teal-50 to-white">
      {/* Sidebar (mobile drawer + desktop fixed) */}
      <AdminSidebar open={open} onClose={() => setOpen(false)} />

      {/* Main area (shift right when md+) */}
      <div className="flex-1 min-w-0 md:ml-64">
        {/* Top bar */}
        <header className="h-16 bg-white/80 backdrop-blur border-b flex items-center px-4 md:px-6 justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            {/* mobile: hamburger */}
            <button
              onClick={() => setOpen(true)}
              className="md:hidden p-2 rounded-lg border border-gray-200 hover:bg-gray-50 active:scale-95 transition"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5 text-gray-700" />
            </button>
            <span className="hidden md:inline text-sm text-gray-600">Admin Panel</span>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/expensi"
              className="inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-sm bg-white hover:bg-gray-50 shadow-sm"
              aria-label="Open Expensi"
            >
              <svg
              viewBox="0 0 24 24"
              className="h-6 w-6 text-white"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M17.1153 15.3582C16.8446 15.6642 16.5606 15.9665 16.2635 16.2635C11.9678 20.5593 6.58585 22.1422 4.2427 19.7991C2.6363 18.1926 2.8752 15.158 4.56847 12.0242M6.88967 8.72526C7.17138 8.40495 7.46772 8.08875 7.77824 7.77824C12.074 3.48247 17.4559 1.89956 19.7991 4.2427C21.4066 5.85021 21.1662 8.88795 19.4698 12.024M16.2635 7.77824C20.5593 12.074 22.1422 17.4559 19.7991 19.7991C17.4559 22.1422 12.074 20.5593 7.77824 16.2635C3.48247 11.9678 1.89956 6.58585 4.2427 4.2427C6.58585 1.89956 11.9678 3.48247 16.2635 7.77824ZM13.0001 12C13.0001 12.5523 12.5523 13 12.0001 13C11.4478 13 11.0001 12.5523 11.0001 12C11.0001 11.4477 11.4478 11 12.0001 11C12.5523 11 13.0001 11.4477 13.0001 12Z"
                stroke="green"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
              
            </Link>
            <Link
              to="/"
              className="text-sm rounded-xl border px-3 py-1.5 bg-white hover:bg-gray-50 shadow-sm"
            >
              Back to Site
            </Link>
          </div>
        </header>

        {/* Routed content */}
        <main className="p-4 md:p-6">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>

        {/* footer (tiny accent) */}
        <footer className="px-6 pb-6">
          <div className="mx-auto max-w-7xl">
            <div className="rounded-2xl bg-linear-to-r from-emerald-600 to-teal-600 p-px">
              <div className="rounded-2xl bg-white/80 p-3 text-center text-xs text-gray-600">
                ExpensifyPro Admin • crafted with 💚
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
