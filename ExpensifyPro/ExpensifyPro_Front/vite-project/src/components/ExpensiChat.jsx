// src/components/ExpensiChat.jsx
import React, { useEffect, useState, useRef } from "react";
import { useLocation } from "react-router-dom";
import { askExpensi } from "../utils/expensiApi";
import { runExpensiAction } from "../utils/expensiActions";

const CHAT_KEY_BASE = "expensi_chat_history_v1";

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem("exp_user") || "null");
  } catch {
    return null;
  }
}

// --- Small helper just for nicer action copy in the UI ---
function formatActionPreview(action, params = {}) {
  const user = params.user ?? params.user_id;
  const account = params.account ?? params.account_id;
  const currency = (params.currency || "USD").toUpperCase();
  const amount =
    params.amount != null && params.amount !== ""
      ? `${params.amount} ${currency}`
      : null;

  switch (action) {
    case "create_transaction": {
      const type = params.type || "transaction";
      const desc = params.description ? ` with description "${params.description}"` : "";
      return `Expensi is creating an ${type} of ${amount || "an amount"} on account #${account ?? "?"} for user ${user ?? "?"}${desc}.`;
    }

    case "update_transaction": {
      const id = params.id ?? params.transaction_id ?? "?";
      return `Expensi is updating transaction #${id} with the new details you provided.`;
    }

    case "archive_transaction": {
      const id = params.id ?? params.transaction_id ?? "?";
      return `Expensi is archiving transaction #${id}.`;
    }

    case "unarchive_transaction": {
      const id = params.id ?? params.transaction_id ?? "?";
      return `Expensi is restoring transaction #${id} from archive.`;
    }

    case "create_project": {
      const name = params.name || "a new project";
      return `Expensi is creating project "${name}" for user ${user ?? "?"}.`;
    }

    case "create_account": {
      const name = params.name || "a new account";
      const type = params.type || "account";
      return `Expensi is creating a ${type} called "${name}" for user ${user ?? "?"}.`;
    }

    case "update_account": {
      const id = params.id ?? params.account_id ?? "?";
      return `Expensi is updating account #${id} with the latest changes.`;
    }

    case "create_budget": {
      const name = params.name || "a new budget";
      return `Expensi is creating budget "${name}"${amount ? ` with amount ${amount}` : ""} for user ${user ?? "?"}.`;
    }

    case "update_budget": {
      const id = params.budget_id ?? params.id ?? "?";
      return `Expensi is updating budget #${id}.`;
    }

    case "create_automation": {
      const type = params.type || "expense";
      return `Expensi is setting up a recurring ${type}${amount ? ` of ${amount}` : ""} on account #${account ?? "?"}.`;
    }

    case "update_automation": {
      const id = params.automation_id ?? params.transaction_id ?? params.id ?? "?";
      return `Expensi is updating automation #${id} with the new schedule.`;
    }

    case "delete_automation": {
      const id = params.automation_id ?? params.transaction_id ?? params.id ?? "?";
      return `Expensi is deleting automation #${id}.`;
    }

    case "list_accounts":
      return `Expensi is fetching your accounts list.`;

    case "list_budgets":
      return `Expensi is fetching your budgets with the requested filter.`;

    case "list_transactions":
      return `Expensi is fetching recent transactions for your user.`;

    case "create_category": {
      const name = params.name || "a new category";
      const kind = params.kind || "category";
      return `Expensi is creating a ${kind} category "${name}" for user ${user ?? "?"}.`;
    }

    default:
      return `Expensi wants to run action: ${action}`;
  }
}

function ExpensiChat({ variant = "floating", palette, autoMode = null }) {
  const location = useLocation();
  const currentUser = getCurrentUser();
  const userId = currentUser?.id ?? null;
  const storageKey = userId ? `${CHAT_KEY_BASE}_${userId}` : null;

  const [animState, setAnimState] = useState("closed");
  const [bubbleDisabledUntil, setBubbleDisabledUntil] = useState(0);

  const [messages, setMessages] = useState(() => {
    if (!storageKey) return [];
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(variant === "page");
  const [autoHandled, setAutoHandled] = useState(false); // prevent double auto-run

  const isFloating = variant === "floating";
  const colors = palette || null;
  const isClosing = animState === "closing";
  const isOpening = animState === "opening";
  const showFloatingCard = !isFloating || isOpen || isOpening || isClosing;
  const showBubble = isFloating && animState === "closed";

  const autoRanRef = useRef(false);

  // Persist chat history
  useEffect(() => {
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(messages));
    } catch {
      // ignore
    }
  }, [messages, storageKey]);

  // Helper: call Expensi API and append replies
  const callExpensi = async (newMessages) => {
    try {
      const result = await askExpensi(newMessages);

      if (result.type === "text") {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: result.text },
        ]);
      }

      if (result.type === "action") {
        // nicer preview line instead of raw "wants to run action"
        const preview = formatActionPreview(result.action, result.params);

        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: preview,
          },
        ]);

        const actionMessage = await runExpensiAction(
          result.action,
          result.params
        );

        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: actionMessage },
        ]);
      }
    } catch (err) {
      console.error("Expensi chat error:", err);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Sorry, I couldn't reach Expensi right now. Please try again in a moment.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // AUTO MODE: triggered when coming from Forecasts with "Recommended actions"
  useEffect(() => {
    if (!userId) return;
    if (variant !== "page") return;
    if (!autoMode) return;
    if (autoHandled) return;
    if (autoRanRef.current) return;
    autoRanRef.current = true;

    // Mark as handled so effect doesn't re-run
    setAutoHandled(true);

    let saved = null;
    try {
      const raw = localStorage.getItem("expensi_last_forecast");
      if (raw) saved = JSON.parse(raw);
    } catch {
      // ignore parse error
    }

    const summary = saved?.summary || null;
    const target = saved?.target || null;
    const horizon = saved?.horizon || null;

    const parts = [];
    parts.push(
      "You are Expensi, the finance assistant inside ExpensifyPro. We just ran a forecasting analysis in the Admin > Forecasts tab."
    );
    if (target) {
      parts.push(
        `The forecast target was: **${target}** (net / income / expense).`
      );
    }
    if (horizon) {
      parts.push(`The horizon was about **${horizon} months** into the future.`);
    }
    if (summary) {
      parts.push(
        "Here is the narrative explanation of the forecast that the user just read:"
      );
      parts.push(summary);
    } else {
      parts.push(
        "The user has just seen a forecast chart (history line, forecast line, and confidence interval), but we couldn't load the full summary text from storage."
      );
    }
    parts.push(
      "Based only on this forecast and the explanation above, give **3–6 specific, practical recommended actions** for the organization. " +
        "Group them under short headings like 'Check data quality', 'Budget adjustments', 'Risk management', 'Growth opportunities', etc. " +
        "Make the advice concrete (what to review, what thresholds to watch, what reports to run) and avoid generic textbook tips."
    );

    const autoPrompt = parts.join("\n\n");

    // Use this only for the API call, don't show it in the UI
    const convoForApi = [
      ...messages,
      { role: "user", content: autoPrompt },
    ];

    setLoading(true);
    callExpensi(convoForApi);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoMode, variant, userId, autoHandled, messages]);

  // ---- Early exits (AFTER hooks) ----
  if (!userId) return null;
  if (isFloating && location.pathname === "/expensi") return null;

  // ----- Floating open/close -----
  const handleOpenFloating = () => {
    if (Date.now() < bubbleDisabledUntil) return;
    setIsOpen(true);
    setAnimState("opening");
    requestAnimationFrame(() => setAnimState("open"));
  };

  const handleCloseFloating = () => {
    // Animations disabled, close immediately
    setAnimState("closed");
    setIsOpen(false);
    setBubbleDisabledUntil(Date.now() + 200);
  };

  // ----- Manual send -----
  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const newMessages = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    await callExpensi(newMessages);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSend();
    }
  };

  const handleResetChat = () => {
    setMessages([]);
    setInput("");
    setAutoHandled(false); // allow future auto-modes again
    try {
      if (storageKey) localStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
  };

  // ---- Floating bubble render ----
  if (showBubble) {
    return (
      <button
        className="fixed bottom-6 right-6 z-40 flex items-center gap-3 rounded-full bg-gradient-to-r from-emerald-500 to-indigo-500 px-4 py-2 shadow-lg shadow-emerald-500/40 hover:-translate-y-0.5 hover:shadow-xl transition"
        onClick={handleOpenFloating}
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/30 bg-white/10">
          <span className="text-lg">
            <svg
              viewBox="0 0 24 24"
              className="h-6 w-6 text-white"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M17.1153 15.3582C16.8446 15.6642 16.5606 15.9665 16.2635 16.2635C11.9678 20.5593 6.58585 22.1422 4.2427 19.7991C2.6363 18.1926 2.8752 15.158 4.56847 12.0242M6.88967 8.72526C7.17138 8.40495 7.46772 8.08875 7.77824 7.77824C12.074 3.48247 17.4559 1.89956 19.7991 4.2427C21.4066 5.85021 21.1662 8.88795 19.4698 12.024M16.2635 7.77824C20.5593 12.074 22.1422 17.4559 19.7991 19.7991C17.4559 22.1422 12.074 20.5593 7.77824 16.2635C3.48247 11.9678 1.89956 6.58585 4.2427 4.2427C6.58585 1.89956 11.9678 3.48247 16.2635 7.77824ZM13.0001 12C13.0001 12.5523 12.5523 13 12.0001 13C11.4478 13 11.0001 12.5523 11.0001 12C11.0001 11.4477 11.4478 11 12.0001 11C12.5523 11 13.0001 11.4477 13.0001 12Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </div>
        <div className="hidden sm:flex flex-col items-start">
          <span className="text-[11px] uppercase tracking-wide text-emerald-100">
            Ask Expensi
          </span>
          <span className="text-sm font-semibold text-white">
            Finance assistant
          </span>
        </div>
      </button>
    );
  }

  const outerClass =
    (isFloating
      ? "fixed bottom-6 right-6 w-96 max-w-[95vw] "
      : "relative w-full max-w-3xl mx-auto ") +
    "z-40 flex flex-col rounded-3xl border border-slate-200 bg-white shadow-2xl";

  // Animation classes temporarily disabled
  const animationClass = "";

  const messagesClass =
    "flex-1 overflow-y-auto p-3 space-y-2 text-sm " +
    (isFloating ? "max-h-80" : "h-[420px]");

  return (
    <div
      className={`${outerClass} ${animationClass}`}
      onAnimationEnd={() => {
        if (isFloating && animState === "closing") {
          setIsOpen(false);
          setAnimState("closed");
        }
        if (isFloating && animState === "opening") {
          setAnimState("open");
        }
      }}
    >
      <div
        className="flex items-center justify-between gap-3 rounded-t-3xl border-b border-slate-200 bg-gradient-to-r from-emerald-50 to-indigo-50 px-4 py-3"
        style={
          colors
            ? {
                background: `linear-gradient(90deg, ${colors.primarySoft}, #f8fafc)`,
              }
            : undefined
        }
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-2xl text-white text-lg shadow-sm bg-emerald-600"
            style={{ backgroundColor: colors ? colors.iconBg : undefined }}
          >
            <svg
              viewBox="0 0 24 24"
              className="h-6 w-6 text-white"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M17.1153 15.3582C16.8446 15.6642 16.5606 15.9665 16.2635 16.2635C11.9678 20.5593 6.58585 22.1422 4.2427 19.7991C2.6363 18.1926 2.8752 15.158 4.56847 12.0242M6.88967 8.72526C7.17138 8.40495 7.46772 8.08875 7.77824 7.77824C12.074 3.48247 17.4559 1.89956 19.7991 4.2427C21.4066 5.85021 21.1662 8.88795 19.4698 12.024M16.2635 7.77824C20.5593 12.074 22.1422 17.4559 19.7991 19.7991C17.4559 22.1422 12.074 20.5593 7.77824 16.2635C3.48247 11.9678 1.89956 6.58585 4.2427 4.2427C6.58585 1.89956 11.9678 3.48247 16.2635 7.77824ZM13.0001 12C13.0001 12.5523 12.5523 13 12.0001 13C11.4478 13 11.0001 12.5523 11.0001 12C11.0001 11.4477 11.4478 11 12.0001 11C12.5523 11 13.0001 11.4477 13.0001 12Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="flex flex-col">
            <span
              className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-600"
              style={{ color: colors ? colors.primary : undefined }}
            >
              Expensi
            </span>
            <span className="text-[11px] text-slate-500">
              SPET finance assistant
            </span>
          </div>
        </div>

        {isFloating ? (
          <button
            className="rounded-full p-1.5 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            onClick={handleCloseFloating}
          >
            ×
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetChat}
              className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-emerald-200 hover:text-emerald-700"
              style={
                colors
                  ? {
                      borderColor: colors.primary,
                      color: colors.primary,
                    }
                  : undefined
              }
            >
              New chat
            </button>
            <button
              type="button"
              onClick={handleResetChat}
              className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-100"
            >
              Reset history
            </button>
          </div>
        )}
      </div>

      <div className={messagesClass}>
        {messages.length === 0 && !loading && (
          <div className="text-xs text-slate-400">
            Ask me about accounts, budgets, projects, automations, or how to
            use ExpensifyPro.
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
          >
            <div
              className={
                "px-3 py-2 rounded-2xl max-w-[80%] whitespace-pre-wrap " +
                (m.role === "user"
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-100 text-slate-900")
              }
              style={
                m.role === "user" && colors
                  ? { backgroundColor: colors.primary }
                  : undefined
              }
            >
              {m.content}
            </div>
          </div>
        ))}

        {loading && (
  <div className="expensi-reasoning-enter mb-2 rounded-2xl bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-500">
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-1">
        <span className="expensi-gradient-text expensi-dots">
        <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
        Expensi is thinking about your request
      </span>
      </span>
      {/* optional chevron for collapse later */}
    </div>
    <ul className="mt-1 list-disc pl-5 space-y-0.5">
      <li className="expensi-step">Reviewing your message and intent</li>
      <li className="expensi-step">Preparing a safe action or explanation</li>
    </ul>
  </div>
)}

      </div>

      <div className="flex items-center gap-2 rounded-b-3xl border-t border-slate-200 bg-slate-50/60 p-2">
        <input
          className="flex-1 rounded-2xl border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
          style={
            colors
              ? {
                  borderColor: colors.primary,
                  boxShadow: `0 0 0 2px ${colors.primarySoft}`,
                }
              : undefined
          }
          placeholder="Ask Expensi anything..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          className="rounded-2xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
          style={{ backgroundColor: colors ? colors.buttonBg : undefined }}
          onClick={handleSend}
          disabled={loading || !input.trim()}
        >
          Send
        </button>
      </div>
    </div>
  );
}

export default ExpensiChat;
