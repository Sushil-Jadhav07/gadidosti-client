import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { api, getToken } from "../services/api";
import { useAuth } from "./AuthContext";

const ChatUnreadContext = createContext({ unreadCount: 0, refresh: () => {} });
const POLL_MS = 20000;

// One poller for GET /api/chat/unread-count, shared by every badge that needs it — Sidebar's
// "Chat" nav item and the floating launcher (ChatLauncher.jsx) both read from here instead of
// each running their own interval against the same endpoint.
export function ChatUnreadProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const fetchRef = useRef(async () => {});

  useEffect(() => {
    if (!isAuthenticated) {
      setUnreadCount(0);
      return undefined;
    }
    let cancelled = false;
    const fetchUnread = async () => {
      const token = getToken();
      if (!token) return;
      try {
        const res = await api.get("/api/chat/unread-count", token);
        if (!cancelled && res?.success) setUnreadCount(res.data?.unreadCount || 0);
      } catch { /* silent — next poll retries */ }
    };
    fetchRef.current = fetchUnread;
    fetchUnread();
    const interval = setInterval(fetchUnread, POLL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, [isAuthenticated]);

  // Exposed so a badge can pull a fresh count right after a thread's messages get marked read,
  // instead of waiting up to POLL_MS for it to catch up on its own.
  const refresh = useCallback(() => fetchRef.current(), []);

  return (
    <ChatUnreadContext.Provider value={{ unreadCount, refresh }}>
      {children}
    </ChatUnreadContext.Provider>
  );
}

export function useChatUnread() {
  return useContext(ChatUnreadContext);
}
