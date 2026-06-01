// Micro-Sniper Edge Function
// 미국 주식 <$5 종목을 1분봉 300개로 스캔, EMA200 + Ichimoku 양운 돌파 시그널 산출
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const TWELVE_DATA_API_KEY = Deno.env.get("TWELVE_DATA_API_KEY")!;
const FINNHUB_API_KEY = Deno.env.get("FINNHUB_API_KEY")!;
const MAX_PRICE_USD = 5;

interface Candle {
  time: number;
  open: number; high: number; low: number; close: number;
  volume?: number;
}

// ===== 기본 유니버스 (저가 미국주) — 필요 시 동적 확장 =====
const DEFAULT_UNIVERSE = [
  "SOFI", "NIO", "PLUG", "F", "BBD", "ITUB", "VALE", "GRAB", "LCID", "RIG",
  "AAL", "SIRI", "AMC", "MARA", "RIOT", "CIFR", "WULF", "BTBT", "HUT", "BITF",
  "OPEN", "JOBY", "EVGO", "CHPT", "BLNK", "RIVN", "FCEL", "BNGO", "SNDL", "TLRY",
];

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

async function fetchCandles(symbol: string): Promise<Candle[] | null> {
  // Twelve Data: 1min, 300+ bars
  const url = `https://api.twelvedata.com/time_series?symbol=${symbol}&interval=1min&outputsize=350&apikey=${TWELVE_DATA_API_KEY}&order=ASC`;
  try {
    const r = await fetch(url);
    const j = await r.json();
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
  try {
    const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_API_KEY}`);
    const j = await r.json();
    return typeof j.c === "number" && j.c > 0 ? j.c : null;
  } catch { return null; }
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

async function analyze(symbol: string): Promise<Signal | null> {
  const candles = await fetchCandles(symbol);
  if (!candles || candles.length < 300) return null;

  const closes = candles.map(c => c.close);
  const emaArr = calcEMA(closes, 200);
  const last = candles.length - 1;
  const ema200 = emaArr[last];
  const ichi = ichimoku(candles);
  if (!ichi || !Number.isFinite(ema200)) return null;

  const lastCandle = candles[last];
  if (lastCandle.close >= MAX_PRICE_USD) return null;

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
    const symbols: string[] = (body.symbols && Array.isArray(body.symbols) && body.symbols.length)
      ? body.symbols.map((s: string) => s.toUpperCase())
      : DEFAULT_UNIVERSE;

    // Twelve Data rate limit 고려 — 동시 5개씩
    const results: Signal[] = [];
    for (let i = 0; i < symbols.length; i += 5) {
      const batch = symbols.slice(i, i + 5);
      const settled = await Promise.allSettled(batch.map(analyze));
      for (const s of settled) {
        if (s.status === "fulfilled" && s.value) results.push(s.value);
      }
    }

    const signals = results.filter(r => r.bullish);
    const rejected = results.filter(r => !r.bullish);

    return new Response(JSON.stringify({
      ok: true,
      generatedAt: new Date().toISOString(),
      scanned: results.length,
      signalCount: signals.length,
      signals,
      rejected: rejected.slice(0, 20),
      maxPriceUsd: MAX_PRICE_USD,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
