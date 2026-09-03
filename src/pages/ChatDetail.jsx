import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import ChatWindow from "../components/ChatWindow";
import { useAuth } from "../context/AuthContext";

// Full-page chat for a single booking — same reasoning as BookingDetail.jsx moving off its old
// BottomSheet modal: a real URL to land on (from a push/toast, or shared) instead of client-only
// sheet state, and this list (unlike TrackShipment's single embedded chat) can point at any of
// the client's bookings.
export default function ChatDetail() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="p-4 md:p-8 animate-page-enter">
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={() => navigate("/chats")}
          className="w-9 h-9 flex items-center justify-center rounded-lg bg-white shadow-card text-neutral-500 hover:text-neutral-700 transition-colors flex-shrink-0"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-poppins font-bold text-xl md:text-2xl text-neutral-800">Chat</h1>
      </div>

      <div className="bg-white rounded-2xl shadow-card p-4 md:p-5 max-w-2xl">
        <ChatWindow bookingId={bookingId} currentUserId={user?.id} />
      </div>
    </div>
  );
}
