import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

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
  const maxRetries = 5;

  const flushBatch = useCallback(() => {
    setState(prev => ({
      ...prev,
      prices: new Map(pricesRef.current),
      lastUpdateAt: Date.now(),
    }));
  }, []);

  const connect = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('ws-token', { body: {} });
      if (error || !data?.wsUrl) {
        setState(prev => ({ ...prev, error: 'WebSocket 토큰 획득 실패', isConnected: false }));
        // Fallback: retry in 10s
        reconnectTimerRef.current = setTimeout(connect, 10000);
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
        reconnectTimerRef.current = setTimeout(connect, backoff);
      };

    } catch (e) {
      setState(prev => ({ ...prev, error: '연결 실패', isConnected: false }));
      reconnectTimerRef.current = setTimeout(connect, 10000);
    }
  }, [flushBatch]);

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

  const getPrice = useCallback((symbol: string): number | null => {
    return state.prices.get(symbol)?.price ?? null;
  }, [state.prices]);

  return {
    prices: state.prices,
    getPrice,
    isConnected: state.isConnected,
    latencyMs: state.latencyMs,
    lastUpdateAt: state.lastUpdateAt,
    error: state.error,
  };
}
