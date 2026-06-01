// Micro-Sniper Edge Function
// 미국 주식 <$5 종목을 1분봉 300개로 스캔, EMA200 + Ichimoku 양운 돌파 시그널 산출
// 🛡️ Free Tier 안전: Twelve Data 8 req/min, 800/day 한도 내 동작 보장
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { installCostGuard } from "../_shared/cost-guard.ts";

installCostGuard();

const TWELVE_DATA_API_KEY = Deno.env.get("TWELVE_DATA_API_KEY")!;
const FINNHUB_API_KEY = Deno.env.get("FINNHUB_API_KEY")!;
const MAX_PRICE_USD = 5;

// 🛡️ 슬롯 제한: Twelve Data Free 800/day 보호
// 8심볼 × 5분 주기 × 6.5시간(미장 개장) ≈ 624 호출/일
const MAX_SCAN_SLOTS = 8;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5분 서버 캐시
const REQ_DELAY_MS = 900;            // 1초당 1콜 미만으로 throttle

// 저가 미국주 핵심 유니버스 (8종목 우선)
const DEFAULT_UNIVERSE = [
  "SOFI", "NIO", "PLUG", "BBD", "GRAB", "LCID", "MARA", "OPEN",
];

interface Candle {
  time: number;
  open: number; high: number; low: number; close: number;
  volume?: number;
}

interface Signal {
  symbol: string;
  currentPrice: number;
  lastOpen: number;
  lastClose: number;
  ema200: number;
  spanA: number;
  spanB: number;
  bullish: boolean;
  reason: string;
  limitBuyPrice: number;
  takeProfitPrice: number;
  candleCount: number;
}

interface ScanResult {
  ok: boolean;
  generatedAt: string;
  scanned: number;
  signalCount: number;
  signals: Signal[];
  rejected: Signal[];
  maxPriceUsd: number;
  cached?: boolean;
  marketOpen?: boolean;
}

// 🗄️ 인메모리 캐시 (per-isolate)
let cache: { at: number; data: ScanResult } | null = null;

function calcEMA(values: number[], period: number): number[] {
  const out: number[] = new Array(values.length).fill(NaN);
  if (values.length < period) return out;
  const k = 2 / (period + 1);
  let sum = 0;
  for (let i = 0; i < period; i++) sum += values[i];
  let ema = sum / period;
  out[period - 1] = ema;
  for (let i = period; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k);
    out[i] = ema;
  }
  return out;
}

function midPrice(highs: number[], lows: number[], period: number, endIdx: number): number {
  if (endIdx + 1 < period) return NaN;
  let hh = -Infinity, ll = Infinity;
  for (let i = endIdx - period + 1; i <= endIdx; i++) {
    if (highs[i] > hh) hh = highs[i];
    if (lows[i] < ll) ll = lows[i];
  }
  return (hh + ll) / 2;
}

function ichimoku(candles: Candle[]) {
  const n = candles.length;
  if (n < 52 + 26) return null;
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const last = n - 1;
  const tenkanNow = midPrice(highs, lows, 9, last);
  const kijunNow = midPrice(highs, lows, 26, last);
  const pastIdx = last - 26;
  const tenkanPast = midPrice(highs, lows, 9, pastIdx);
  const kijunPast = midPrice(highs, lows, 26, pastIdx);
  const spanA = (tenkanPast + kijunPast) / 2;
  const spanB = midPrice(highs, lows, 52, pastIdx);
  return { tenkan: tenkanNow, kijun: kijunNow, spanA, spanB };
}

function isUsMarketOpen(): boolean {
  // 미장: 평일 UTC 14:30 ~ 21:00 (Regular Session)
  const now = new Date();
  const day = now.getUTCDay();
  if (day === 0 || day === 6) return false;
  const minutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  return minutes >= 14 * 60 + 30 && minutes <= 21 * 60;
}

async function fetchCandles(symbol: string): Promise<Candle[] | null> {
  const url = `https://api.twelvedata.com/time_series?symbol=${symbol}&interval=1min&outputsize=350&apikey=${TWELVE_DATA_API_KEY}&order=ASC`;
  try {
    const r = await fetch(url);
    const j = await r.json();
    if (j?.code === 429 || j?.status === "error") {
      console.warn(`[micro-sniper] ${symbol} TD error:`, j?.message);
      return null;
    }
    if (!j?.values || !Array.isArray(j.values)) return null;
    return j.values.map((v: any) => ({
      time: Math.floor(new Date(v.datetime).getTime() / 1000),
      open: parseFloat(v.open),
      high: parseFloat(v.high),
      low: parseFloat(v.low),
      close: parseFloat(v.close),
      volume: parseFloat(v.volume || "0"),
    })).filter((c: Candle) => Number.isFinite(c.close));
  } catch {
    return null;
  }
}

async function fetchRealtimePrice(symbol: string): Promise<number | null> {
  // Finnhub Free: 60 req/min — 안전
  try {
    const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_API_KEY}`);
    const j = await r.json();
    return typeof j.c === "number" && j.c > 0 ? j.c : null;
  } catch { return null; }
}

async function analyze(symbol: string): Promise<Signal | null> {
  const candles = await fetchCandles(symbol);
  if (!candles || candles.length < 300) return null;

  const lastCandle = candles[candles.length - 1];
  // 🚫 캔들 단계에서 $5↑면 실시간 호출 생략 (Finnhub 절약)
  if (lastCandle.close >= MAX_PRICE_USD * 1.1) return null;

  const closes = candles.map(c => c.close);
  const emaArr = calcEMA(closes, 200);
  const ema200 = emaArr[closes.length - 1];
  const ichi = ichimoku(candles);
  if (!ichi || !Number.isFinite(ema200)) return null;

  const rt = await fetchRealtimePrice(symbol);
  const currentPrice = rt ?? lastCandle.close;
  if (currentPrice >= MAX_PRICE_USD) return null;

  const openAboveEma = lastCandle.open > ema200;
  const bullishCloud = ichi.spanA > ichi.spanB;
  const aboveCloud = lastCandle.close > ichi.spanA && lastCandle.close > ichi.spanB;
  const bullish = openAboveEma && bullishCloud && aboveCloud;

  let reason = "✅ 매수 시그널 발생";
  if (!openAboveEma) reason = `Open(${lastCandle.open.toFixed(4)}) ≤ EMA200(${ema200.toFixed(4)})`;
  else if (!bullishCloud) reason = `음운 (A ${ichi.spanA.toFixed(4)} ≤ B ${ichi.spanB.toFixed(4)})`;
  else if (!aboveCloud) reason = `구름 미돌파 close ${lastCandle.close.toFixed(4)}`;

  const limitBuyPrice = +(currentPrice * 0.9905).toFixed(4);
  const takeProfitPrice = +(limitBuyPrice * 1.015).toFixed(4);

  return {
    symbol,
    currentPrice,
    lastOpen: lastCandle.open,
    lastClose: lastCandle.close,
    ema200,
    spanA: ichi.spanA,
    spanB: ichi.spanB,
    bullish,
    reason,
    limitBuyPrice,
    takeProfitPrice,
    candleCount: candles.length,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const force = !!body.force;

    // 🗄️ 캐시 우선 (5분)
    if (!force && cache && Date.now() - cache.at < CACHE_TTL_MS) {
      return new Response(JSON.stringify({ ...cache.data, cached: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 🌙 미장 폐장 시 스캔 스킵 (API 호출 0)
    const marketOpen = isUsMarketOpen();
    if (!marketOpen && cache) {
      return new Response(JSON.stringify({ ...cache.data, cached: true, marketOpen: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let symbols: string[] = (body.symbols && Array.isArray(body.symbols) && body.symbols.length)
      ? body.symbols.map((s: string) => s.toUpperCase())
      : DEFAULT_UNIVERSE;
    symbols = symbols.slice(0, MAX_SCAN_SLOTS); // 🛡️ 슬롯 강제 캡

    // 🐢 직렬 + delay = Twelve Data 1 req/sec 미만 유지
    const results: Signal[] = [];
    for (const sym of symbols) {
      const r = await analyze(sym);
      if (r) results.push(r);
      await new Promise((res) => setTimeout(res, REQ_DELAY_MS));
    }

    const signals = results.filter(r => r.bullish);
    const rejected = results.filter(r => !r.bullish);

    const data: ScanResult = {
      ok: true,
      generatedAt: new Date().toISOString(),
      scanned: results.length,
      signalCount: signals.length,
      signals,
      rejected: rejected.slice(0, 20),
      maxPriceUsd: MAX_PRICE_USD,
      marketOpen,
    };
    cache = { at: Date.now(), data };

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
