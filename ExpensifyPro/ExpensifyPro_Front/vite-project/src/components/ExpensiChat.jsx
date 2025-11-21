// src/components/ExpensiChat.jsx
import React, { useEffect, useState } from "react";
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

function ExpensiChat({ variant = "floating" }) {
  const location = useLocation();
  const currentUser = getCurrentUser();
  const userId = currentUser?.id ?? null;

  // Not logged in — no Expensi at all
  if (!userId) {
    return null;
  }

  // Hide floating bubble on the dedicated Expensi page to avoid duplicates
  if (variant === "floating" && location.pathname === "/expensi") {
    return null;
  }

  const storageKey = `${CHAT_KEY_BASE}_${userId}`;

  // Load previous conversation from localStorage (so refresh doesn't reset)
  const [messages, setMessages] = useState(() => {
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

  const isFloating = variant === "floating";

  // Persist every change to messages
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(messages));
    } catch {
      // ignore
    }
  }, [messages, storageKey]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const newMessages = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const result = await askExpensi(newMessages);

      // --- CASE 1: NORMAL TEXT RESPONSE ---
      if (result.type === "text") {
        setMessages([
          ...newMessages,
          { role: "assistant", content: result.text },
        ]);
      }

      // --- CASE 2: ACTION MODE ---
      if (result.type === "action") {
        // Show action request in UI
        setMessages([
          ...newMessages,
          {
            role: "assistant",
            content: `Expensi wants to run action: ${result.action}`,
          },
        ]);

        // Run the action via backend
        const actionMessage = await runExpensiAction(
          result.action,
          result.params
        );

        // Show result of action
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: actionMessage },
        ]);
      }
    } catch (err) {
      console.error("Expensi chat error:", err);
      setMessages([
        ...newMessages,
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

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSend();
    }
  };

  // New Chat / Reset (used in full-page variant)
  const handleResetChat = () => {
    setMessages([]);
    setInput("");
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
  };

  // Floating bubble (closed state)
  if (isFloating && !isOpen) {
    return (
      <button
        className="fixed bottom-6 right-6 z-40 flex items-center gap-3 rounded-full bg-gradient-to-r from-emerald-500 to-indigo-500 px-4 py-2 shadow-lg shadow-emerald-500/40 hover:-translate-y-0.5 hover:shadow-xl transition"
        onClick={() => setIsOpen(true)}
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/30 bg-white/10">
          <span className="text-lg">💬</span>
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

  // Shared chat card (used for floating + page)
  const outerClass =
    (isFloating
      ? "fixed bottom-6 right-6 w-96 max-w-[95vw] "
      : "relative w-full max-w-3xl mx-auto ") +
    "z-40 flex flex-col rounded-3xl border border-slate-200 bg-white shadow-2xl";

  const messagesClass =
    "flex-1 overflow-y-auto p-3 space-y-2 text-sm " +
    (isFloating ? "max-h-80" : "h-[420px]");

  return (
    <div className={outerClass}>
      {/* header */}
      <div className="flex items-center justify-between gap-3 rounded-t-3xl border-b border-slate-200 bg-gradient-to-r from-emerald-50 to-indigo-50 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-600 text-white text-lg shadow-sm">
            💬
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-600">
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
            onClick={() => setIsOpen(false)}
          >
            ×
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetChat}
              className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-emerald-200 hover:text-emerald-700"
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

      {/* messages */}
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
            className={
              m.role === "user" ? "flex justify-end" : "flex justify-start"
            }
          >
            <div
              className={
                "px-3 py-2 rounded-2xl max-w-[80%] whitespace-pre-wrap " +
                (m.role === "user"
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-100 text-slate-900")
              }
            >
              {m.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="mt-1 text-xs text-slate-400">Expensi is thinking…</div>
        )}
      </div>

      {/* input */}
      <div className="flex items-center gap-2 rounded-b-3xl border-t border-slate-200 bg-slate-50/60 p-2">
        <input
          className="flex-1 rounded-2xl border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
          placeholder="Ask Expensi anything…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          className="rounded-2xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
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
