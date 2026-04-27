import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const WS_TOKEN_TIMEOUT_MS = 5000;
const POLLING_MODE_RETRY_MS = 120000;
const CONNECTION_RETRY_MS = 30000;
const EMPTY_SYMBOL_RETRY_MS = 60000;

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
    if (symbolsRef.current.length === 0) {
      setState(prev => ({ ...prev, isConnected: false, error: null }));
      scheduleReconnect(EMPTY_SYMBOL_RETRY_MS);
      return;
    }

    try {
      const timeout = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('WS_TOKEN_TIMEOUT')), WS_TOKEN_TIMEOUT_MS);
      });
      const { data, error } = await Promise.race([
        supabase.functions.invoke('ws-token', { body: {} }),
        timeout,
      ]);

      if (error || !data?.wsUrl) {
        const reason = data?.fallback ? 'WebSocket 임시 우회 — Polling 모드' : 'WebSocket 토큰 획득 실패 — Polling 모드';
        setState(prev => ({ ...prev, error: reason, isConnected: false }));
        scheduleReconnect(POLLING_MODE_RETRY_MS);
        return;
      }

      const ws = new WebSocket(data.wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
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
        setState(prev => ({ ...prev, error: 'WebSocket 연결 오류', isConnected: false }));
      };

      ws.onclose = (event) => {
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
      const message = e instanceof Error && e.message === 'WS_TOKEN_TIMEOUT'
        ? 'WebSocket 토큰 지연 — Polling 모드'
        : 'WebSocket 연결 실패 — Polling 모드';
      console.warn('[useWebSocketPrices] using polling fallback:', e);
      setState(prev => ({ ...prev, error: message, isConnected: false }));
      scheduleReconnect(CONNECTION_RETRY_MS);
    }
  }, [flushBatch, scheduleReconnect]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  // Handle symbol subscription changes
  useEffect(() => {
    const prevSymbols = new Set(symbolsRef.current);
    const newSymbols = new Set(symbols);

    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      // Unsubscribe removed symbols
      for (const s of prevSymbols) {
        if (!newSymbols.has(s)) {
          ws.send(JSON.stringify({ type: 'unsubscribe', symbol: s }));
          pricesRef.current.delete(s);
        }
      }
      // Subscribe new symbols
      for (const s of newSymbols) {
        if (!prevSymbols.has(s)) {
          ws.send(JSON.stringify({ type: 'subscribe', symbol: s }));
        }
      }
    }

    symbolsRef.current = symbols;
  }, [symbols]);

  // Connect on mount
  useEffect(() => {
    symbolsRef.current = symbols;
    connect();

    return () => {
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
  }, []); // Only on mount

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
