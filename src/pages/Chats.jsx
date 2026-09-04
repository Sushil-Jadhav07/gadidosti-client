import React from "react";
import { useNavigate } from "react-router-dom";
import ChatThreadList from "../components/ChatThreadList";
import { useChatThreads } from "../hooks/useChatThreads";

export default function Chats() {
  const navigate = useNavigate();
  const { threads, loading, error, reload } = useChatThreads();

  return (
    <div className="p-4 md:p-8 animate-page-enter">
      <div className="mb-6">
        <h1 className="font-poppins font-bold text-2xl text-neutral-800">Chats</h1>
        <p className="text-sm text-neutral-400 mt-0.5">Message your driver or broker about a shipment.</p>
      </div>

      <ChatThreadList
        threads={threads}
        loading={loading}
        error={error}
        onRetry={reload}
        onSelect={(bookingId) => navigate(`/chats/${bookingId}`)}
      />
    </div>
  );
}
