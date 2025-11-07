import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  User as UserIcon,
  CreditCard,
  Wallet,
  BarChart3,
  FolderKanban,
  PiggyBank,
  Tags,
  LogOut,
  X,
} from "lucide-react";

/**
 * Props:
 *  - open: boolean (drawer open on mobile)
 *  - onClose: () => void (called when closing drawer)
 */
const navItems = [
  { to: "/user", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/user/profile", label: "Profile", icon: UserIcon },
  { to: "/user/accounts", label: "Accounts", icon: Wallet },
  { to: "/user/transactions", label: "Transactions", icon: CreditCard },
  { to: "/user/projects", label: "Projects", icon: FolderKanban },
  { to: "/user/budgets", label: "Budgets", icon: PiggyBank },
  { to: "/user/categories", label: "Categories", icon: Tags },
  { to: "/user/analytics", label: "Analytics", icon: BarChart3 },
];

export default function UserSidebar({ open, onClose }) {
  // purple/indigo theme (different from Admin)
  const panel =
    "h-full w-64 flex flex-col bg-linear-to-b from-indigo-700 via-indigo-600 to-purple-600 text-white shadow-[4px_0_15px_-5px_rgba(0,0,0,0.15)]";

  const linkClasses = (isActive) =>
    `group flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition
     ${isActive ? "bg-white/15 font-medium" : "hover:bg-white/10"}`;

  return (
    <>
      {/* overlay - mobile only */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity md:hidden ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* mobile slide-in panel */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 md:hidden ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
      >
        <div className={panel}>
          <div className="h-16 px-5 flex items-center justify-between border-b border-white/10">
            <div className="text-lg font-bold tracking-tight">ExpensifyPro</div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/10 transition"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto p-3">
            <ul className="space-y-1">
              {navItems.map(({ to, label, icon: Icon, end }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    end={end}
                    className={({ isActive }) => linkClasses(isActive)}
                    onClick={onClose}
                  >
                    <Icon className="h-5 w-5 opacity-90" />
                    <span>{label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          <div className="p-3 border-t border-white/10">
            <button
              onClick={() => {
                localStorage.removeItem("user");
                localStorage.removeItem("token");
                localStorage.removeItem("exp_user");
                localStorage.removeItem("org_id");
                sessionStorage.clear();
                window.location.href = "/login";
              }}
              className="w-full flex items-center gap-3 rounded-xl px-3 py-2 text-sm hover:bg-white/10 transition"
            >
              <LogOut className="h-5 w-5 opacity-90" />
              <span>Log out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* desktop fixed sidebar */}
      <aside className="hidden md:flex md:flex-col fixed left-0 top-0 h-full w-64 z-30">
        <div className={panel}>
          <div className="h-16 flex items-center px-5 border-b border-white/10">
            <div className="text-lg font-bold tracking-tight">ExpensifyPro</div>
          </div>

          <nav className="flex-1 overflow-y-auto p-3">
            <ul className="space-y-1">
              {navItems.map(({ to, label, icon: Icon, end }) => (
                <li key={to}>
                  <NavLink to={to} end={end} className={({ isActive }) => linkClasses(isActive)}>
                    <Icon className="h-5 w-5 opacity-90" />
                    <span>{label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          <div className="p-3 border-t border-white/10">
            <button
              onClick={() => {
                localStorage.removeItem("user");
                localStorage.removeItem("token");
                localStorage.removeItem("exp_user");
                localStorage.removeItem("org_id");
                sessionStorage.clear();
                window.location.href = "/login";
              }}
              className="w-full flex items-center gap-3 rounded-xl px-3 py-2 text-sm hover:bg-white/10 transition"
            >
              <LogOut className="h-5 w-5 opacity-90" />
              <span>Log out</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
