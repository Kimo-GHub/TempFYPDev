import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";

export default function Home() {
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const [expUser, setExpUser] = useState(null);
    const [avatarUrl, setAvatarUrl] = useState("");

    // lock body scroll when mobile menu is open
    useEffect(() => {
        document.body.style.overflow = open ? "hidden" : "";
        return () => (document.body.style.overflow = "");
    }, [open]);

    // for the contact us 
    const [sending, setSending] = useState(false);
    function handleContactSubmit(e) {
        e.preventDefault();
        setSending(true);
        setTimeout(() => {
            setSending(false);
            e.target.reset();
            alert("Thanks! We'll get back to you soon.");
        }, 800);
    }

    const year = new Date().getFullYear();

    // session bootstrap + keep in sync across tabs
    useEffect(() => {
        const read = () => {
            try {
                const uRaw = localStorage.getItem("exp_user");
                const u = uRaw ? JSON.parse(uRaw) : null;
                setExpUser(u);
                const key = u?.id ? `avatar:${u.id}` : null;
                if (key) setAvatarUrl(localStorage.getItem(key) || ""); else setAvatarUrl("");
            } catch {
                setExpUser(null);
                setAvatarUrl("");
            }
        };
        read();
        const onStorage = (e) => {
            if (!e) return; // IE safeguard
            if (["exp_user"].includes(e.key) || (expUser?.id && e.key === `avatar:${expUser.id}`)) read();
        };
        window.addEventListener("storage", onStorage);
        return () => window.removeEventListener("storage", onStorage);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const initials = useMemo(() => {
        const src = expUser?.name || expUser?.email || "";
        const parts = String(src).trim().split(/\s+/);
        return parts.slice(0, 2).map((s) => s[0]?.toUpperCase() || "").join("") || "U";
    }, [expUser]);



    {/* Place this helper component in the SAME file (above or below Home) */ }
    function FAQ() {
        const [open, setOpen] = useState(0); // index of open item, -1 for none
        const items = [
            {
                q: "Is ExpensifyPro free to use?",
                a: "Yes—there’s a generous free plan for individuals. Teams can start free and upgrade when they need advanced controls."
            },
            {
                q: "Can I import data from spreadsheets or other apps?",
                a: "Absolutely. You can import CSV/Excel files, and we support common column mappings for a quick setup."
            },
            {
                q: "Does it support multiple currencies?",
                a: "Yes. Record transactions in any currency and view reports converted to your base currency."
            },
            {
                q: "How does receipt scanning work?",
                a: "Upload a photo or PDF and we’ll auto-extract totals, dates, and merchants. You can review and edit before saving."
            },
            {
                q: "Is my data secure?",
                a: "We use HTTPS everywhere, role-based permissions, and best practices for encryption at rest and in transit."
            }
        ];
        // return for FAQ
        return (
            <div className="space-y-4">
                {items.map((item, i) => {
                    const isOpen = open === i;
                    return (
                        <div
                            key={i}
                            className={`group rounded-3xl border ${isOpen ? "border-emerald-200" : "border-gray-200"} bg-white shadow-sm hover:shadow-md transition`}
                        >
                            <button
                                onClick={() => setOpen(isOpen ? -1 : i)}
                                className="w-full flex items-center gap-3 justify-between text-left px-5 sm:px-6 py-5"
                            >
                                <div className="flex items-start gap-3">
                                    <span className="mt-1 inline-flex h-6 w-6 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 text-xs font-semibold">
                                        {String(i + 1).padStart(2, "0")}
                                    </span>
                                    <span className="font-medium text-gray-900">{item.q}</span>
                                </div>
                                <span
                                    className={`ml-4 inline-flex h-8 w-8 items-center justify-center rounded-xl border ${isOpen ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-gray-200 text-gray-500"
                                        } transition`}
                                >
                                    <svg
                                        className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
                                        viewBox="0 0 20 20"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                    >
                                        <path d="M6 8l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                </span>
                            </button>

                            <div
                                className={`px-5 sm:px-6 pb-5 text-gray-600 grid transition-all duration-300 ${isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                                    }`}
                            >
                                <div className="overflow-hidden">
                                    <p className="leading-relaxed">{item.a}</p>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    }



    // main return
    return (
        <div className="min-h-screen bg-linear-to-b from-white via-gray-50 to-gray-100 text-gray-800">
            {/* ===== NAVBAR ===== */}
            <header className="sticky top-0 z-50 bg-white/60 backdrop-blur supports-[backdrop-filter]:bg-white/50">
                <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="my-3 flex h-14 items-center justify-between rounded-2xl border border-gray-200/80 bg-white/80 shadow-sm ring-1 ring-gray-900/5 px-3 sm:px-4">
                        {/* Brand */}
                        <Link to="#home" className="group inline-flex items-center gap-2">
                            <div className="h-8 w-8 rounded-xl bg-linear-to-tr from-emerald-400 to-teal-500 shadow-sm" />
                            <span className="text-lg font-semibold tracking-tight">
                                Expensify<span className="text-emerald-600">Pro</span>
                            </span>
                        </Link>

                        {/* Desktop nav */}
                        <ul className="hidden md:flex items-center gap-1">
                            <li>
                                <a href="#Home" className="text-sm px-3 py-2 rounded-xl hover:bg-gray-50 text-gray-700 hover:text-emerald-700 transition">
                                    Home
                                </a>
                            </li>
                            <li>
                                <a href="#aboutus" className="text-sm px-3 py-2 rounded-xl hover:bg-gray-50 text-gray-700 hover:text-emerald-700 transition">
                                    aboutus
                                </a>
                            </li>
                            <li>
                                <a href="#features" className="text-sm px-3 py-2 rounded-xl hover:bg-gray-50 text-gray-700 hover:text-emerald-700 transition">
                                    Features
                                </a>
                            </li>
                            <li>
                                <a href="#faq" className="text-sm px-3 py-2 rounded-xl hover:bg-gray-50 text-gray-700 hover:text-emerald-700 transition">
                                    FAQ
                                </a>
                            </li>
                            <li>
                                <a href="#contactus" className="text-sm px-3 py-2 rounded-xl hover:bg-gray-50 text-gray-700 hover:text-emerald-700 transition">
                                    contactus
                                </a>
                            </li>
                        </ul>

                        {/* Actions */}
                        <div className="hidden md:flex items-center gap-2">
                            {expUser ? (
                                <Link
                                    to={expUser.role === 1 ? "/admin" : "/user"}
                                    title="Open your dashboard"
                                    className="inline-flex items-center gap-2"
                                >
                                    <span className="sr-only">Dashboard</span>
                                    <span className="h-9 w-9 rounded-full overflow-hidden ring-2 ring-emerald-300 bg-emerald-500/20 flex items-center justify-center text-xs font-semibold text-emerald-900 shadow-sm">
                                        {avatarUrl ? (
                                            <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                                        ) : (
                                            <span>{initials}</span>
                                        )}
                                    </span>
                                </Link>
                            ) : (
                                <>
                                    <Link
                                        to="/login"
                                        className="text-sm px-3 py-2 rounded-xl hover:bg-gray-50 text-gray-700 hover:text-emerald-700 transition"
                                    >
                                        Log in
                                    </Link>
                                    <Link
                                        to="/register"
                                        className="text-sm rounded-xl bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700 transition shadow-md"
                                    >
                                        Get Started
                                    </Link>
                                </>
                            )}
                        </div>


                        {/* Mobile menu button */}
                        <button
                            onClick={() => setOpen(!open)}
                            aria-label="Toggle menu"
                            className="md:hidden inline-flex items-center justify-center rounded-xl p-2 border border-gray-200 bg-white hover:bg-gray-50 shadow-sm transition"
                        >
                            <svg width="24" height="24" fill="none" stroke="currentColor">
                                {open ? (
                                    <path strokeWidth="2" strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
                                ) : (
                                    <path strokeWidth="2" strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
                                )}
                            </svg>
                        </button>
                    </div>
                </nav>

                {/* Mobile drawer */}
                <div className={`md:hidden origin-top overflow-hidden border-t border-gray-200 bg-white ${open ? "animate-slideDown" : "hidden"}`}>
                    <div className="px-4 py-4 space-y-3">
                        <a href="#features" onClick={() => setOpen(false)} className="block text-sm">
                            Features
                        </a>
                        <a href="#pricing" onClick={() => setOpen(false)} className="block text-sm">
                            Pricing
                        </a>
                        <a href="#faq" onClick={() => setOpen(false)} className="block text-sm">
                            FAQ
                        </a>
                        <div className="pt-2 flex items-center gap-2">
                            {expUser ? (
                                <>
                                    <Link
                                        to={expUser.role === 1 ? "/admin" : "/user"}
                                        onClick={() => setOpen(false)}
                                        className="text-sm rounded-xl border px-3 py-2"
                                    >
                                        Open Dashboard
                                    </Link>
                                    <button
                                        onClick={() => {
                                            try {
                                                localStorage.removeItem("exp_user");
                                                // do not clear org_id to avoid breaking other tabs, but safe to clear if desired
                                            } catch {}
                                            setOpen(false);
                                            navigate("/login");
                                        }}
                                        className="text-sm rounded-xl bg-emerald-600 px-3 py-2 text-white shadow"
                                    >
                                        Log out
                                    </button>
                                </>
                            ) : (
                                <>
                                    <Link to="/login" onClick={() => setOpen(false)} className="text-sm">
                                        Log in
                                    </Link>
                                    <Link
                                        to="/register"
                                        onClick={() => setOpen(false)}
                                        className="text-sm rounded-xl bg-emerald-600 px-3 py-2 text-white shadow"
                                    >
                                        Get Started
                                    </Link>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            {/* ===== LANDING / HERO ===== */}
            <section id="Home" className="relative overflow-hidden">
                {/* background accents */}
                <div className="pointer-events-none absolute inset-0 -z-10">
                    <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-emerald-200/40 blur-3xl" />
                    <div className="absolute -bottom-16 -left-16 h-72 w-72 rounded-full bg-teal-200/40 blur-3xl" />
                </div>

                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-16 pb-24 lg:pt-24 lg:pb-28 grid lg:grid-cols-12 gap-10">
                    {/* Text */}
                    <div className="lg:col-span-6 flex flex-col justify-center">
                        <p className="text-emerald-700 font-medium mb-3 animate-fadeIn">Simple • Fast • Insightful</p>
                        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight animate-slideUp">
                            Track expenses. <span className="text-emerald-600">Grow smarter.</span>
                        </h1>
                        <p className="mt-4 text-gray-600 max-w-xl animate-fadeIn">
                            ExpensifyPro helps you capture receipts, categorize transactions, and visualize cash flow so you can
                            make better decisions in seconds.
                        </p>

                        <div className="mt-6 flex flex-wrap items-center gap-3 animate-fadeIn">
                            <Link
                                to="/register"
                                className="rounded-xl bg-emerald-600 px-5 py-3 text-white text-sm font-medium hover:bg-emerald-700 transition shadow"
                            >
                                Create Free Account
                            </Link>
                            <a
                                href="#features"
                                className="rounded-xl border border-gray-300 px-5 py-3 text-sm font-medium hover:border-emerald-400 hover:text-emerald-700 transition"
                            >
                                See Features
                            </a>
                        </div>

                        {/* quick stats */}
                        <div className="mt-8 grid grid-cols-3 gap-4 max-w-md">
                            {[
                                ["5k+", "Active users"],
                                ["$120M", "Tracked spend"],
                                ["98%", "Satisfaction"],
                            ].map(([value, label]) => (
                                <div
                                    key={label}
                                    className="rounded-2xl bg-white/70 backdrop-blur border border-gray-200 p-4 shadow-sm animate-fadeIn"
                                >
                                    <div className="text-xl font-semibold">{value}</div>
                                    <div className="text-xs text-gray-500">{label}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Illustration */}
                    <div className="lg:col-span-6">
                        <div className="relative mx-auto max-w-lg lg:max-w-none">
                            <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-xl animate-floatY">
                                {/* Simple finance chart SVG (inline, no assets needed) */}
                                <svg viewBox="0 0 560 320" className="w-full h-auto">
                                    <defs>
                                        <linearGradient id="g1" x1="0" x2="0" y1="0" y2="1">
                                            <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
                                            <stop offset="100%" stopColor="#10b981" stopOpacity="0.05" />
                                        </linearGradient>
                                    </defs>
                                    <rect x="0" y="0" width="560" height="320" rx="16" fill="#f9fafb" />
                                    <g transform="translate(40,30)">
                                        <rect x="0" y="0" width="480" height="240" rx="12" fill="white" stroke="#e5e7eb" />
                                        <path
                                            d="M0,190 C60,160 120,210 180,150 C240,90 300,170 360,120 C420,70 480,110 480,110"
                                            fill="url(#g1)"
                                        />
                                        <path
                                            d="M0,190 C60,160 120,210 180,150 C240,90 300,170 360,120 C420,70 480,110 480,110"
                                            fill="none"
                                            stroke="#10b981"
                                            strokeWidth="3"
                                        />
                                    </g>
                                </svg>
                                <div className="mt-4 text-center text-sm text-gray-500">Live insight preview</div>
                            </div>

                            {/* floating badge */}
                            <div className="absolute -top-4 -right-4 rounded-2xl bg-emerald-600 text-white text-xs px-3 py-2 shadow-lg animate-slideDown">
                                AI categorization · Realtime
                            </div>
                        </div>
                    </div>
                </div>
            </section>
            {/* End of Landing */}

            {/* ===== ABOUT US ===== */}
            <section id="aboutus" className="py-24 bg-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3 animate-slideUp">
                            About <span className="text-emerald-600">ExpensifyPro</span>
                        </h2>
                        <p className="max-w-2xl mx-auto text-gray-600 animate-fadeIn">
                            We built ExpensifyPro to help individuals and teams take full control of their finances. Our mission is
                            simple: make expense management effortless, insightful, and transparent for everyone.
                        </p>
                    </div>

                    {/* Stats / features row */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="rounded-2xl border border-gray-100 p-8 shadow-sm hover:shadow-md transition animate-fadeIn">
                            <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center mb-4">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    strokeWidth="1.5"
                                    stroke="currentColor"
                                    className="w-6 h-6 text-emerald-600"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m6-6H6" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-semibold mb-2">Simplify Tracking</h3>
                            <p className="text-sm text-gray-600">
                                Manage all your expenses and income in one intuitive dashboard — no clutter, no confusion.
                            </p>
                        </div>

                        <div className="rounded-2xl border border-gray-100 p-8 shadow-sm hover:shadow-md transition animate-fadeIn delay-100">
                            <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center mb-4">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    strokeWidth="1.5"
                                    stroke="currentColor"
                                    className="w-6 h-6 text-emerald-600"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M4.5 12a7.5 7.5 0 0115 0v1.5a3 3 0 11-6 0V12m-3 0v1.5a3 3 0 11-6 0V12z"
                                    />
                                </svg>
                            </div>
                            <h3 className="text-lg font-semibold mb-2">Empower Teams</h3>
                            <p className="text-sm text-gray-600">
                                Collaborate on budgets, approve reports, and keep everyone aligned with smart financial insights.
                            </p>
                        </div>

                        <div className="rounded-2xl border border-gray-100 p-8 shadow-sm hover:shadow-md transition animate-fadeIn delay-200">
                            <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center mb-4">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    strokeWidth="1.5"
                                    stroke="currentColor"
                                    className="w-6 h-6 text-emerald-600"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M12 20.25c4.556 0 8.25-3.694 8.25-8.25S16.556 3.75 12 3.75 3.75 7.444 3.75 12s3.694 8.25 8.25 8.25z"
                                    />
                                </svg>
                            </div>
                            <h3 className="text-lg font-semibold mb-2">Focus on Growth</h3>
                            <p className="text-sm text-gray-600">
                                Visualize cash flow, analyze trends, and make data-driven decisions that move your business forward.
                            </p>
                        </div>
                    </div>
                </div>
            </section>
            {/* End About */}




            {/* ===== FEATURES ===== */}
            <section id="features" className="py-24 bg-gray-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    {/* heading */}
                    <div className="text-center mb-14">
                        <span className="text-emerald-700 font-medium animate-fadeIn">What you get</span>
                        <h2 className="mt-2 text-3xl sm:text-4xl font-bold text-gray-900 animate-slideUp">
                            Powerful features for effortless finance
                        </h2>
                        <p className="mt-3 text-gray-600 max-w-2xl mx-auto animate-fadeIn">
                            Capture receipts, categorize transactions, and see insights instantly—built for individuals and teams.
                        </p>
                    </div>

                    {/* cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {/* 1 */}
                        <div className="rounded-2xl bg-white border border-gray-200 p-6 shadow-sm hover:shadow-md transition animate-fadeIn">
                            <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center mb-4">
                                <svg viewBox="0 0 24 24" className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h18M7 3v4m10-4v4M5 7v11a2 2 0 002 2h10a2 2 0 002-2V7" />
                                </svg>
                            </div>
                            <h3 className="font-semibold mb-1">Smart Receipt Capture</h3>
                            <p className="text-sm text-gray-600">Attach images or forward emails—auto-extract totals, dates, and merchants.</p>
                        </div>

                        {/* 2 */}
                        <div className="rounded-2xl bg-white border border-gray-200 p-6 shadow-sm hover:shadow-md transition animate-fadeIn delay-100">
                            <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center mb-4">
                                <svg viewBox="0 0 24 24" className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 6h15M4.5 12h15M4.5 18h10" />
                                </svg>
                            </div>
                            <h3 className="font-semibold mb-1">Auto-Categorization</h3>
                            <p className="text-sm text-gray-600">Rules + AI suggestions keep your categories clean and consistent.</p>
                        </div>

                        {/* 3 */}
                        <div className="rounded-2xl bg-white border border-gray-200 p-6 shadow-sm hover:shadow-md transition animate-fadeIn delay-200">
                            <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center mb-4">
                                <svg viewBox="0 0 24 24" className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l7-7 4 4 7-7M5 21h14a2 2 0 002-2v-5H3v5a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <h3 className="font-semibold mb-1">Budgets & Alerts</h3>
                            <p className="text-sm text-gray-600">Set limits per category and get notified before you overspend.</p>
                        </div>

                        {/* 4 */}
                        <div className="rounded-2xl bg-white border border-gray-200 p-6 shadow-sm hover:shadow-md transition animate-fadeIn">
                            <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center mb-4">
                                <svg viewBox="0 0 24 24" className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h6M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H9L5 9v10a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <h3 className="font-semibold mb-1">Approvals & Policies</h3>
                            <p className="text-sm text-gray-600">Lightweight workflows for team approvals and policy reminders.</p>
                        </div>

                        {/* 5 */}
                        <div className="rounded-2xl bg-white border border-gray-200 p-6 shadow-sm hover:shadow-md transition animate-fadeIn delay-100">
                            <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center mb-4">
                                <svg viewBox="0 0 24 24" className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-3.866 0-7 1.79-7 4s3.134 4 7 4 7-1.79 7-4-3.134-4-7-4z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8V4m0 16v-4" />
                                </svg>
                            </div>
                            <h3 className="font-semibold mb-1">Multi-Currency</h3>
                            <p className="text-sm text-gray-600">Track in any currency with on-the-fly conversion for reporting.</p>
                        </div>

                        {/* 6 */}
                        <div className="rounded-2xl bg-white border border-gray-200 p-6 shadow-sm hover:shadow-md transition animate-fadeIn delay-200">
                            <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center mb-4">
                                <svg viewBox="0 0 24 24" className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h10" />
                                </svg>
                            </div>
                            <h3 className="font-semibold mb-1">Reports & Export</h3>
                            <p className="text-sm text-gray-600">Beautiful summaries with CSV/Excel export for accountants.</p>
                        </div>
                    </div>

                    {/* mini process strip */}
                    <div className="mt-12 rounded-3xl bg-white border border-gray-200 p-6 lg:p-8 shadow-sm">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                            <div className="animate-fadeIn">
                                <div className="text-xs font-medium text-emerald-700 mb-1">Step 1</div>
                                <h4 className="font-semibold mb-1">Capture</h4>
                                <p className="text-sm text-gray-600">Upload receipts or add transactions manually.</p>
                            </div>
                            <div className="animate-fadeIn delay-100">
                                <div className="text-xs font-medium text-emerald-700 mb-1">Step 2</div>
                                <h4 className="font-semibold mb-1">Categorize</h4>
                                <p className="text-sm text-gray-600">AI suggestions and rules keep things organized.</p>
                            </div>
                            <div className="animate-fadeIn delay-200">
                                <div className="text-xs font-medium text-emerald-700 mb-1">Step 3</div>
                                <h4 className="font-semibold mb-1">Analyze</h4>
                                <p className="text-sm text-gray-600">Dashboards and exports for quick decisions.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>


            {/* ===== FAQ ===== */}
            <section id="faq" className="py-24 bg-gray-50">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-14">
                        <span className="inline-block rounded-full bg-emerald-50 text-emerald-700 px-3 py-1 text-xs font-medium animate-fadeIn">
                            Have questions?
                        </span>
                        <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-gray-900 animate-slideUp">
                            Frequently asked questions
                        </h2>
                        <p className="mt-3 text-gray-600 max-w-2xl mx-auto animate-fadeIn">
                            Quick answers about plans, features, and how ExpensifyPro works.
                        </p>
                    </div>

                    <div className="grid lg:grid-cols-2 gap-5">
                        <FAQ />
                        <div className="rounded-3xl bg-white border border-gray-200 p-6 shadow-sm lg:self-start">
                            <h3 className="text-lg font-semibold text-gray-900">Can’t find what you’re looking for?</h3>
                            <p className="mt-2 text-sm text-gray-600">
                                Our team is happy to help with setup, imports, and best practices.
                            </p>
                            <a
                                href="#contactus"
                                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition"
                            >
                                Contact support
                                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M12.293 5.293a1 1 0 011.414 0l3 3a.997.997 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L13.586 10H5a1 1 0 110-2h8.586l-1.293-1.293a1 1 0 010-1.414z" />
                                </svg>
                            </a>
                            <div className="mt-6 rounded-2xl bg-gray-50 p-4">
                                <div className="text-xs font-medium text-gray-500">Response time</div>
                                <div className="mt-1 text-sm text-gray-900">Typically under 24 hours</div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>



            {/* ===== CONTACT US ===== */}
            <section id="contactus" className="py-24 bg-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-14">
                        <span className="inline-block rounded-full bg-emerald-50 text-emerald-700 px-3 py-1 text-xs font-medium">
                            Get in touch
                        </span>
                        <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-gray-900">
                            We’d love to hear from you
                        </h2>
                        <p className="mt-3 text-gray-600 max-w-2xl mx-auto">
                            Questions about pricing, onboarding, or migrating data? Send us a message.
                        </p>
                    </div>

                    <div className="grid lg:grid-cols-5 gap-8">
                        {/* Contact info */}
                        <div className="lg:col-span-2 space-y-5">
                            <div className="rounded-3xl border border-gray-200 bg-gray-50 p-6">
                                <h3 className="text-lg font-semibold text-gray-900">Support</h3>
                                <p className="mt-1 text-sm text-gray-600">support@expensifypro.io</p>
                                <p className="mt-3 text-sm text-gray-600">Mon–Fri · 9:00–17:00</p>
                            </div>
                            <div className="rounded-3xl border border-gray-200 p-6">
                                <h3 className="text-lg font-semibold text-gray-900">Sales</h3>
                                <p className="mt-1 text-sm text-gray-600">sales@expensifypro.io</p>
                                <p className="mt-3 text-sm text-gray-600">We can help with demos & pilots.</p>
                            </div>
                            <div className="rounded-3xl border border-gray-200 p-6">
                                <h3 className="text-lg font-semibold text-gray-900">Address</h3>
                                <p className="mt-1 text-sm text-gray-600">123 Finance Ave, Suite 400<br />Beirut, LB</p>
                            </div>
                        </div>

                        {/* Form */}
                        <div className="lg:col-span-3">
                            <form
                                onSubmit={handleContactSubmit}
                                className="rounded-3xl border border-gray-200 bg-white p-6 lg:p-8 shadow-sm"
                            >
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Full name</label>
                                        <input
                                            required
                                            type="text"
                                            name="name"
                                            className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-2.5 outline-none focus:border-emerald-400"
                                            placeholder="Your name"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Email</label>
                                        <input
                                            required
                                            type="email"
                                            name="email"
                                            className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-2.5 outline-none focus:border-emerald-400"
                                            placeholder="you@example.com"
                                        />
                                    </div>
                                    <div className="sm:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700">Subject</label>
                                        <input
                                            required
                                            type="text"
                                            name="subject"
                                            className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-2.5 outline-none focus:border-emerald-400"
                                            placeholder="How can we help?"
                                        />
                                    </div>
                                    <div className="sm:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700">Message</label>
                                        <textarea
                                            required
                                            name="message"
                                            rows="5"
                                            className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-2.5 outline-none focus:border-emerald-400 resize-y"
                                            placeholder="Tell us a bit about your use case…"
                                        />
                                    </div>
                                </div>

                                <div className="mt-6 flex items-center gap-3">
                                    <button
                                        type="submit"
                                        disabled={sending}
                                        className={`rounded-xl px-5 py-3 text-sm font-medium text-white shadow transition
                ${sending ? "bg-emerald-400" : "bg-emerald-600 hover:bg-emerald-700"}`}
                                    >
                                        {sending ? "Sending…" : "Send message"}
                                    </button>
                                    <span className="text-xs text-gray-500">We typically reply within 24 hours.</span>
                                </div>
                            </form>


                        </div>
                    </div>
                </div>
            </section>



            {/* ===== FOOTER ===== */}
            <footer className="mt-24 border-t border-gray-200 bg-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
                        {/* Brand + blurb */}
                        <div className="md:col-span-2">
                            <div className="flex items-center gap-2">
                                <div className="h-8 w-8 rounded-xl bg-linear-to-tr from-emerald-400 to-teal-500 shadow-sm" />
                                <span className="text-lg font-semibold tracking-tight">
                                    Expensify<span className="text-emerald-600">Pro</span>
                                </span>
                            </div>
                            <p className="mt-3 text-sm text-gray-600 max-w-md">
                                Track expenses, categorize transactions, and visualize cash flow with ease.
                                Built for individuals and teams who want clarity and control.
                            </p>

                            {/* Socials */}
                            <div className="mt-4 flex items-center gap-3">
                                {/* Replace # with real links later */}
                                <a href="#" className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 text-gray-600 hover:text-emerald-700 hover:border-emerald-300 transition" aria-label="Twitter">
                                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><path d="M21.5 6.5l-6.7 11.9h-1.6l3-5.3-5.1-6.6h1.6l4.2 5.4 3.1-5.4h1.5z" /></svg>
                                </a>
                                <a href="#" className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 text-gray-600 hover:text-emerald-700 hover:border-emerald-300 transition" aria-label="LinkedIn">
                                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><path d="M4.98 3.5C4.98 4.88 3.86 6 2.5 6S0 4.88 0 3.5 1.12 1 2.5 1s2.48 1.12 2.48 2.5zM0 8.98h5v15H0v-15zM8 8.98h4.8v2.04h.07c.67-1.27 2.3-2.6 4.73-2.6 5.06 0 6 3.33 6 7.66v7.9h-5v-7c0-1.67-.03-3.8-2.32-3.8-2.32 0-2.68 1.82-2.68 3.68v7.12H8v-15z" /></svg>
                                </a>
                                <a href="#" className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 text-gray-600 hover:text-emerald-700 hover:border-emerald-300 transition" aria-label="GitHub">
                                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><path d="M12 .5A11.5 11.5 0 0 0 .5 12c0 5.08 3.29 9.39 7.86 10.9.58.1.8-.25.8-.56v-2c-3.2.7-3.87-1.37-3.87-1.37-.53-1.34-1.3-1.7-1.3-1.7-1.06-.73.08-.72.08-.72 1.18.08 1.81 1.22 1.81 1.22 1.04 1.8 2.73 1.28 3.4.98.1-.76.4-1.28.73-1.58-2.55-.29-5.24-1.27-5.24-5.65 0-1.25.45-2.27 1.2-3.07-.12-.29-.52-1.45.12-3.02 0 0 .98-.31 3.22 1.17a11.2 11.2 0 0 1 5.86 0c2.24-1.48 3.22-1.17 3.22-1.17.64 1.57.24 2.73.12 3.02.75.8 1.2 1.82 1.2 3.07 0 4.39-2.7 5.35-5.26 5.63.41.35.78 1.04.78 2.11v3.13c0 .31.2.67.8.56A11.5 11.5 0 0 0 23.5 12 11.5 11.5 0 0 0 12 .5z" /></svg>
                                </a>
                            </div>
                        </div>

                        {/* Quick links */}
                        <div>
                            <h4 className="text-sm font-semibold text-gray-900">Product</h4>
                            <ul className="mt-3 space-y-2 text-sm text-gray-600">
                                <li><a href="#Home" className="hover:text-emerald-700 transition">Home</a></li>
                                <li><a href="#aboutus" className="hover:text-emerald-700 transition">About</a></li>
                                <li><a href="#features" className="hover:text-emerald-700 transition">Features</a></li>
                                <li><a href="#faq" className="hover:text-emerald-700 transition">FAQ</a></li>
                                <li><a href="#contactus" className="hover:text-emerald-700 transition">Contact</a></li>
                            </ul>
                        </div>

                        {/* Newsletter */}
                        <div>
                            <h4 className="text-sm font-semibold text-gray-900">Newsletter</h4>
                            <p className="mt-3 text-sm text-gray-600">
                                Monthly updates—no spam, cancel anytime.
                            </p>
                            <form
                                onSubmit={(e) => { e.preventDefault(); alert("Subscribed!"); e.target.reset(); }}
                                className="mt-4 flex items-center gap-2"
                            >
                                <input
                                    type="email"
                                    required
                                    placeholder="you@example.com"
                                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 outline-none focus:border-emerald-400"
                                />
                                <button
                                    className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 transition"
                                >
                                    Join
                                </button>
                            </form>
                        </div>
                    </div>

                    <div className="mt-10 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-gray-200 pt-6">
                        <p className="text-xs text-gray-500">
                            © {year} ExpensifyPro. All rights reserved.
                        </p>

                        {/* Back to top */}
                        <a
                            href="#Home"
                            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-xs text-gray-600 hover:text-emerald-700 hover:border-emerald-300 transition"
                        >
                            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M10 14V6m0 0l-4 4m4-4l4 4" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            Back to top
                        </a>
                    </div>
                </div>
            </footer>




        </div>
    );

}
