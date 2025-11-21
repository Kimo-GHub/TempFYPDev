// src/Pages/ExpensiPage.jsx
import React, { useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import ExpensiChat from "../components/ExpensiChat";
import InteractiveBackground from "../components/InteractiveBackground";

function getCurrentUserSafe() {
  try {
    return JSON.parse(localStorage.getItem("exp_user") || "null");
  } catch {
    return null;
  }
}

export default function ExpensiPage() {
  const navigate = useNavigate();
  const currentUser = useMemo(() => getCurrentUserSafe(), []);
  const isLoggedIn = !!currentUser?.id;

  // Redirect to login if not logged in
  useEffect(() => {
    if (!isLoggedIn) {
      navigate("/login");
    }
  }, [isLoggedIn, navigate]);

  if (!isLoggedIn) {
    // While redirecting, render nothing
    return null;
  }

  const dashboardPath =
    currentUser.role === 1 ? "/admin" : currentUser.role ? "/user" : "/";

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-emerald-50/60 via-white to-white">
      {/* Cursor-following background */}
      <InteractiveBackground />

      {/* Actual page content sits above background */}
      <div className="relative z-10">
        {/* Top bar similar to Automate.jsx */}
        <nav className="sticky top-0 z-20 border-b border-white/60 bg-white/90 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <Link to="/" className="text-lg font-semibold text-emerald-600">
              ExpensifyPro
            </Link>
            <Link
              to={dashboardPath}
              className="rounded-full border border-emerald-100 px-4 py-1.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
            >
              Go to dashboard
            </Link>
          </div>
        </nav>

        <header className="mx-auto max-w-4xl px-6 py-12 text-center">
          <span className="inline-flex items-center rounded-full bg-emerald-100 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
            Conversational assistant
          </span>
          <h1 className="mt-4 text-4xl font-semibold text-slate-900">
            Expensi, your finance co-pilot
          </h1>
          <p className="mt-3 text-sm text-slate-500">
            Ask natural questions about your accounts, budgets, projects and
            automations. Expensi can also create and update items for you.
          </p>
        </header>

        <main className="mx-auto max-w-4xl px-6 pb-16">
          {/* Full-page chat card */}
          <ExpensiChat variant="page" />
        </main>
      </div>
    </div>
  );
}
