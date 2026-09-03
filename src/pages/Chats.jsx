import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessageCircle, AlertTriangle, RefreshCw } from "lucide-react";
import { api, getToken } from "../services/api";

// "2m" / "3h" / "Yesterday" / "5d" / "12 Mar" — no seconds-level precision needed here, this is
// just a glance at how stale a thread is, same spirit as WhatsApp/Telegram list timestamps.
const formatRelativeTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diffMin < 1) return "now";
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return "Yesterday";
  if (diffDay < 7) return `${diffDay}d`;
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
};

// Driver takes priority once assigned; falls back to the broker while only they're on the
// booking, then "Support" for a thread that's still just the client and the bot (booking not
// yet assigned to anyone).
const otherPartyName = (thread) => thread.driverName || thread.brokerName || "Support";

const initialsOf = (name) =>
  name.split(" ").filter(Boolean).map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "?";

export default function Chats() {
  const navigate = useNavigate();
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const token = getToken();

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await api.get("/api/chat/threads", token);
      if (!res?.success) throw new Error(res?.message || "Failed to load chats");
      setThreads(res.data?.threads || []);
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

  return (
    <div className="p-4 md:p-8 animate-page-enter">
      <div className="mb-6">
        <h1 className="font-poppins font-bold text-2xl text-neutral-800">Chats</h1>
        <p className="text-sm text-neutral-400 mt-0.5">Message your driver or broker about a shipment.</p>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl shadow-card flex flex-col items-center justify-center py-24">
          <span className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin mb-3" />
          <p className="text-sm text-neutral-400">Loading your chats...</p>
        </div>
      ) : error ? (
        <div className="bg-white rounded-2xl shadow-card flex flex-col items-center justify-center py-24">
          <AlertTriangle className="w-12 h-12 text-danger/40 mb-3" />
          <h3 className="font-poppins font-semibold text-lg text-neutral-500 mb-1">Couldn't load chats</h3>
          <p className="text-sm text-neutral-400 mb-4">Something went wrong. Please try again.</p>
          <button
            onClick={load}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
        </div>
      ) : threads.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-card flex flex-col items-center justify-center py-24">
          <MessageCircle className="w-14 h-14 text-neutral-200 mb-4" />
          <h3 className="font-poppins font-semibold text-lg text-neutral-500 mb-1">No chats yet</h3>
          <p className="text-sm text-neutral-400">Start a booking to chat with your driver or broker</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-card divide-y divide-neutral-50 overflow-hidden">
          {threads.map((t) => {
            const name = otherPartyName(t);
            return (
              <button
                key={t.threadId}
                onClick={() => navigate(`/chats/${t.bookingId}`)}
                className="w-full flex items-center gap-3 px-4 md:px-5 py-4 text-left hover:bg-neutral-50 transition-colors"
              >
                <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-primary">{initialsOf(name)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-neutral-800 truncate">{name}</p>
                    <span className="text-[10px] text-neutral-400 font-mono flex-shrink-0">{t.bookingNumber}</span>
                    {t.isLocked && (
                      <span className="text-[10px] font-medium text-neutral-400 bg-neutral-100 px-1.5 py-0.5 rounded-full flex-shrink-0">
                        Closed
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-neutral-400 truncate mt-0.5">{t.lastMessage || "No messages yet"}</p>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className="text-[11px] text-neutral-400">{formatRelativeTime(t.lastMessageAt)}</span>
                  {t.unreadCount > 0 && (
                    <span className="min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-primary text-white text-[10px] font-bold rounded-full">
                      {t.unreadCount > 9 ? "9+" : t.unreadCount}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
