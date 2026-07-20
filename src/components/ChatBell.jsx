import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import { api, getToken } from "../services/api";

const POLL_INTERVAL_MS = 20000;

// Unread chat badge for the header — same visual pattern as NotificationBell, but clicking it
// goes to My Bookings since chat is per-booking and there's no standalone inbox screen.
export default function ChatBell() {
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const fetchUnread = async () => {
      const token = getToken();
      if (!token) return;
      try {
        const res = await api.get("/api/chat/unread-count", token);
        if (!cancelled && res?.success) setUnreadCount(res.data?.unreadCount || 0);
      } catch { /* silent — next poll retries */ }
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, POLL_INTERVAL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  return (
    <button
      onClick={() => navigate("/bookings")}
      className="relative p-2 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-50 rounded-lg transition-colors"
      title="Chat"
    >
      <MessageCircle className="w-5 h-5" />
      {unreadCount > 0 && (
        <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center bg-danger text-white text-[10px] font-bold rounded-full ring-2 ring-white">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </button>
  );
}
