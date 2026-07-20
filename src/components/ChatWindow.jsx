import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { Send, MessageCircle } from "lucide-react";
import { api, getToken } from "../services/api";

const BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

// Live chat for a single booking. REST loads history + does the initial mark-as-read; the
// socket connection (auth'd with the same access token as every REST call) delivers new
// messages/typing/read-receipts in real time on top of it. Works for client, broker, and
// driver — whoever the booking's participants are; admin gets a read-only view via `readOnly`.
export default function ChatWindow({ bookingId, currentUserId, readOnly = false }) {
  const [thread, setThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState({});
  const socketRef = useRef(null);
  const bottomRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    if (!bookingId) return;
    let cancelled = false;
    const token = getToken();

    const init = async () => {
      setLoading(true);
      setLoadError(false);
      try {
        const threadRes = await api.get(`/api/chat/bookings/${bookingId}/thread`, token);
        if (!threadRes?.success) throw new Error(threadRes?.message);
        const t = threadRes.data.thread;
        if (cancelled) return;
        setThread(t);

        const messagesRes = await api.get(`/api/chat/threads/${t.id}/messages?limit=50`, token);
        if (!cancelled) setMessages(messagesRes.data?.messages || []);

        if (!readOnly) api.patch(`/api/chat/threads/${t.id}/read`, {}, token).catch(() => {});

        const socket = io(BASE, { auth: { token }, transports: ["websocket", "polling"] });
        socketRef.current = socket;

        socket.emit("join-thread", { threadId: t.id });

        socket.on("new-message", (msg) => {
          if (msg.threadId !== t.id) return;
          setMessages((current) => (current.some((m) => m.id === msg.id) ? current : [...current, msg]));
          if (!readOnly && msg.senderId !== currentUserId) socket.emit("read", { threadId: t.id });
        });

        socket.on("typing", ({ userId, isTyping }) => {
          if (userId === currentUserId) return;
          setTypingUsers((current) => ({ ...current, [userId]: isTyping }));
        });

        socket.on("read-receipt", ({ userId }) => {
          if (userId === currentUserId) return;
          setMessages((current) => current.map((m) => (
            m.senderId === currentUserId && !m.readAt ? { ...m, readAt: new Date().toISOString() } : m
          )));
        });
      } catch {
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    init();

    return () => {
      cancelled = true;
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [bookingId, currentUserId, readOnly]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || !thread || !socketRef.current) return;
    setSending(true);
    socketRef.current.emit("send-message", { threadId: thread.id, message: text }, (ack) => {
      setSending(false);
      if (ack?.success) setInput("");
    });
  };

  const handleTyping = (value) => {
    setInput(value);
    if (!socketRef.current || !thread) return;
    socketRef.current.emit("typing", { threadId: thread.id, isTyping: true });
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socketRef.current?.emit("typing", { threadId: thread.id, isTyping: false });
    }, 1500);
  };

  const someoneTyping = Object.values(typingUsers).some(Boolean);

  return (
    <div className="flex flex-col h-[60vh] md:h-[500px]">
      <div className="flex-1 overflow-y-auto space-y-2.5 p-1">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <span className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        ) : loadError ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <MessageCircle className="w-8 h-8 text-neutral-200 mb-2" />
            <p className="text-sm text-neutral-400">Couldn't load this chat.</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <MessageCircle className="w-8 h-8 text-neutral-200 mb-2" />
            <p className="text-sm text-neutral-400">No messages yet — say hello!</p>
          </div>
        ) : (
          messages.map((m) => {
            const isMine = m.senderId === currentUserId;
            return (
              <div key={m.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${isMine ? "bg-primary text-white rounded-br-sm" : "bg-neutral-100 text-neutral-800 rounded-bl-sm"}`}>
                  {!isMine && <p className="text-[10px] font-semibold opacity-70 mb-0.5">{m.senderName}</p>}
                  <p className="whitespace-pre-wrap break-words">{m.message}</p>
                  <p className={`text-[10px] mt-0.5 text-right ${isMine ? "text-white/70" : "text-neutral-400"}`}>
                    {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    {isMine && m.readAt ? " · Read" : ""}
                  </p>
                </div>
              </div>
            );
          })
        )}
        {someoneTyping && <p className="text-xs text-neutral-400 italic pl-1">Typing...</p>}
        <div ref={bottomRef} />
      </div>

      {!readOnly && (
        <div className="flex items-center gap-2 pt-3 border-t border-neutral-100 mt-2">
          <input
            value={input}
            onChange={(e) => handleTyping(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSend(); } }}
            placeholder="Type a message..."
            disabled={loading || !thread}
            className="flex-1 bg-neutral-50 border border-neutral-200 rounded-full px-4 py-2.5 text-sm outline-none focus:border-primary transition-colors disabled:opacity-50 min-w-0"
          />
          <button
            onClick={handleSend}
            disabled={sending || !input.trim() || !thread}
            className="w-10 h-10 flex-shrink-0 rounded-full bg-primary text-white flex items-center justify-center hover:bg-primary-dark transition-colors disabled:opacity-40"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
