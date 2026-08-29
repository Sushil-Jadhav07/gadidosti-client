import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCheck, ArrowRight } from "lucide-react";
import { api, getToken } from "../services/api";
import { routeForNotification } from "../lib/notificationRoutes";
import { CATEGORY_TABS, COLOR_CLASSES, categoryFor, metaFor } from "../lib/notificationMeta";

function timeAgo(dateStr) {
  const diffSec = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 172800) return "Yesterday";
  return `${Math.floor(diffSec / 86400)}d ago`;
}

// Only "operations" types get a jump-to action button — financial/system ones (payment
// received, KYC, disputes) are informational after the fact, nothing to actually go act on.
// routeForNotification still has to resolve a real target too (no linked booking = no button).
const ACTION_LABEL = { booking: "View Booking", incident: "Track Shipment", chat: "Open Chat" };

// Replaces the old Profile.jsx notification BottomSheet with a full page — same idea as
// gadidosti-broker-driver's own dedicated NotificationsPage.jsx, adapted to this app's routes.
export default function Notifications() {
  const navigate = useNavigate();
  const token = getToken();

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [tab, setTab] = useState("all");

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await api.get("/api/users/notifications?limit=100", token);
      if (!res?.success) throw new Error(res?.message);
      setNotifications(res.data?.notifications || []);
      setUnreadCount(res.data?.unread_count || 0);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const markRead = async (id) => {
    setNotifications((list) => list.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
    try { await api.patch(`/api/users/notifications/${id}/read`, {}, token); } catch { /* stays optimistically read either way */ }
  };

  const markAllRead = async () => {
    setNotifications((list) => list.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
    try { await api.patch("/api/users/notifications/read-all", {}, token); } catch { /* stays optimistically read either way */ }
  };

  const handleAction = (n) => {
    if (!n.is_read) markRead(n.id);
    const target = routeForNotification({ type: n.type, meta: n.meta || {} });
    if (target) navigate(target);
  };

  const filtered = tab === "all" ? notifications : notifications.filter((n) => categoryFor(n.type) === tab);

  return (
    <div className="p-4 md:p-8 animate-page-enter max-w-7xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div className="flex items-start gap-3 min-w-0">
          <button
            onClick={() => navigate("/profile")}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors flex-shrink-0 mt-0.5"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="font-poppins font-bold text-2xl md:text-[28px] text-neutral-800">Notifications</h1>
            <p className="text-sm text-neutral-400 mt-0.5">Manage your alerts and system updates.</p>
          </div>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-neutral-200 rounded-lg text-xs font-semibold text-neutral-600 hover:bg-neutral-50 transition-colors flex-shrink-0"
          >
            <CheckCheck className="w-3.5 h-3.5" /> Mark all as read
          </button>
        )}
      </div>

      <div className="flex items-center gap-5 border-b border-neutral-100 mb-5">
        {CATEGORY_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`pb-2.5 text-sm font-semibold border-b-2 transition-colors ${
              tab === t.id ? "border-primary text-primary" : "border-transparent text-neutral-400 hover:text-neutral-600"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 skeleton-shimmer animate-shimmer rounded-xl" />)}
        </div>
      ) : error ? (
        <div className="bg-white rounded-xl shadow-card p-8 text-center">
          <p className="text-sm text-neutral-400 mb-3">Couldn't load your notifications</p>
          <button onClick={load} className="text-sm font-semibold text-primary hover:underline">Retry</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl shadow-card p-10 text-center">
          <p className="text-sm text-neutral-400">No notifications here yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((n) => {
            const { Icon, color } = metaFor(n.type);
            const cls = COLOR_CLASSES[color] || COLOR_CLASSES.slate;
            const target = routeForNotification({ type: n.type, meta: n.meta || {} });
            const actionLabel = target ? ACTION_LABEL[n.type] : null;
            return (
              <div
                key={n.id}
                onClick={() => !n.is_read && markRead(n.id)}
                className={`bg-white rounded-xl shadow-card border-l-4 p-4 flex gap-3 ${n.is_read ? "border-l-transparent" : cls.border}`}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${cls.icon}`}>
                  <Icon className="w-[18px] h-[18px]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-bold text-neutral-800">{n.title}</p>
                    <span className="text-[11px] text-neutral-300 flex-shrink-0 whitespace-nowrap">{timeAgo(n.created_at)}</span>
                  </div>
                  <p className="text-sm text-neutral-500 mt-0.5">{n.message}</p>
                  {actionLabel && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleAction(n); }}
                      className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-primary-dark transition-colors"
                    >
                      {actionLabel} <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
