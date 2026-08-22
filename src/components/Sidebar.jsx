import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Home, PlusCircle, ClipboardList, MapPin, User, LogOut, Bell, MessageCircle, CheckCheck, PlayCircle, HelpCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useNotifications, timeAgo } from "../hooks/useNotifications";
import { api, getToken } from "../services/api";

const NAV_ITEMS = [
  { path: "/", label: "Dashboard", Icon: Home },
  { path: "/book", label: "Book a Truck", Icon: PlusCircle },
  { path: "/bookings", label: "My Bookings", Icon: ClipboardList },
  { path: "/track", label: "Track Shipment", Icon: MapPin },
  { path: "/profile", label: "Profile", Icon: User },
];

const CHAT_POLL_MS = 20000;

// A normal, always-full-width, flush sidebar — no floating margins/rounded corners, no
// hover-to-expand rail. Desktop is permanently visible at w-64; mobile keeps the same
// full-width slide-in drawer driven by isOpen/onClose as before.
export default function Sidebar({ isOpen, onClose }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const currentPath = location.pathname;

  // Real unread counts — moved here from TopBar.jsx's NotificationBell/ChatBell (removed there).
  const { notifications, unreadCount, loading: notifLoading, markRead, markAllRead } = useNotifications({ limit: 10 });
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef(null);
  const [chatUnread, setChatUnread] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const fetchUnread = async () => {
      const token = getToken();
      if (!token) return;
      try {
        const res = await api.get("/api/chat/unread-count", token);
        if (!cancelled && res?.success) setChatUnread(res.data?.unreadCount || 0);
      } catch { /* silent — next poll retries */ }
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, CHAT_POLL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : (user?.initials || "RK");
  const roleLabel = user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : "Client";

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 w-64 flex flex-col bg-secondary transition-transform duration-300
        ${isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-4 border-b border-white/10 flex-shrink-0">
        <img src="/gadidost-logo.png" alt="GadiDost" className="h-8 w-auto flex-shrink-0" />
        <p className="text-[11px] text-white/40 truncate">Client Portal</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-5 space-y-0.5 overflow-y-auto">
        <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest px-3 mb-3">Menu</p>
        {NAV_ITEMS.map(({ path, label, Icon }) => {
          const isActive = currentPath === path;
          return (
            <button
              key={path}
              onClick={() => { navigate(path); onClose?.(); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-150 group ${
                isActive
                  ? "bg-primary text-white shadow-md shadow-primary/20"
                  : "text-white/50 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon
                className={`flex-shrink-0 transition-colors ${
                  isActive ? "text-white" : "text-white/50 group-hover:text-white"
                }`}
                strokeWidth={isActive ? 2.5 : 1.8}
                size={18}
              />
              <span className="text-sm font-medium">{label}</span>
              {isActive && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white/50 flex-shrink-0" />
              )}
            </button>
          );
        })}

        {/* Notification + Chat — real unread counts, moved here from TopBar.jsx. */}
        <div className="pt-3 space-y-0.5 relative" ref={notifRef}>
          <button
            onClick={() => setNotifOpen((v) => !v)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-150 text-white/50 hover:bg-white/10 hover:text-white"
          >
            <Bell size={18} strokeWidth={1.8} className="flex-shrink-0" />
            <span className="text-sm font-medium">Notification</span>
            {unreadCount > 0 && (
              <span className="ml-auto min-w-[20px] h-5 px-1.5 flex items-center justify-center bg-amber-400 text-neutral-900 text-[11px] font-bold rounded-full">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute left-full bottom-0 ml-2 w-80 bg-white border border-neutral-100 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.25)] z-50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100">
                <p className="text-sm font-bold text-neutral-800">Notifications</p>
                {unreadCount > 0 && (
                  <button onClick={markAllRead} className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
                    <CheckCheck size={13} /> Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto divide-y divide-neutral-50">
                {notifLoading ? (
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
          )}

          {/* Chat is per-booking (no standalone inbox screen) — same as ChatBell used to,
              this just goes straight to My Bookings instead of opening a preview list. */}
          <button
            onClick={() => { setNotifOpen(false); navigate("/bookings"); onClose?.(); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-150 text-white/50 hover:bg-white/10 hover:text-white"
          >
            <MessageCircle size={18} strokeWidth={1.8} className="flex-shrink-0" />
            <span className="text-sm font-medium">Chat</span>
            {chatUnread > 0 && (
              <span className="ml-auto min-w-[20px] h-5 px-1.5 flex items-center justify-center bg-amber-400 text-neutral-900 text-[11px] font-bold rounded-full">
                {chatUnread > 9 ? "9+" : chatUnread}
              </span>
            )}
          </button>
        </div>

        {/* Tutorial videos / Help center — plain links, no real destination yet. */}
        <div className="pt-3 space-y-0.5">
          <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-150 text-white/50 hover:bg-white/10 hover:text-white">
            <PlayCircle size={18} strokeWidth={1.8} className="flex-shrink-0" />
            <span className="text-sm font-medium">Tutorial videos</span>
          </button>
          <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-150 text-white/50 hover:bg-white/10 hover:text-white">
            <HelpCircle size={18} strokeWidth={1.8} className="flex-shrink-0" />
            <span className="text-sm font-medium">Help center</span>
          </button>
        </div>
      </nav>

      {/* User + Logout */}
      <div className="px-3 pb-4 border-t border-white/10 pt-3 flex-shrink-0 space-y-0.5">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg">
          <div className="w-8 h-8 rounded-full bg-primary/25 border border-primary/40 flex items-center justify-center flex-shrink-0">
            <span className="text-[11px] font-bold text-white">{initials}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white truncate leading-tight">
              {user?.name || "Rajesh Kumar"}
            </p>
            <p className="text-[10px] text-white/40 truncate">{roleLabel}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/50 hover:bg-red-500/10 hover:text-red-400 transition-all duration-150"
        >
          <LogOut size={16} className="flex-shrink-0" />
          <span className="text-sm font-medium">Logout</span>
        </button>
      </div>
    </aside>
  );
}
