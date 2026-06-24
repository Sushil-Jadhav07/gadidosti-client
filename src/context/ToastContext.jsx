import React, { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle, XCircle, Info } from "lucide-react";

const ToastContext = createContext(null);

let toastIdCounter = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback(
    (type, message, title) => {
      const id = ++toastIdCounter;
      setToasts((prev) => [...prev, { id, type, message, title }]);
      setTimeout(() => removeToast(id), 3000);
    },
    [removeToast]
  );

  const success = useCallback((message, title) => pushToast("success", message, title), [pushToast]);
  const error = useCallback((message, title) => pushToast("error", message, title), [pushToast]);
  const info = useCallback((message, title) => pushToast("info", message, title), [pushToast]);

  return (
    <ToastContext.Provider value={{ success, error, info }}>
      {children}
      {/* Toast container */}
      <div className="fixed top-4 left-0 right-0 z-[70] flex flex-col items-center gap-2 pointer-events-none px-4">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onRemove={() => removeToast(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onRemove }) {
  const icons = {
    success: <CheckCircle className="w-5 h-5 text-success flex-shrink-0" />,
    error: <XCircle className="w-5 h-5 text-danger flex-shrink-0" />,
    info: <Info className="w-5 h-5 text-primary flex-shrink-0" />,
  };

  return (
    <div
      className="pointer-events-auto w-full max-w-[396px] bg-white rounded-xl shadow-dropdown px-4 py-3.5 flex items-start gap-3 animate-toast-in"
      onClick={onRemove}
    >
      {icons[toast.type]}
      <div className="flex-1 min-w-0">
        {toast.title && <p className="text-sm font-medium text-neutral-800">{toast.title}</p>}
        <p className={`text-sm ${toast.title ? "text-neutral-400" : "text-neutral-700"}`}>{toast.message}</p>
      </div>
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
