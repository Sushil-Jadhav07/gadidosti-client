import { useCallback, useEffect, useState } from "react";
import { api, getToken } from "../services/api";

// Fetch + state for GET /api/chat/threads — shared by the full Chats.jsx page and the floating
// launcher panel so the two don't each carry their own copy of the same load/error/retry dance.
export function useChatThreads() {
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await api.get("/api/chat/threads", getToken());
      if (!res?.success) throw new Error(res?.message || "Failed to load chats");
      setThreads(res.data?.threads || []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { threads, loading, error, reload: load };
}
