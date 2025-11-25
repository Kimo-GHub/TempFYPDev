// src/Pages/ExpensiPage.jsx
import React, { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import ExpensiChat from "../components/ExpensiChat";
import InteractiveBackground from "../components/InteractiveBackground";
import MainNavbar from "../components/MainNavbar";
import { expensiPalettes } from "../theme/expensiPalette";
import AnimatedGradientText from "../components/GradientText";

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

  const isAdmin = currentUser?.role === 1;
  const palette = isAdmin ? expensiPalettes.admin : expensiPalettes.user;
  const bgVariant = isAdmin ? "admin" : "user";

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-emerald-50/60 via-white to-white">
      {/* Cursor-following background */}
      <InteractiveBackground variant={bgVariant} />

      {/* Actual page content sits above background */}
      <div className="relative z-10">
        <MainNavbar buttonPalette={isAdmin ? undefined : palette} />

        <header className="mx-auto max-w-4xl px-6 py-12 text-center">
          <span
            className="inline-flex items-center rounded-full px-4 py-1 text-xs font-semibold uppercase tracking-wide bg-emerald-100 text-emerald-700"
            style={
              isAdmin
                ? undefined
                : {
                    backgroundColor: palette.chipBg,
                    color: palette.chipText,
                  }
            }
          >
            Conversational assistant
          </span>

          <h1 className="mt-4 text-4xl font-semibold text-slate-900">
            <AnimatedGradientText
              text="Expensi, your finance co-pilot"
              gradientColors={isAdmin ? ["#0ea568", "#0ea568", "#0ea568"] : ["#5b8def", "#7c3aed", "#5b8def"]}
              className="text-4xl sm:text-5xl font-bold"
            />
          </h1>

          <p className="mt-3 text-sm text-slate-500">
            Ask natural questions about your accounts, budgets, projects and
            automations. Expensi can also create and update items for you.
          </p>
        </header>

        <main className="mx-auto max-w-4xl px-6 pb-16">
          {/* Full-page chat card */}
          <ExpensiChat variant="page" palette={palette} />
        </main>
      </div>
    </div>
  );
}
