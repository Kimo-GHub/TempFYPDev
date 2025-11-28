import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

/**
 * Shared top navbar used across public pages (Home) and app pages (Expensi, Automate).
 * Keeps the same look/links as the homepage header and remains auth-aware.
 */
export default function MainNavbar({ buttonPalette }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [expUser, setExpUser] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState("");
  const accentColor = buttonPalette?.primary || buttonPalette?.buttonBg;
  const avatarStyle = accentColor
    ? {
        ringColor: accentColor,
        backgroundColor: `${accentColor}1a`,
        color: accentColor,
      }
    : undefined;

  // lock body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => (document.body.style.overflow = "");
  }, [open]);

  // session bootstrap + keep in sync across tabs
  useEffect(() => {
    const read = () => {
      try {
        const uRaw = localStorage.getItem("exp_user");
        const u = uRaw ? JSON.parse(uRaw) : null;
        setExpUser(u);
        const key = u?.id ? `avatar:${u.id}` : null;
        if (key) setAvatarUrl(localStorage.getItem(key) || "");
        else setAvatarUrl("");
      } catch {
        setExpUser(null);
        setAvatarUrl("");
      }
    };
    read();
    const onStorage = (e) => {
      if (!e) return;
      if (["exp_user"].includes(e.key) || (expUser?.id && e.key === `avatar:${expUser.id}`)) read();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initials = useMemo(() => {
    const src = expUser?.name || expUser?.email || "";
    const parts = String(src).trim().split(/\s+/);
    return parts
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() || "")
      .join("") || "U";
  }, [expUser]);
  const isLoggedIn = Boolean(expUser?.id);
  const dashboardPath = expUser?.role === 1 ? "/admin" : expUser?.role ? "/user" : "/login";

  const navItems = [
    { label: "Home", href: "/#home" },
    { label: "aboutus", href: "/#aboutus" },
    { label: "Features", href: "/#features" },
    {
      label: isLoggedIn ? "Expensi" : "FAQ",
      href: isLoggedIn ? "/expensi" : "/#faq",
    },
    {
      label: isLoggedIn ? "Automate" : "contactus",
      href: isLoggedIn ? "/automate" : "/#contactus",
    },
  ];

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 shadow-sm">
      <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="my-3 flex h-14 items-center justify-between rounded-2xl border border-gray-200/80 bg-white/80 shadow-sm ring-1 ring-gray-900/5 px-3 sm:px-4">
          {/* Brand */}
          <Link to="/" className="group inline-flex items-center gap-2">
            <div
              className="h-8 w-8 rounded-xl shadow-sm bg-linear-to-tr from-emerald-400 to-teal-500"
              style={
                buttonPalette
                  ? {
                      backgroundImage: `linear-gradient(135deg, ${buttonPalette.buttonBg}, ${buttonPalette.primary || buttonPalette.buttonBg})`,
                    }
                  : undefined
              }
            />
            <span className="text-lg font-semibold tracking-tight">
              Expensify
              <span
                className="text-emerald-600"
                style={buttonPalette ? { color: buttonPalette.primary || buttonPalette.buttonBg } : undefined}
              >
                Pro
              </span>
            </span>
          </Link>

          {/* Desktop nav */}
          <ul className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <li key={item.label}>
                <a
                  href={item.href}
                  className="text-sm px-3 py-2 rounded-xl hover:bg-gray-50 text-gray-700 transition hover:text-emerald-700"
                  onMouseEnter={(e) => {
                    if (accentColor) e.currentTarget.style.color = accentColor;
                  }}
                  onMouseLeave={(e) => {
                    if (accentColor) e.currentTarget.style.color = "";
                  }}
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>

          {/* Right side */}
          <div className="hidden md:flex items-center gap-2">
            {isLoggedIn ? (
              <Link to={dashboardPath} title="Open your dashboard" className="inline-flex items-center gap-2">
                <span className="sr-only">Dashboard</span>
                <span
                  className="h-9 w-9 rounded-full overflow-hidden ring-2 bg-emerald-500/20 flex items-center justify-center text-xs font-semibold text-emerald-900 shadow-sm"
                  style={avatarStyle}
                >
                  {avatarUrl ? <img src={avatarUrl} alt="avatar" className="h-full w-full object-cover" /> : <span>{initials}</span>}
                </span>
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-sm rounded-xl px-3 py-2 text-gray-700 hover:text-emerald-700 hover:bg-gray-50 transition"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="text-sm rounded-xl bg-emerald-600 px-3 py-2 text-white shadow hover:bg-emerald-700 transition"
                >
                  Get started
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu toggle */}
          <button
            className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 text-gray-600 hover:text-emerald-700 hover:border-emerald-200 transition"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {open ? (
                <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
              ) : (
                <path d="M4 8h16M4 16h16" strokeLinecap="round" strokeLinejoin="round" />
              )}
            </svg>
          </button>
        </div>
      </nav>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden border-t border-gray-200 bg-white/95 backdrop-blur shadow-sm">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-3 space-y-2">
            {navItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                onClick={() => setOpen(false)}
                className="block rounded-xl px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-emerald-700 transition"
              >
                {item.label}
              </a>
            ))}
            <div className="h-px bg-gray-200 my-2" />
            {isLoggedIn ? (
              <Link
                to={dashboardPath}
                onClick={() => setOpen(false)}
                className="inline-flex items-center gap-3 rounded-xl px-3 py-2 border border-gray-200 bg-white text-sm text-gray-800"
              >
                <span
                  className="h-9 w-9 rounded-full overflow-hidden ring-2 bg-emerald-500/20 flex items-center justify-center text-xs font-semibold text-emerald-900 shadow-sm"
                  style={avatarStyle}
                >
                  {avatarUrl ? <img src={avatarUrl} alt="avatar" className="h-full w-full object-cover" /> : <span>{initials}</span>}
                </span>
                <span>Dashboard</span>
              </Link>
            ) : (
              <div className="flex gap-2">
                <Link
                  to="/login"
                  onClick={() => setOpen(false)}
                  className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  onClick={() => setOpen(false)}
                  className="flex-1 rounded-xl bg-emerald-600 px-3 py-2 text-sm text-white shadow hover:bg-emerald-700 transition"
                >
                  Get started
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
