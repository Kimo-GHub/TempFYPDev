import { createContext, useCallback, useContext, useMemo, useState } from "react";

const NotificationContext = createContext(null);
const DEFAULT_TIMEOUT = 4500;

export const NotificationProvider = ({ children }) => {
  const [queue, setQueue] = useState([]);

  const removeById = useCallback((id) => {
    setQueue((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const notify = useCallback(({ message, type = "info", duration = DEFAULT_TIMEOUT, action } = {}) => {
    if (!message) return () => {};
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setQueue((prev) => [
      ...prev,
      {
        id,
        message,
        type,
        duration,
        action: action?.label ? action : null,
      },
    ]);
    if (duration !== Infinity) {
      setTimeout(() => removeById(id), duration);
    }
    return () => removeById(id);
  }, [removeById]);

  const contextValue = useMemo(() => ({ notify }), [notify]);

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
      <ToastContainer items={queue} onDismiss={removeById} />
    </NotificationContext.Provider>
  );
};

const typeStyles = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  error: "border-red-200 bg-red-50 text-red-700",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  info: "border-slate-200 bg-white text-slate-700",
};

const ToastContainer = ({ items, onDismiss }) => (
  <div className="pointer-events-none fixed inset-0 z-[2000] flex flex-col items-end gap-2 px-4 py-6 sm:p-6">
    {items.map((item) => (
      <div
        key={item.id}
        className={`pointer-events-auto w-full max-w-sm rounded-2xl border shadow-lg transition ${typeStyles[item.type] || typeStyles.info}`}
      >
        <div className="flex items-start gap-3 p-4">
          <div className="flex-1 text-sm">{item.message}</div>
          <button
            type="button"
            onClick={() => onDismiss(item.id)}
            className="text-xs font-semibold text-slate-400 hover:text-slate-600"
          >
            ✕
          </button>
        </div>
        {item.action && (
          <button
            type="button"
            onClick={() => {
              onDismiss(item.id);
              item.action.onClick?.();
            }}
            className="w-full border-t border-white/60 px-4 py-2 text-left text-xs font-semibold text-indigo-600 hover:bg-white/70"
          >
            {item.action.label}
          </button>
        )}
      </div>
    ))}
  </div>
);

export const useNotifications = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationProvider");
  return ctx.notify;
};
