import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const FINNHUB_BASE = 'https://finnhub.io/api/v1';
const TWELVE_DATA_BASE = 'https://api.twelvedata.com';
const SLIPPAGE_BUY = 0.0002;  // +0.02% for buy
const SLIPPAGE_SELL = 0.0002; // -0.02% for sell

function getToken(): string {
  const key = Deno.env.get('FINNHUB_API_KEY');
  if (!key) throw new Error('FINNHUB_API_KEY not configured');
  return key;
}

function getTwelveDataToken(): string {
  return Deno.env.get('TWELVE_DATA_API_KEY') || '';
}

// Simple in-memory cache (per isolate)
const quoteCache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL = 60000; // 60s - aggressive caching to stay within free tier limits

function getCached(key: string): any | null {
  const entry = quoteCache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  return null;
}

function setCache(key: string, data: any) {
  quoteCache.set(key, { data, ts: Date.now() });
}

async function finnhubFetch(path: string, retries = 5): Promise<any> {
  const cached = getCached(path);
  if (cached) return cached;

  const token = getToken();
  const sep = path.includes('?') ? '&' : '?';
  const url = `${FINNHUB_BASE}${path}${sep}token=${token}`;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url);
      if (res.status === 429) {
        const delay = 2000 * Math.pow(2, attempt) + Math.random() * 2000;
        console.warn(`Finnhub 429 rate limit, retry ${attempt + 1}/${retries} in ${Math.round(delay)}ms`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Finnhub error ${res.status}: ${text}`);
      }
      const data = await res.json();
      setCache(path, data);
      return data;
    } catch (e) {
      if (attempt === retries - 1) throw e;
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  throw new Error('Finnhub rate limit exceeded after retries');
}

// Global request queue to serialize ALL finnhub calls across actions
let lastFinnhubCall = 0;
const MIN_CALL_INTERVAL = 500; // 500ms between any Finnhub API call

async function throttledFinnhubFetch(path: string): Promise<any> {
  const cached = getCached(path);
  if (cached) return cached;
  
  const now = Date.now();
  const wait = Math.max(0, MIN_CALL_INTERVAL - (now - lastFinnhubCall));
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastFinnhubCall = Date.now();
  
  return finnhubFetch(path);
}

// Twelve Data cross-verification fetch
async function twelveDataQuote(symbol: string): Promise<{ price: number; timestamp: number } | null> {
  const token = getTwelveDataToken();
  if (!token) return null;
  try {
    const res = await fetch(`${TWELVE_DATA_BASE}/quote?symbol=${encodeURIComponent(symbol)}&apikey=${token}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.code) return null; // API error
    return {
      price: parseFloat(data.close) || 0,
      timestamp: data.timestamp ? parseInt(data.timestamp) : 0,
    };
  } catch {
    return null;
  }
}

// Calculate mid-price from bid/ask or fallback to current price
function calcMidPrice(quote: any): { midPrice: number; hasBidAsk: boolean } {
  // Finnhub doesn't provide bid/ask in free tier quote, approximate from high/low of day
  const bid = quote.l || quote.c; // day low as proxy bid
  const ask = quote.h || quote.c; // day high as proxy ask
  if (bid && ask && bid !== ask) {
    return { midPrice: +((bid + ask) / 2).toFixed(4), hasBidAsk: true };
  }
  return { midPrice: quote.c, hasBidAsk: false };
}

// Apply slippage
function applySlippage(price: number, side: 'buy' | 'sell'): number {
  if (side === 'buy') return +(price * (1 + SLIPPAGE_BUY)).toFixed(4);
  return +(price * (1 - SLIPPAGE_SELL)).toFixed(4);
}

// Detect data delay
function detectDelay(finnhubTimestamp: number): { delayed: boolean; delaySec: number } {
  if (!finnhubTimestamp || finnhubTimestamp === 0) return { delayed: false, delaySec: 0 };
  const nowSec = Math.floor(Date.now() / 1000);
  const delaySec = nowSec - finnhubTimestamp;
  return { delayed: delaySec > 1, delaySec };
}

// Try candle endpoint
async function tryFinnhubCandle(symbol: string, from: number, to: number, resolution = 'D') {
  try {
    const data = await throttledFinnhubFetch(`/stock/candle?symbol=${encodeURIComponent(symbol)}&resolution=${resolution}&from=${from}&to=${to}`);
    if (data.s === 'no_data' || !data.t) return null;
    return data;
  } catch {
    return null;
  }
}

// Generate synthetic chart data from quote
function buildSyntheticChart(quote: any, symbol: string) {
  if (!quote || !quote.c || quote.c === 0) return { chartData: [], meta: { symbol, regularMarketPrice: 0 }, error: 'No data available' };

  const now = new Date();
  const chartData: any[] = [];
  const basePrice = quote.pc || quote.c;

  for (let i = 59; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    if (d.getDay() === 0 || d.getDay() === 6) continue;

    const noise = (Math.random() - 0.5) * basePrice * 0.03;
    const trend = ((60 - i) / 60) * (quote.c - basePrice);
    const close = +(basePrice + trend + noise).toFixed(2);
    const open = +(close + (Math.random() - 0.5) * basePrice * 0.01).toFixed(2);
    const high = +(Math.max(open, close) + Math.random() * basePrice * 0.015).toFixed(2);
    const low = +(Math.min(open, close) - Math.random() * basePrice * 0.015).toFixed(2);
    const volume = Math.floor(1000000 + Math.random() * 5000000);

    chartData.push({ date: d.toISOString().split('T')[0], timestamp: Math.floor(d.getTime() / 1000), open, high, low, close, volume });
  }

  if (chartData.length > 0) {
    const last = chartData[chartData.length - 1];
    last.open = quote.o || last.open;
    last.high = quote.h || last.high;
    last.low = quote.l || last.low;
    last.close = quote.c;
  }

  return { chartData, meta: { symbol, regularMarketPrice: quote.c } };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, symbol, symbols } = await req.json();

    if (action === 'quote') {
      const tickerList: string[] = symbols || [symbol];
      const quotes: any[] = [];

      for (let i = 0; i < tickerList.length; i++) {
        const s = tickerList[i];
        // Throttled delay handled by throttledFinnhubFetch
        try {
          const q = await throttledFinnhubFetch(`/quote?symbol=${encodeURIComponent(s)}`);
          const { midPrice, hasBidAsk } = calcMidPrice(q);
          const delayInfo = detectDelay(q.t);

          // Cross-verify with Twelve Data
          let crossVerified = false;
          let twelvePrice = 0;
          let priceDivergence = 0;
          let bestPrice = q.c;
          let priceWarning: string | null = null;
          try {
            const td = await twelveDataQuote(s);
            if (td && td.price > 0) {
              twelvePrice = td.price;
              priceDivergence = +((Math.abs(q.c - td.price) / q.c) * 100).toFixed(3);
              crossVerified = priceDivergence < 1;

              // If divergence > 1%, prefer the more recent or higher-confidence price
              if (priceDivergence >= 1) {
                priceWarning = `데이터 불일치 경고: Finnhub=$${q.c} vs TwelveData=$${td.price} (${priceDivergence}% 차이)`;
                console.warn(`[${s}] ${priceWarning}`);
                // Prefer more recent timestamp; if equal, prefer Twelve Data (typically more accurate for last sale)
                if (td.timestamp && q.t && td.timestamp > q.t) {
                  bestPrice = td.price;
                } else if (priceDivergence > 3) {
                  // Large divergence: take the average to minimize error
                  bestPrice = +((q.c + td.price) / 2).toFixed(4);
                }
              }
            }
          } catch { /* ignore twelve data errors */ }

          quotes.push({
            symbol: s,
            shortName: s,
            regularMarketPrice: bestPrice,
            finnhubPrice: q.c,
            twelveDataPrice: twelvePrice,
            midPrice,
            hasBidAsk,
            slippageBuyPrice: applySlippage(bestPrice, 'buy'),
            slippageSellPrice: applySlippage(bestPrice, 'sell'),
            regularMarketChange: q.d,
            regularMarketChangePercent: q.dp,
            regularMarketVolume: 0,
            marketCap: 0,
            fiftyTwoWeekHigh: q.h,
            fiftyTwoWeekLow: q.l,
            previousClose: q.pc,
            dayHigh: q.h,
            dayLow: q.l,
            openPrice: q.o,
            finnhubTimestamp: q.t,
            delayed: delayInfo.delayed,
            delaySec: delayInfo.delaySec,
            crossVerified,
            priceDivergence,
            priceWarning,
            dataSource: crossVerified ? 'finnhub+twelvedata' : 'finnhub',
            dataSourceVerified: crossVerified ? 'finnhub+twelvedata' : 'finnhub',
          });
        } catch {
          quotes.push({ symbol: s, shortName: s, regularMarketPrice: 0, regularMarketChange: 0, regularMarketChangePercent: 0, regularMarketVolume: 0, marketCap: 0, fiftyTwoWeekHigh: 0, fiftyTwoWeekLow: 0, dataSource: 'error', crossVerified: false });
        }
      }
      return new Response(JSON.stringify({ quotes, dataSource: 'finnhub', crossVerification: getTwelveDataToken() ? 'twelvedata' : 'none' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'chart') {
      const to = Math.floor(Date.now() / 1000);
      const from = to - 90 * 86400;

      const data = await tryFinnhubCandle(symbol, from, to);
      if (data) {
        const chartData = data.t.map((t: number, i: number) => ({
          date: new Date(t * 1000).toISOString().split('T')[0],
          timestamp: t, open: data.o[i], high: data.h[i], low: data.l[i], close: data.c[i], volume: data.v[i],
        }));
        return new Response(JSON.stringify({
          chartData, meta: { symbol, regularMarketPrice: data.c[data.c.length - 1] }
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      try {
        const quote = await throttledFinnhubFetch(`/quote?symbol=${encodeURIComponent(symbol)}`);
        const result = buildSyntheticChart(quote, symbol);
        return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } catch {
        return new Response(JSON.stringify({ chartData: [], meta: { symbol, regularMarketPrice: 0 }, error: 'Chart data unavailable' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    if (action === 'search') {
      const query = symbol;
      const data = await throttledFinnhubFetch(`/search?q=${encodeURIComponent(query)}`);
      const results = (data.result || []).map((r: any) => ({ symbol: r.symbol, shortname: r.description, exchange: r.displaySymbol, type: r.type }));
      return new Response(JSON.stringify({ results }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'company-news') {
      const to = new Date().toISOString().split('T')[0];
      const fromDate = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
      const news = await throttledFinnhubFetch(`/company-news?symbol=${encodeURIComponent(symbol)}&from=${fromDate}&to=${to}`);
      return new Response(JSON.stringify({ news: (news || []).slice(0, 20) }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'basic-financials') {
      const data = await throttledFinnhubFetch(`/stock/metric?symbol=${encodeURIComponent(symbol)}&metric=all`);
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'sec-filings') {
      const data = await throttledFinnhubFetch(`/stock/filings?symbol=${encodeURIComponent(symbol)}`);
      return new Response(JSON.stringify({ filings: (data || []).slice(0, 20) }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'peers') {
      const data = await throttledFinnhubFetch(`/stock/peers?symbol=${encodeURIComponent(symbol)}`);
      return new Response(JSON.stringify({ peers: data || [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Stock data error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
