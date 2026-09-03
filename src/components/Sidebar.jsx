import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Home, PlusCircle, ClipboardList, MapPin, User, LogOut, Bell, MessageCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useNotifications } from "../hooks/useNotifications";
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

  // Real unread count — moved here from TopBar.jsx's NotificationBell (removed there). The
  // button just navigates straight to the full Notifications page now (see below) rather than
  // opening its own preview dropdown, so nothing else from that hook is needed here. limit: 1
  // since only unread_count (part of every response regardless of limit) is actually used.
  const { unreadCount } = useNotifications({ limit: 1 });
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
      {/* Logo — the wordmark itself is dark text, unreadable straight on this dark sidebar
          (only the blue/green "GD" icon would show); a small white chip behind it keeps the
          real logo colors intact instead of forcing the whole thing white via a filter. */}
      <div className="flex items-center gap-2 px-4 py-4 border-b border-white/10 flex-shrink-0">
        <div className="bg-white rounded-md px-2 py-1 flex-shrink-0">
          <img src="/gadidost-logo.png" alt="GadiDost" className="h-6 w-auto" />
        </div>
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

        {/* Notification — real unread count, goes straight to the full Notifications page
            (see pages/Notifications.jsx) rather than a preview dropdown; there used to be one
            here, but keeping both a live preview list AND the full page was redundant, and
            navigating away from the dropdown without it fully unmounting first briefly showed
            both stacked on top of each other. */}
        <div className="pt-3 space-y-0.5">
          <button
            onClick={() => { navigate("/notifications"); onClose?.(); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-150 text-white/50 hover:bg-white/10 hover:text-white"
          >
            <Bell size={18} strokeWidth={1.8} className="flex-shrink-0" />
            <span className="text-sm font-medium">Notification</span>
            {unreadCount > 0 && (
              <span className="ml-auto min-w-[20px] h-5 px-1.5 flex items-center justify-center bg-primary text-neutral-900 text-[11px] font-bold rounded-full">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {/* Goes to the chat list (see pages/Chats.jsx) — every thread this client's on, not
              just one booking. */}
          <button
            onClick={() => { navigate("/chats"); onClose?.(); }}
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
