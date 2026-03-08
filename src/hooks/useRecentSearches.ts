import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY = "recent-stock-searches";
const MAX_RECENT = 8;

export interface RecentSearch {
  symbol: string;
  label: string;
  timestamp: number;
}

export function useRecentSearches() {
  const [recents, setRecents] = useState<RecentSearch[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(recents)); } catch {}
  }, [recents]);

  const addRecent = useCallback((symbol: string, label: string) => {
    setRecents(prev => {
      const filtered = prev.filter(r => r.symbol !== symbol);
      return [{ symbol, label, timestamp: Date.now() }, ...filtered].slice(0, MAX_RECENT);
    });
  }, []);

  const clearRecents = useCallback(() => setRecents([]), []);

  return { recents, addRecent, clearRecents };
}
