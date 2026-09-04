import { useState } from "react";
import { useLocation } from "react-router-dom";
import { MessageCircle, X, ArrowLeft } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useChatUnread } from "../context/ChatUnreadContext";
import { useChatThreads } from "../hooks/useChatThreads";
import ChatThreadList, { otherPartyName } from "./ChatThreadList";
import ChatWindow from "./ChatWindow";

// Pages that already have their own direct, single-trip chat button (TrackShipment's header
// icon, BookingDetail's header icon) — the generic multi-thread launcher would just be a second,
// more confusing way to reach the exact same chat on these, so it's hidden there entirely.
const HIDE_ON = [/^\/track$/, /^\/bookings\//];

// Persistent floating widget mounted once at the app root (alongside ChatNotificationListener)
// so any thread is a couple of taps away from wherever the user is — /chats and /chats/:id stay
// exactly as they are, this is purely an additive shortcut on top of them.
export default function ChatLauncher() {
  const { isAuthenticated, user } = useAuth();
  const { pathname } = useLocation();
  const { unreadCount, refresh } = useChatUnread();
  const [open, setOpen] = useState(false);
  const [activeThread, setActiveThread] = useState(null); // { bookingId, name } | null
  const { threads, loading, error, reload } = useChatThreads();

  // Rendered unconditionally so its hooks always run in the same order — bails out after, not
  // via an early return above the hooks.
  if (!isAuthenticated || HIDE_ON.some((re) => re.test(pathname))) return null;

  const togglePanel = () => {
    setOpen((wasOpen) => {
      const next = !wasOpen;
      if (next) reload();
      else {
        setActiveThread(null);
        refresh();
      }
      return next;
    });
  };

  const backToList = () => {
    setActiveThread(null);
    reload();
  };

  const selectThread = (bookingId) => {
    const t = threads.find((th) => th.bookingId === bookingId);
    setActiveThread({ bookingId, name: t ? otherPartyName(t) : "Chat" });
  };

  return (
    <>
      {open && (
        <div className="fixed z-[60] inset-3 top-16 bottom-20 sm:inset-auto sm:top-auto sm:bottom-24 sm:right-6 sm:w-[380px] sm:h-[560px] bg-white rounded-2xl shadow-xl flex flex-col overflow-hidden animate-fade-in">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-neutral-100 flex-shrink-0">
            {activeThread ? (
              <>
                <button
                  onClick={backToList}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-neutral-50 text-neutral-500 transition-colors flex-shrink-0"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <p className="flex-1 min-w-0 truncate font-poppins font-semibold text-sm text-neutral-800">
                  {activeThread.name}
                </p>
              </>
            ) : (
              <p className="flex-1 font-poppins font-semibold text-sm text-neutral-800">Chats</p>
            )}
            <button
              onClick={togglePanel}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-neutral-50 text-neutral-400 transition-colors flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {activeThread ? (
            <div className="flex-1 min-h-0 p-2">
              <ChatWindow bookingId={activeThread.bookingId} currentUserId={user?.id} className="flex flex-col h-full" />
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto">
              <ChatThreadList threads={threads} loading={loading} error={error} onRetry={reload} onSelect={selectThread} compact />
            </div>
          )}
        </div>
      )}

      <button
        onClick={togglePanel}
        className="fixed z-[60] bottom-20 right-4 sm:bottom-6 sm:right-6 w-14 h-14 rounded-full bg-primary text-white shadow-xl flex items-center justify-center hover:bg-primary-dark transition-colors"
      >
        {open ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
        {!open && unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 flex items-center justify-center bg-amber-400 text-neutral-900 text-[10px] font-bold rounded-full border-2 border-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
    </>
  );
}
