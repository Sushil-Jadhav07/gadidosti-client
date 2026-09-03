import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { Send, MessageCircle, Bot } from "lucide-react";
import { api, getToken } from "../services/api";
import { useToast } from "../context/ToastContext";

const BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

// Sender roles that mean a real person (not the bot) is now on the thread — used to flip a
// bot-stage thread to 'human' locally the instant one of their messages lands, so quick-reply
// pills disappear without waiting on a re-fetch. Deliberately excludes 'client': the client's own
// echoed message from tapping a quick-reply pill is also senderRole 'client' and must NOT count
// as an escalation on its own (see handleBotAction/the 'escalated' flag for that signal instead).
const HUMAN_AGENT_ROLES = ["broker", "driver", "admin"];

// Live chat for a single booking. REST loads history + does the initial mark-as-read; the
// socket connection (auth'd with the same access token as every REST call) delivers new
// messages/typing/read-receipts in real time on top of it. Works for client, broker, and
// driver — whoever the booking's participants are; admin gets a read-only view via `readOnly`.
export default function ChatWindow({ bookingId, currentUserId, readOnly = false }) {
  const toast = useToast();
  // Holds the full thread record from GET .../thread, including stage/isLocked — kept in state
  // (rather than re-derived) so the bot-escalation/lock signals below can patch it in place.
  const [thread, setThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
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
          if (HUMAN_AGENT_ROLES.includes(msg.senderRole)) {
            setThread((current) => (current && current.stage === "bot" ? { ...current, stage: "human" } : current));
          }
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
      if (ack?.success) {
        setInput("");
        // Free text sent while still 'bot' stage auto-escalates server-side; the ack carries the
        // bot's own "connecting you" message when that happened, so react to it right away
        // instead of waiting for that message to arrive over the socket.
        if (ack.botMessage) setThread((current) => (current ? { ...current, stage: "human" } : current));
      } else if (ack?.message) {
        toast.error(ack.message);
      }
    });
  };

  // Client tapped a bot quick-reply pill. The actual new messages (the echoed tap + the bot's
  // reply) arrive via the 'new-message' socket listener above like any other message — this just
  // owns the tap's loading/disabled state and reacts to the two ways the thread can already be
  // past bot stage underneath us (a clean escalation, or a 409 because someone else escalated it
  // first).
  const handleBotAction = async (actionId) => {
    if (actionLoading || !thread) return;
    setActionLoading(true);
    try {
      const res = await api.post(`/api/chat/threads/${thread.id}/bot-action`, { actionId }, getToken());
      if (!res?.success) {
        setThread((current) => (current ? { ...current, stage: "human" } : current));
        if (res?.message) toast.error(res.message);
        return;
      }
      if (res.data?.escalated) {
        setThread((current) => (current ? { ...current, stage: "human" } : current));
      }
    } catch (err) {
      toast.error(err?.message || "Failed to send. Please try again.");
    } finally {
      setActionLoading(false);
    }
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
  // Only the latest message's quick replies are ever live — earlier bot menu steps stay in
  // history as plain text once superseded, matching the backend's own "next menu step" framing.
  const quickReplies = thread?.stage === "bot" && !thread?.isLocked
    ? messages[messages.length - 1]?.meta?.quickReplies || []
    : [];

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
            const isBot = m.senderRole === "bot";
            return (
              <div key={m.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${
                    isMine
                      ? "bg-primary text-white rounded-br-sm"
                      : isBot
                      ? "bg-indigo-50 border border-indigo-100 text-neutral-800 rounded-bl-sm"
                      : "bg-neutral-100 text-neutral-800 rounded-bl-sm"
                  }`}
                >
                  {!isMine && (
                    <p className={`text-[10px] font-semibold mb-0.5 flex items-center gap-1 ${isBot ? "text-indigo-600" : "opacity-70"}`}>
                      {isBot && <Bot className="w-3 h-3" />}
                      {isBot ? "SSK Assistant" : m.senderName}
                    </p>
                  )}
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

      {(thread?.isLocked || !readOnly) && (
        <div className="pt-3 border-t border-neutral-100 mt-2">
          {thread?.isLocked ? (
            <div className="text-center py-2">
              <p className="text-xs font-medium text-neutral-400">This trip is complete — the chat has closed.</p>
            </div>
          ) : (
            <>
              {/* Quick-reply pills — bot's current menu step, while it's still fielding this
                  thread on its own. The free-text input right below stays usable the whole time
                  (typing instead of tapping a pill still works, and auto-escalates server-side). */}
              {quickReplies.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2.5">
                  {quickReplies.map((qr) => (
                    <button
                      key={qr.id}
                      onClick={() => handleBotAction(qr.id)}
                      disabled={actionLoading}
                      className="px-3.5 py-2 rounded-full border border-primary/30 bg-primary-50 text-primary text-xs font-medium hover:bg-primary/15 transition-colors disabled:opacity-40"
                    >
                      {qr.label}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2">
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
            </>
          )}
        </div>
      )}
    </div>
  );
}
