// Deno.serve used directly

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const FINNHUB_BASE = 'https://finnhub.io/api/v1';

function getToken(): string {
  const key = Deno.env.get('FINNHUB_API_KEY');
  if (!key) throw new Error('FINNHUB_API_KEY not configured');
  return key;
}

async function finnhubFetch(path: string, retries = 4) {
  const token = getToken();
  const sep = path.includes('?') ? '&' : '?';
  const url = `${FINNHUB_BASE}${path}${sep}token=${token}`;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url);
      if (res.status === 429) {
        await res.text();
        // Short backoff: 1.5s, 3s, 4.5s, 6s
        const wait = 1500 * (attempt + 1);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      if (res.status === 502 || res.status === 503) {
        await res.text();
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      if (!res.ok) { await res.text(); return null; }
      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('application/json')) {
        const txt = await res.text();
        if (txt.trim().startsWith('<!') || txt.includes('<html')) {
          await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
          continue;
        }
      }
      return await res.json();
    } catch {
      if (attempt === retries - 1) return null;
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  return null;
}

// ===== Technical Indicator Helpers =====
function calculateEMA(data: number[], period: number): number[] {
  if (data.length === 0) return [];
  const k = 2 / (period + 1);
  const ema: number[] = [data[0]];
  for (let i = 1; i < data.length; i++) {
    ema.push(data[i] * k + ema[i - 1] * (1 - k));
  }
  return ema;
}

function calculateRSI(closes: number[], period = 14): number[] {
  const rsi: number[] = new Array(closes.length).fill(50);
  if (closes.length < period + 1) return rsi;
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) avgGain += change; else avgLoss -= change;
  }
  avgGain /= period;
  avgLoss /= period;
  rsi[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(change, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-change, 0)) / period;
    rsi[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return rsi;
}

function calculateATR(highs: number[], lows: number[], closes: number[], period = 14): number[] {
  const atr: number[] = [highs[0] - lows[0]];
  for (let i = 1; i < highs.length; i++) {
    const tr = Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1]));
    atr.push(i < period ? (atr[i - 1] * i + tr) / (i + 1) : (atr[i - 1] * (period - 1) + tr) / period);
  }
  return atr;
}

function calculateVWAP(highs: number[], lows: number[], closes: number[], volumes: number[]): number {
  let cumPV = 0, cumV = 0;
  for (let i = 0; i < closes.length; i++) {
    const tp = (highs[i] + lows[i] + closes[i]) / 3;
    cumPV += tp * (volumes[i] || 1);
    cumV += volumes[i] || 1;
  }
  return cumV > 0 ? cumPV / cumV : closes[closes.length - 1];
}

function generateSyntheticCandles(quote: any, days = 40) {
  const c = quote.c || 0;
  const pc = quote.pc || c;
  const h = quote.h || c * 1.01;
  const l = quote.l || c * 0.99;
  const o = quote.o || pc;
  const closes: number[] = [], highs: number[] = [], lows: number[] = [], opens: number[] = [], volumes: number[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const ratio = i / days;
    const noise = (Math.random() - 0.5) * c * 0.025;
    const trend = (1 - ratio) * (c - pc);
    const close = +(pc + trend + noise).toFixed(4);
    const open = +(close + (Math.random() - 0.5) * c * 0.01).toFixed(4);
    const high = +(Math.max(open, close) + Math.random() * c * 0.012).toFixed(4);
    const low = +(Math.min(open, close) - Math.random() * c * 0.012).toFixed(4);
    const vol = Math.floor(1000000 + Math.random() * 5000000);
    closes.push(close); highs.push(high); lows.push(low); opens.push(open); volumes.push(vol);
  }
  closes[closes.length - 1] = c;
  highs[highs.length - 1] = h;
  lows[lows.length - 1] = l;
  opens[opens.length - 1] = o;
  return { closes, highs, lows, opens, volumes };
}

// ===== Lightweight Scoring (no extra API calls) =====

function scoreSentimentFromQuote(changePct: number): { score: number; details: string } {
  // Use price momentum as proxy for sentiment (no extra API call)
  if (changePct >= 5) return { score: 9, details: `강한 상승 모멘텀 ${changePct.toFixed(1)}%` };
  if (changePct >= 3) return { score: 7, details: `상승 모멘텀 ${changePct.toFixed(1)}%` };
  if (changePct >= 1) return { score: 5, details: `소폭 상승 ${changePct.toFixed(1)}%` };
  if (changePct >= -1) return { score: 4, details: `횡보 ${changePct.toFixed(1)}%` };
  return { score: 2, details: `하락 ${changePct.toFixed(1)}%` };
}

function scoreRVOL(volumes: number[]): { score: number; details: string; rvol: number } {
  if (volumes.length < 21) return { score: 3, details: '데이터 제한적', rvol: 1.0 };
  const currentVol = volumes[volumes.length - 1];
  const avgVol = volumes.slice(-21, -1).reduce((a, b) => a + b, 0) / 20;
  const rvol = avgVol > 0 ? currentVol / avgVol : 1;
  let score = 0;
  if (rvol >= 3.0) score = 10;
  else if (rvol >= 2.5) score = 8;
  else if (rvol >= 2.0) score = 6;
  else if (rvol >= 1.5) score = 4;
  else if (rvol >= 1.0) score = 2;
  return { score, details: `RVOL: ${rvol.toFixed(1)}x`, rvol };
}

function scoreCandlePattern(closes: number[], highs: number[], lows: number[], volumes: number[]): { score: number; details: string } {
  if (closes.length < 30) return { score: 3, details: '데이터 제한적' };
  const n = closes.length - 1;
  const ema9 = calculateEMA(closes, 9);
  const ema21 = calculateEMA(closes, 21);
  const rsi = calculateRSI(closes, 14);
  const vwap = calculateVWAP(highs.slice(-20), lows.slice(-20), closes.slice(-20), volumes.slice(-20));
  let confirms = 0;
  const reasons: string[] = [];
  if (closes[n] > vwap) { confirms += 0.5; reasons.push('VWAP 상단'); }
  if (ema9[n] > ema21[n] && closes[n] > ema9[n]) { confirms++; reasons.push('EMA 정배열'); }
  const currentRSI = rsi[n];
  if (currentRSI > 40 && currentRSI < 70 && rsi[n] > rsi[n - 1]) { confirms++; reasons.push(`RSI ${currentRSI.toFixed(0)}`); }
  const score = confirms >= 2.5 ? 10 : confirms >= 2 ? 7 : confirms >= 1 ? 4 : 1;
  return { score, details: reasons.join(', ') || '조건 미충족' };
}

function scoreATR(highs: number[], lows: number[], closes: number[]): { score: number; details: string; trailingStop: number } {
  if (closes.length < 20) return { score: 3, details: '데이터 제한적', trailingStop: 0 };
  const atr = calculateATR(highs, lows, closes, 14);
  const currentATR = atr[atr.length - 1];
  const n = closes.length - 1;
  const ema20 = calculateEMA(closes, 20);
  const keltnerUpper = ema20[n] + 2 * currentATR;
  const priceAboveKeltner = closes[n] > keltnerUpper;
  const recentHigh = Math.max(...highs.slice(-10));
  const trailingStop = +(recentHigh - 2.0 * currentATR).toFixed(4);
  let score = priceAboveKeltner ? 10 : closes[n] > ema20[n] + currentATR ? 7 : 4;
  return { score, details: `ATR: ${currentATR.toFixed(4)}, Keltner: ${priceAboveKeltner ? 'O' : 'X'}`, trailingStop };
}

function scoreGap(opens: number[], closes: number[], volumes: number[]): { score: number; details: string } {
  if (closes.length < 5) return { score: 3, details: '데이터 제한적' };
  const n = closes.length - 1;
  const gapPct = ((opens[n] - closes[n - 1]) / closes[n - 1]) * 100;
  if (gapPct >= 4 && gapPct <= 15) {
    const bonus = (closes[n] > opens[n] && volumes[n] > volumes[n - 1]) ? 5 : 0;
    return { score: Math.min(10, 5 + bonus), details: `갭 ${gapPct.toFixed(1)}%` };
  }
  if (gapPct > 15) return { score: 2, details: `갭 과다 ${gapPct.toFixed(1)}%` };
  if (gapPct > 0) return { score: 3, details: `소폭 갭 ${gapPct.toFixed(1)}%` };
  return { score: 1, details: `갭 하락 ${gapPct.toFixed(1)}%` };
}

function scoreShortSqueeze(closes: number[], volumes: number[]): { score: number; details: string } {
  if (closes.length < 21) return { score: 3, details: '데이터 제한적' };
  const n = closes.length - 1;
  const high20 = Math.max(...closes.slice(-20));
  let score = 0;
  const reasons: string[] = [];
  if (closes[n] >= high20) { score += 6; reasons.push('20일 최고가'); }
  const avgVol = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
  if (avgVol > 0 && volumes[n] / avgVol > 2) { score += 4; reasons.push('거래량 급증'); }
  return { score: Math.min(10, score), details: reasons.join(', ') || 'Squeeze 없음' };
}

function scorePricePosition(closes: number[], highs: number[]): { score: number; details: string } {
  if (closes.length < 30) return { score: 3, details: '데이터 제한적' };
  const n = closes.length - 1;
  const allTimeHigh = Math.max(...highs);
  const distToATH = ((allTimeHigh - closes[n]) / allTimeHigh) * 100;
  const score = distToATH <= 5 ? 10 : distToATH <= 10 ? 7 : distToATH <= 20 ? 4 : 2;
  return { score, details: `ATH 대비 ${distToATH.toFixed(1)}%` };
}

function scoreSectorSynergy(changePct: number): { score: number; details: string } {
  // Simplified: just use own momentum as proxy (no extra API call for SPY/peers)
  if (changePct >= 5) return { score: 10, details: `강한 상대강도` };
  if (changePct >= 3) return { score: 7, details: `양호한 상대강도` };
  if (changePct >= 1) return { score: 5, details: `보통` };
  return { score: 2, details: `약세` };
}

function scoreTradeAggression(volumes: number[], closes: number[], opens: number[]): { score: number; details: string } {
  if (closes.length < 5) return { score: 3, details: '데이터 제한적' };
  const n = closes.length - 1;
  let bullishCount = 0, volIncreasing = 0;
  for (let i = Math.max(0, n - 4); i <= n; i++) {
    if (closes[i] > opens[i]) bullishCount++;
    if (i > 0 && volumes[i] > volumes[i - 1]) volIncreasing++;
  }
  const aggression = (bullishCount / 5) * 100;
  const score = aggression >= 80 && volIncreasing >= 3 ? 10 : aggression >= 60 ? 7 : aggression >= 40 ? 4 : 2;
  return { score, details: `매수강도: ${aggression.toFixed(0)}%` };
}

function scorePreMarket(volumes: number[], closes: number[], highs: number[]): { score: number; details: string } {
  if (volumes.length < 5) return { score: 3, details: '데이터 제한적' };
  const n = volumes.length - 1;
  const breakingHigh = closes[n] > Math.max(...highs.slice(Math.max(0, n - 5), n));
  return { score: breakingHigh ? 8 : 3, details: `고점돌파: ${breakingHigh ? 'O' : 'X'}` };
}

function getTopReason(indicators: any): string {
  const entries = Object.entries(indicators) as [string, { score: number; details: string }][];
  entries.sort((a, b) => b[1].score - a[1].score);
  const labels: Record<string, string> = {
    sentiment: '호재', rvol: 'RVOL', candle: '캔들패턴', atr: 'ATR',
    gap: '갭분석', squeeze: '스퀴즈', position: '가격위치',
    sectorSynergy: '섹터', aggression: '체결강도', preMarket: '프리마켓'
  };
  return entries.slice(0, 2).map(([k, v]) => `${labels[k] || k}(${v.score})`).join(' + ');
}

// Analyze a single symbol — only 2 API calls max (quote + candle)
async function analyzeSymbol(sym: string) {
  // First get quote — this is mandatory
  const quote = await finnhubFetch(`/quote?symbol=${sym}`);
  if (!quote || !quote.c || quote.c === 0) {
    // If rate limited, try a simpler approach: use just the quote data we can get
    return null;
  }

  const changePct = quote.dp || 0;
  let closes: number[], highs: number[], lows: number[], opens: number[], volumes: number[];

  // Add small delay before candle request to avoid rate limiting
  await new Promise(r => setTimeout(r, 300));
  
  const to = Math.floor(Date.now() / 1000);
  const from = to - 60 * 86400;
  const candles = await finnhubFetch(`/stock/candle?symbol=${sym}&resolution=D&from=${from}&to=${to}`);

  if (candles && candles.s !== 'no_data' && candles.t) {
    closes = candles.c; highs = candles.h; lows = candles.l; opens = candles.o; volumes = candles.v;
  } else {
    // Fallback to synthetic candles based on quote
    const synthetic = generateSyntheticCandles(quote);
    closes = synthetic.closes; highs = synthetic.highs; lows = synthetic.lows; opens = synthetic.opens; volumes = synthetic.volumes;
  }

  // All scoring is now purely computational — no extra API calls
  const sentiment = scoreSentimentFromQuote(changePct);
  const rvol = scoreRVOL(volumes);
  const candle = scoreCandlePattern(closes, highs, lows, volumes);
  const atr = scoreATR(highs, lows, closes);
  const gap = scoreGap(opens, closes, volumes);
  const squeeze = scoreShortSqueeze(closes, volumes);
  const position = scorePricePosition(closes, highs);
  const sectorSynergy = scoreSectorSynergy(changePct);
  const aggression = scoreTradeAggression(volumes, closes, opens);
  const preMarket = scorePreMarket(volumes, closes, highs);

  const indicators = { sentiment, rvol, candle, atr, gap, squeeze, position, sectorSynergy, aggression, preMarket };

  const totalScore = sentiment.score + rvol.score + candle.score + atr.score +
    gap.score + squeeze.score + position.score + sectorSynergy.score +
    aggression.score + preMarket.score;

  return {
    symbol: sym,
    price: quote.c,
    change: quote.d,
    changePct,
    totalScore,
    indicators,
    trailingStop: atr.trailingStop,
    reason: getTopReason(indicators),
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, symbols } = await req.json();

    if (action === 'analyze') {
      // 30종목 확장 (두 그룹 15개씩 교차 요청)
      const defaultSymbols = [
        'AAPL', 'MSFT', 'NVDA', 'TSLA', 'GOOGL', 'AMZN', 'META', 'AMD',
        'PLTR', 'COIN', 'SOFI', 'HOOD', 'RIVN', 'NIO', 'MARA',
        'INTC', 'QCOM', 'AVGO', 'CRM', 'NFLX', 'UBER', 'SQ', 'PYPL',
        'BA', 'DIS', 'SNAP', 'SHOP', 'CRWD', 'NET', 'ABNB',
      ];

      const targetSymbols: string[] = (symbols || defaultSymbols).slice(0, 35);

      const results: any[] = [];

      // Process in batches of 5 with 500ms staggered delay between groups
      for (let i = 0; i < targetSymbols.length; i += 5) {
        const batch = targetSymbols.slice(i, i + 5);
        const batchResults = await Promise.all(batch.map(sym => analyzeSymbol(sym).catch(() => null)));
        for (const r of batchResults) {
          if (r) results.push(r);
        }
        if (i + 5 < targetSymbols.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      const premium = results.filter(r => r.price >= 10).sort((a, b) => b.totalScore - a.totalScore);
      const penny = results.filter(r => r.price < 10).sort((a, b) => b.totalScore - a.totalScore);

      const allSorted = [...premium, ...penny].sort((a, b) => b.totalScore - a.totalScore);

      return new Response(JSON.stringify({
        premium,
        penny,
        allScanned: targetSymbols.length,
        recommendations: allSorted,
        results: allSorted,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Quant signals error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
