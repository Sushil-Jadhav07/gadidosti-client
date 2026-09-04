import { MessageCircle } from "lucide-react";
import { useChatThreads } from "../hooks/useChatThreads";

// A floating single-trip chat button — same visual treatment (size, position, badge style) as
// the app-wide ChatLauncher FAB, but scoped to exactly one booking's thread. TrackShipment.jsx
// and BookingDetail.jsx hide the generic multi-thread launcher (see its own HIDE_ON comment)
// and render this instead, since a client viewing one specific trip only ever needs that one
// trip's chat, not a picker across every booking they've ever made.
export default function TripChatFab({ bookingId, onClick }) {
  // Reuses the same GET /api/chat/threads list ChatLauncher/Chats.jsx already fetch — each
  // thread carries its own real unreadCount, so this badge reflects this one booking's unread
  // messages specifically, not the global total across every thread.
  const { threads } = useChatThreads();
  const unreadCount = threads.find((t) => t.bookingId === bookingId)?.unreadCount || 0;

  return (
    <button
      onClick={onClick}
      title="Chat about this trip"
      className="fixed z-50 bottom-20 right-4 sm:bottom-6 sm:right-6 w-14 h-14 rounded-full bg-primary text-white shadow-xl flex items-center justify-center hover:bg-primary-dark transition-colors"
    >
      <MessageCircle className="w-6 h-6" />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 flex items-center justify-center bg-amber-400 text-neutral-900 text-[10px] font-bold rounded-full border-2 border-white">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </button>
  );
}
