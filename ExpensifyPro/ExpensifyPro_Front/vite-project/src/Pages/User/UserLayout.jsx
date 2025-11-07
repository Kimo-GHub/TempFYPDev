import { useState } from "react";
import { Outlet, Link } from "react-router-dom";
import { Menu } from "lucide-react";
import UserSidebar from "./UserSidebar";

export default function UserLayout() {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen flex bg-linear-to-br from-indigo-50 via-violet-50 to-white">
      {/* Sidebar (mobile drawer + desktop fixed) */}
      <UserSidebar open={open} onClose={() => setOpen(false)} />

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
            <span className="hidden md:inline text-sm text-gray-600">User Area</span>
          </div>

          <Link
            to="/"
            className="text-sm rounded-xl border px-3 py-1.5 bg-white hover:bg-gray-50 shadow-sm"
          >
            Back to Site
          </Link>
        </header>

        {/* Routed content */}
        <main className="p-4 md:p-6">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>

        {/* footer */}
        <footer className="px-6 pb-6">
          <div className="mx-auto max-w-7xl">
            <div className="rounded-2xl bg-linear-to-r from-indigo-600 to-purple-600 p-px">
              <div className="rounded-2xl bg-white/80 p-3 text-center text-xs text-gray-600">
                ExpensifyPro User • built with 💜
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
