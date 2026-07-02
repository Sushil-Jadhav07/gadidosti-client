import { useState, useCallback, useEffect } from "react";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";

export function useNotifications({ auto = true, limit = 10 } = {}) {
  const { tokens } = useAuth();
  const token = tokens?.access_token;
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await api.get(`/api/users/notifications?limit=${limit}`, token);
      if (data.success) {
        setNotifications(data.data.notifications);
        setUnreadCount(data.data.unread_count);
      }
    } catch {}
    setLoading(false);
  }, [token, limit]);

  useEffect(() => {
    if (auto) fetchNotifications();
  }, [auto, fetchNotifications]);

  const markRead = useCallback(async (id) => {
    setNotifications((list) => list.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
    try { await api.patch(`/api/users/notifications/${id}/read`, {}, token); } catch {}
  }, [token]);

  const markAllRead = useCallback(async () => {
    setNotifications((list) => list.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
    try { await api.patch("/api/users/notifications/read-all", {}, token); } catch {}
  }, [token]);

  return { notifications, unreadCount, loading, fetchNotifications, markRead, markAllRead };
}

export function timeAgo(dateStr) {
  const diffSec = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}
