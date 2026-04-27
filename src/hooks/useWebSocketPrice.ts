import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const WS_TOKEN_TIMEOUT_MS = 5000;
const POLLING_MODE_RETRY_MS = 120000;
const CONNECTION_RETRY_MS = 30000;
const EMPTY_SYMBOL_RETRY_MS = 60000;
const WS_TOKEN_CACHE_MS = 10 * 60 * 1000;
const FINNHUB_WS_ENABLED = import.meta.env.VITE_ENABLE_FINNHUB_WS === 'true';

let cachedWsUrl: string | null = null;
let cachedWsUrlAt = 0;
let wsTokenPromise: Promise<string | null> | null = null;

async function getWsUrl(): Promise<string | null> {
  if (!FINNHUB_WS_ENABLED) {
    return null;
  }

  const now = Date.now();
  if (cachedWsUrl && now - cachedWsUrlAt < WS_TOKEN_CACHE_MS) {
    return cachedWsUrl;
  }

  if (!wsTokenPromise) {
    wsTokenPromise = supabase.functions
      .invoke('ws-token', { body: {} })
      .then(({ data, error }) => {
        if (error || data?.fallback || !data?.wsUrl) return null;
        cachedWsUrl = data.wsUrl;
        cachedWsUrlAt = Date.now();
        return cachedWsUrl;
      })
      .catch((error) => {
        console.warn('[useWebSocketPrices] ws-token unavailable, using polling fallback:', error);
        return null;
      })
      .finally(() => {
        wsTokenPromise = null;
      });
  }

  return wsTokenPromise;
}

interface PriceData {
  symbol: string;
  price: number;
  volume: number;
  timestamp: number;
}

interface WebSocketState {
  prices: Map<string, PriceData>;
  isConnected: boolean;
  latencyMs: number;
  lastUpdateAt: number;
  error: string | null;
}

export function useWebSocketPrices(symbols: string[]) {
  const symbolKey = symbols.join('|');
  const [state, setState] = useState<WebSocketState>({
    prices: new Map(),
    isConnected: false,
    latencyMs: 0,
    lastUpdateAt: 0,
    error: null,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const symbolsRef = useRef<string[]>([]);
  const pricesRef = useRef<Map<string, PriceData>>(new Map());
  const batchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);
  const connectingRef = useRef(false);
  const mountedRef = useRef(false);
  const connectRef = useRef<() => void>(() => undefined);
  const maxRetries = 5;

  const scheduleReconnect = useCallback((delayMs: number) => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
    }
    reconnectTimerRef.current = setTimeout(() => connectRef.current(), delayMs);
  }, []);

  const flushBatch = useCallback(() => {
    setState(prev => ({
      ...prev,
      prices: new Map(pricesRef.current),
      lastUpdateAt: Date.now(),
    }));
  }, []);

  const connect = useCallback(async () => {
    if (connectingRef.current) return;
    const existingWs = wsRef.current;
    if (existingWs && (existingWs.readyState === WebSocket.OPEN || existingWs.readyState === WebSocket.CONNECTING)) {
      return;
    }

    if (!FINNHUB_WS_ENABLED) {
      setState(prev => prev.isConnected || prev.error
        ? { ...prev, isConnected: false, error: null }
        : prev
      );
      return;
    }

    if (symbolsRef.current.length === 0) {
      setState(prev => ({ ...prev, isConnected: false, error: null }));
      scheduleReconnect(EMPTY_SYMBOL_RETRY_MS);
      return;
    }

    connectingRef.current = true;
    try {
      const timeout = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('WS_TOKEN_TIMEOUT')), WS_TOKEN_TIMEOUT_MS);
      });
      const wsUrl = await Promise.race([getWsUrl(), timeout]);

      if (!wsUrl) {
        const reason = 'WebSocket 임시 우회 — Polling 모드';
        setState(prev => ({ ...prev, error: reason, isConnected: false }));
        scheduleReconnect(POLLING_MODE_RETRY_MS);
        return;
      }

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        connectingRef.current = false;
        retryCountRef.current = 0; // Reset on successful connection
        setState(prev => ({ ...prev, isConnected: true, error: null }));
        // Subscribe to all symbols
        symbolsRef.current.forEach(s => {
          ws.send(JSON.stringify({ type: 'subscribe', symbol: s }));
        });
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === 'trade' && msg.data) {
          const now = Date.now();
          for (const trade of msg.data) {
            const existing = pricesRef.current.get(trade.s);
            // Only update if newer
            if (!existing || trade.t >= existing.timestamp) {
              pricesRef.current.set(trade.s, {
                symbol: trade.s,
                price: trade.p,
                volume: trade.v,
                timestamp: trade.t,
              });
            }
          }
          // Calculate latency from trade timestamp
          const latestTrade = msg.data[msg.data.length - 1];
          const latency = Math.max(0, now - latestTrade.t);

          setState(prev => ({ ...prev, latencyMs: latency }));

          // Batch UI updates every 200ms to avoid excessive re-renders
          if (!batchTimerRef.current) {
            batchTimerRef.current = setTimeout(() => {
              flushBatch();
              batchTimerRef.current = null;
            }, 200);
          }
        }
      };

      ws.onerror = () => {
        connectingRef.current = false;
        setState(prev => ({ ...prev, error: 'WebSocket 연결 오류', isConnected: false }));
      };

      ws.onclose = (event) => {
        connectingRef.current = false;
        setState(prev => ({ ...prev, isConnected: false }));
        wsRef.current = null;
        
        // 429 = rate limited, use exponential backoff and stop after max retries
        if (retryCountRef.current >= maxRetries) {
          setState(prev => ({ ...prev, error: 'Finnhub 연결 한도 초과 — Polling 모드로 전환' }));
          return;
        }
        retryCountRef.current += 1;
        const backoff = Math.min(3000 * Math.pow(2, retryCountRef.current - 1), 60000);
        scheduleReconnect(backoff);
      };

    } catch (e) {
      connectingRef.current = false;
      const message = e instanceof Error && e.message === 'WS_TOKEN_TIMEOUT'
        ? 'WebSocket 토큰 지연 — Polling 모드'
        : 'WebSocket 연결 실패 — Polling 모드';
      console.warn('[useWebSocketPrices] using polling fallback:', e);
      setState(prev => ({ ...prev, error: message, isConnected: false }));
      scheduleReconnect(CONNECTION_RETRY_MS);
    }
  }, [flushBatch, scheduleReconnect]);

  // Keep latest connect in a ref (assigned during render — no hook needed)
  connectRef.current = connect;

  // Single effect: handle mount, symbol changes, and reconnection
  useEffect(() => {
    mountedRef.current = true;
    const prevSymbols = new Set(symbolsRef.current);
    const newSymbols = new Set(symbols);
    const ws = wsRef.current;

    symbolsRef.current = symbols;

    if (ws && ws.readyState === WebSocket.OPEN) {
      for (const s of prevSymbols) {
        if (!newSymbols.has(s)) {
          ws.send(JSON.stringify({ type: 'unsubscribe', symbol: s }));
          pricesRef.current.delete(s);
        }
      }
      for (const s of newSymbols) {
        if (!prevSymbols.has(s)) {
          ws.send(JSON.stringify({ type: 'subscribe', symbol: s }));
        }
      }
    } else if (!ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
      connectRef.current();
    }
  }, [symbolKey]);

  // Cleanup on unmount only
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      connectingRef.current = false;
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (batchTimerRef.current) {
        clearTimeout(batchTimerRef.current);
      }
    };
  }, []);

  const getPrice = (symbol: string): number | null => {
    return pricesRef.current.get(symbol)?.price ?? state.prices.get(symbol)?.price ?? null;
  };

  return {
    prices: state.prices,
    getPrice,
    isConnected: state.isConnected,
    latencyMs: state.latencyMs,
    lastUpdateAt: state.lastUpdateAt,
    error: state.error,
  };
}
