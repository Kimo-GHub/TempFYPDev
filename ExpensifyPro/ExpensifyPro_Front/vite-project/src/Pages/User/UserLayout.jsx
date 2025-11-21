import { useEffect, useMemo, useState } from "react";
import { Outlet, Link } from "react-router-dom";
import { Menu } from "lucide-react";
import UserSidebar from "./UserSidebar";
import { apiService } from "../../api";
import { useNotifications } from "../../components/NotificationContext.jsx";

export default function UserLayout() {
  const [open, setOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifItems, setNotifItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const notify = useNotifications();

  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("exp_user") || "null");
    } catch {
      return null;
    }
  }, []);
  const currentUserId = currentUser?.id;

  const historyKey = (scope = "all") => `notif:history:${currentUserId}:${scope}`;
  const loadHistory = () => {
    if (!currentUserId) return [];
    try {
      const raw = localStorage.getItem(historyKey());
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  };
  const saveHistory = (items) => {
    if (!currentUserId) return;
    try {
      localStorage.setItem(historyKey(), JSON.stringify(items));
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    if (!currentUserId) return;

    const lastSeenKey = (scope) => `notif:lastSeen:${currentUserId}:${scope}`;
    const getLastSeen = (scope) => {
      try {
        const v = localStorage.getItem(lastSeenKey(scope));
        return v ? Number(v) : 0;
      } catch {
        return 0;
      }
    };
    const setLastSeen = (scope, ts) => {
      try {
        localStorage.setItem(lastSeenKey(scope), String(ts));
      } catch {
        /* ignore */
      }
    };

    const checkNewItems = async () => {
      try {
        // Projects
        const projLastSeen = getLastSeen("projects");
        const projRes = await apiService.getProjects({ user_id: currentUserId, page: 1, page_size: 50 });
        const newProjects = (projRes?.results || []).filter((p) => {
          const createdTs = p.created_at ? Date.parse(p.created_at) : 0;
          return createdTs && createdTs > projLastSeen;
        });
        newProjects.slice(0, 3).forEach((p) =>
          notify({
            type: "info",
            message: `New project added for you: ${p.name || `Project #${p.id}`}`,
          })
        );
        if (newProjects.length) setLastSeen("projects", Date.now());

        // Categories
        const catLastSeen = getLastSeen("categories");
        const catRes = await apiService.getCategories({ user_id: currentUserId, page: 1, page_size: 50 });
        const newCats = (catRes?.results || []).filter((c) => {
          const createdTs = c.created_at ? Date.parse(c.created_at) : 0;
          return createdTs && createdTs > catLastSeen;
        });
        newCats.slice(0, 3).forEach((c) =>
          notify({
            type: "info",
            message: `New category available: ${c.name || `Category #${c.id}`}`,
          })
        );
        if (newCats.length) setLastSeen("categories", Date.now());

        // Automations (recurring transactions)
        const autoLastSeen = getLastSeen("automations");
        const autoRes = await apiService.getTransactions({
          user_id: currentUserId,
          page: 1,
          page_size: 100,
          is_recurring: true,
        });
        const newAutos = (autoRes?.results || []).filter((a) => {
          const createdTs = a.created_at ? Date.parse(a.created_at) : 0;
          return createdTs && createdTs > autoLastSeen;
        });
        if (newAutos.length) setLastSeen("automations", Date.now());

        // Persist into local history
        const existing = loadHistory();
        const existingKeys = new Set(
          existing.map((n) => (n.type && n.item_id ? `${n.type}:${n.item_id}` : n.id))
        );
        const now = Date.now();
        const mkItem = (type, rec) => ({
          id: `${type}-${rec.id}-${now}-${Math.random().toString(16).slice(2)}`,
          item_id: rec.id,
          type,
          title: type === "project" ? "New project" : type === "category" ? "New category" : "New automation",
          message: rec.name || rec.description || `${type} #${rec.id}`,
          created_at: rec.created_at || new Date(now).toISOString(),
          read: false,
        });
        const additions = [
          ...newProjects.map((p) => mkItem("project", p)),
          ...newCats.map((c) => mkItem("category", c)),
          ...newAutos.map((a) => mkItem("automation", a)),
        ].filter((item) => !existingKeys.has(`${item.type}:${item.item_id}`));
        if (additions.length) {
          const merged = [...additions, ...existing].slice(0, 50);
          saveHistory(merged);
          setNotifItems(merged);
          setUnreadCount(merged.filter((n) => !n.read).length);
        } else {
          setNotifItems(existing);
          setUnreadCount(existing.filter((n) => !n.read).length);
        }
      } catch {
        // Silent fail; do not block layout
        const existing = loadHistory();
        setNotifItems(existing);
        setUnreadCount(existing.filter((n) => !n.read).length);
      }
    };

    checkNewItems();
  }, [currentUserId, notify]);

  const markAllRead = () => {
    const next = notifItems.map((n) => ({ ...n, read: true }));
    setNotifItems(next);
    setUnreadCount(0);
    saveHistory(next);
  };

  const toggleRead = (id) => {
    const next = notifItems.map((n) => (n.id === id ? { ...n, read: true } : n));
    setNotifItems(next);
    setUnreadCount(next.filter((n) => !n.read).length);
    saveHistory(next);
  };

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

          <div className="flex items-center gap-3">
            <div className="relative">
              <button
                onClick={() => setNotifOpen((v) => !v)}
                className="relative rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              >
                🔔
                {unreadCount > 0 ? (
                  <span className="absolute -top-1 -right-1 h-5 min-w-5 rounded-full bg-indigo-600 px-1 text-center text-[11px] font-bold text-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                ) : null}
              </button>
              {notifOpen ? (
                <div className="absolute right-0 mt-2 w-72 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-2xl ring-1 ring-slate-100 z-30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-slate-800">Notifications</span>
                    <button
                      onClick={markAllRead}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                    >
                      Mark all read
                    </button>
                  </div>
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {notifItems.length === 0 ? (
                      <div className="text-xs text-slate-500">No notifications</div>
                    ) : (
                      notifItems.map((n) => (
                        <div
                          key={n.id}
                          className={`rounded-xl border px-3 py-2 text-xs ${
                            n.read ? "border-slate-200 bg-white" : "border-indigo-100 bg-indigo-50"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-800">{n.title}</span>
                            {!n.read ? (
                              <button
                                onClick={() => toggleRead(n.id)}
                                className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-700"
                              >
                                Read
                              </button>
                            ) : null}
                          </div>
                          <div className="text-slate-600 mt-0.5">{n.message}</div>
                          <div className="text-[10px] text-slate-400 mt-1">
                            {n.created_at ? new Date(n.created_at).toLocaleString() : "Just now"}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : null}
            </div>

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
