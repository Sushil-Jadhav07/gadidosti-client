import React, { useState, useRef, useEffect } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { useNotifications, timeAgo } from "../hooks/useNotifications";

export default function NotificationBell() {
  const { notifications, unreadCount, loading, markRead, markAllRead } = useNotifications({ limit: 10 });
  const [open, setOpen] = useState(false);
  const dropRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={dropRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-50 rounded-lg transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center bg-danger text-white text-[10px] font-bold rounded-full ring-2 ring-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-12 w-80 bg-white border border-neutral-100 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] z-50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100">
              <p className="text-sm font-bold text-neutral-800">Notifications</p>
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
                  <CheckCheck size={13} /> Mark all read
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto divide-y divide-neutral-50">
              {loading ? (
                <div className="py-8 flex justify-center">
                  <div className="w-5 h-5 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                </div>
              ) : notifications.length === 0 ? (
                <p className="text-sm text-neutral-400 text-center py-8">No notifications yet</p>
              ) : (
                notifications.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => !n.is_read && markRead(n.id)}
                    className={`w-full text-left px-4 py-3 hover:bg-neutral-50 transition-colors flex gap-2 ${!n.is_read ? "bg-primary-50" : ""}`}
                  >
                    <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${!n.is_read ? "bg-primary" : "bg-transparent"}`} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-neutral-800 truncate">{n.title}</p>
                      <p className="text-xs text-neutral-500 mt-0.5 line-clamp-2">{n.message}</p>
                      <p className="text-[11px] text-neutral-300 mt-1">{timeAgo(n.created_at)}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
