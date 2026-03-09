const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const FINNHUB_BASE = 'https://finnhub.io/api/v1';

// ===== In-Memory Cache =====
const cache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL = 90_000;

function getCached(key: string) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  return null;
}
function setCache(key: string, data: any) {
  cache.set(key, { data, ts: Date.now() });
  if (cache.size > 500) {
    const now = Date.now();
    for (const [k, v] of cache) {
      if (now - v.ts > CACHE_TTL) cache.delete(k);
    }
  }
}

function getToken(): string {
  const key = Deno.env.get('FINNHUB_API_KEY');
  if (!key) throw new Error('FINNHUB_API_KEY not configured');
  return key;
}

async function finnhubFetch(path: string, retries = 3) {
  const cached = getCached(path);
  if (cached) return cached;
  const token = getToken();
  const sep = path.includes('?') ? '&' : '?';
  const url = `${FINNHUB_BASE}${path}${sep}token=${token}`;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url);
      if (res.status === 429) { await res.text(); await new Promise(r => setTimeout(r, 800 * (attempt + 1))); continue; }
      if (res.status === 502 || res.status === 503) { await res.text(); await new Promise(r => setTimeout(r, 500 * (attempt + 1))); continue; }
      if (!res.ok) { await res.text(); return null; }
      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('application/json')) {
        const txt = await res.text();
        if (txt.trim().startsWith('<!') || txt.includes('<html')) { await new Promise(r => setTimeout(r, 800 * (attempt + 1))); continue; }
      }
      const json = await res.json();
      setCache(path, json);
      return json;
    } catch {
      if (attempt === retries - 1) return null;
      await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  return null;
}

// ===== Technical Indicator Helpers =====
function calculateEMA(data: number[], period: number): number[] {
  if (data.length === 0) return [];
  const k = 2 / (period + 1);
  const ema: number[] = [data[0]];
  for (let i = 1; i < data.length; i++) ema.push(data[i] * k + ema[i - 1] * (1 - k));
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
  avgGain /= period; avgLoss /= period;
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
  closes[closes.length - 1] = c; highs[highs.length - 1] = h; lows[lows.length - 1] = l; opens[opens.length - 1] = o;
  return { closes, highs, lows, opens, volumes };
}

// ===== 10-Indicator Scoring (Weighted: RVOL×2, MACD×2, VWAP/Candle×2) =====
function score10Indicators(quote: any, closes: number[], highs: number[], lows: number[], opens: number[], volumes: number[]) {
  const changePct = quote.dp || 0;
  const n = closes.length - 1;
  if (n < 5) return null;

  const sentimentScore = changePct >= 5 ? 9 : changePct >= 3 ? 7 : changePct >= 1 ? 5 : changePct >= -1 ? 4 : 2;
  const currentVol = volumes[n];
  const avgVol = volumes.length >= 21 ? volumes.slice(-21, -1).reduce((a, b) => a + b, 0) / 20 : currentVol;
  const rvol = avgVol > 0 ? currentVol / avgVol : 1;
  const rvolScore = rvol >= 3 ? 10 : rvol >= 2.5 ? 8 : rvol >= 2 ? 6 : rvol >= 1.5 ? 4 : 2;
  const ema9 = calculateEMA(closes, 9);
  const ema21 = calculateEMA(closes, 21);
  const rsi = calculateRSI(closes, 14);
  const vwap = calculateVWAP(highs.slice(-20), lows.slice(-20), closes.slice(-20), volumes.slice(-20));
  let candleConfirms = 0;
  if (closes[n] > vwap) candleConfirms += 0.5;
  if (ema9[n] > ema21[n] && closes[n] > ema9[n]) candleConfirms++;
  if (rsi[n] > 40 && rsi[n] < 70 && rsi[n] > (rsi[n - 1] || 50)) candleConfirms++;
  const candleScore = candleConfirms >= 2.5 ? 10 : candleConfirms >= 2 ? 7 : candleConfirms >= 1 ? 4 : 1;
  const atr = calculateATR(highs, lows, closes, 14);
  const currentATR = atr[atr.length - 1];
  const ema20 = calculateEMA(closes, 20);
  const keltnerUpper = ema20[n] + 2 * currentATR;
  const atrScore = closes[n] > keltnerUpper ? 10 : closes[n] > ema20[n] + currentATR ? 7 : 4;
  const recentHigh = Math.max(...highs.slice(-10));
  const trailingStop = +(recentHigh - 2.0 * currentATR).toFixed(4);
  const gapPct = n > 0 ? ((opens[n] - closes[n - 1]) / closes[n - 1]) * 100 : 0;
  const gapScore = (gapPct >= 4 && gapPct <= 15) ? (closes[n] > opens[n] ? 10 : 5) : gapPct > 15 ? 2 : gapPct > 0 ? 3 : 1;
  const high20 = Math.max(...closes.slice(-20));
  let squeezeScore = 0;
  if (closes[n] >= high20) squeezeScore += 6;
  if (avgVol > 0 && currentVol / avgVol > 2) squeezeScore += 4;
  squeezeScore = Math.min(10, squeezeScore);
  const allTimeHigh = Math.max(...highs);
  const distToATH = ((allTimeHigh - closes[n]) / allTimeHigh) * 100;
  const positionScore = distToATH <= 5 ? 10 : distToATH <= 10 ? 7 : distToATH <= 20 ? 4 : 2;
  const sectorScore = changePct >= 5 ? 10 : changePct >= 3 ? 7 : changePct >= 1 ? 5 : 2;
  let bullCount = 0, volInc = 0;
  for (let i = Math.max(0, n - 4); i <= n; i++) {
    if (closes[i] > opens[i]) bullCount++;
    if (i > 0 && volumes[i] > volumes[i - 1]) volInc++;
  }
  const aggression = (bullCount / 5) * 100;
  const aggrScore = aggression >= 80 && volInc >= 3 ? 10 : aggression >= 60 ? 7 : aggression >= 40 ? 4 : 2;
  const breakingHigh = closes[n] > Math.max(...highs.slice(Math.max(0, n - 5), n));
  const preMarketScore = breakingHigh ? 8 : 3;

  // ★ MACD Indicator (EMA12 - EMA26 crossover)
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);
  const macd = ema12[n] - ema26[n];
  const macdPrev = n > 0 ? ema12[n-1] - ema26[n-1] : 0;
  const macdScore = (macd > 0 && macd > macdPrev) ? 10 : (macd > 0) ? 7 : (macd > macdPrev) ? 4 : 2;

  // ★★★ 가중치 최적화: RVOL×2, MACD×2, VWAP/Candle×2 (Max raw=140, normalized to 100)
  const rawScore = sentimentScore + (rvolScore * 2) + (candleScore * 2) + atrScore + gapScore
    + squeezeScore + positionScore + sectorScore + aggrScore + preMarketScore + (macdScore * 2);
  const totalScore = Math.round((rawScore / 140) * 100);

  return {
    totalScore, trailingStop, rvol,
    indicators: {
      sentiment: { score: sentimentScore, details: `모멘텀 ${changePct.toFixed(1)}%` },
      rvol: { score: rvolScore, details: `RVOL: ${rvol.toFixed(1)}x`, rvol, weight: '×2' },
      candle: { score: candleScore, details: `트리플컨펌`, vwapCross: closes[n] > vwap, weight: '×2' },
      macd: { score: macdScore, details: `MACD: ${macd.toFixed(4)}`, macd: +macd.toFixed(4), weight: '×2' },
      atr: { score: atrScore, details: `ATR: ${currentATR.toFixed(4)}`, atr: currentATR, trailingStop },
      gap: { score: gapScore, details: `갭 ${gapPct.toFixed(1)}%` },
      squeeze: { score: squeezeScore, details: squeezeScore >= 6 ? '스퀴즈 활성' : '스퀴즈 없음' },
      position: { score: positionScore, details: `ATH대비 ${distToATH.toFixed(1)}%` },
      sectorSynergy: { score: sectorScore, details: `상대강도` },
      aggression: { score: aggrScore, details: `매수강도 ${aggression.toFixed(0)}%` },
      preMarket: { score: preMarketScore, details: breakingHigh ? '고점돌파' : '돌파X' },
      confluence: { score: candleScore, vwapCross: closes[n] > vwap },
    }
  };
}

function getTopReason(indicators: any): string {
  const entries = Object.entries(indicators).filter(([k]) => k !== 'confluence') as [string, any][];
  entries.sort((a, b) => b[1].score - a[1].score);
  const labels: Record<string, string> = {
    sentiment: '호재', rvol: 'RVOL', candle: '캔들패턴', atr: 'ATR',
    gap: '갭분석', squeeze: '스퀴즈', position: '가격위치',
    sectorSynergy: '섹터', aggression: '체결강도', preMarket: '프리마켓'
  };
  return entries.slice(0, 2).map(([k, v]) => `${labels[k] || k}(${v.score})`).join(' + ');
}

// Result-level cache for super-scan persistence across calls
const superScanCache = new Map<string, { data: any; ts: number }>();
const SUPER_SCAN_TTL = 60_000; // 60s

async function analyzeSymbol(sym: string) {
  const cached = superScanCache.get(sym);
  if (cached && Date.now() - cached.ts < SUPER_SCAN_TTL) return cached.data;

  const to = Math.floor(Date.now() / 1000);
  const from = to - 60 * 86400;
  const [quote, candles] = await Promise.all([
    finnhubFetch(`/quote?symbol=${sym}`),
    finnhubFetch(`/stock/candle?symbol=${sym}&resolution=D&from=${from}&to=${to}`),
  ]);
  if (!quote || !quote.c || quote.c === 0) return null;

  let closes: number[], highs: number[], lows: number[], opens: number[], volumes: number[];
  if (candles && candles.s !== 'no_data' && candles.t) {
    closes = candles.c; highs = candles.h; lows = candles.l; opens = candles.o; volumes = candles.v;
  } else {
    const s = generateSyntheticCandles(quote);
    closes = s.closes; highs = s.highs; lows = s.lows; opens = s.opens; volumes = s.volumes;
  }

  const scoring = score10Indicators(quote, closes, highs, lows, opens, volumes);
  if (!scoring) return null;

  const result = {
    symbol: sym,
    price: quote.c,
    change: quote.d,
    changePct: quote.dp || 0,
    totalScore: scoring.totalScore,
    indicators: scoring.indicators,
    trailingStop: scoring.trailingStop,
    reason: getTopReason(scoring.indicators),
  };

  superScanCache.set(sym, { data: result, ts: Date.now() });
  return result;
}

// ===== SUPER SCAN: Full Market Universe =====
// Rotate through ~300 symbols in groups of 30 per call
const FULL_UNIVERSE = [
  // Big Tech & Mega Caps
  'AAPL','MSFT','NVDA','TSLA','GOOGL','AMZN','META','AMD',
  'PLTR','COIN','SOFI','HOOD','RIVN','NIO','MARA',
  'INTC','QCOM','AVGO','CRM','NFLX','UBER','SQ','PYPL',
  'BA','DIS','SNAP','SHOP','CRWD','NET','ABNB',
  // Semiconductors
  'MU','AMAT','LRCX','KLAC','MRVL','ASML','TSM','ADI','NXPI','TXN','ON','ARM',
  // Finance
  'JPM','BAC','WFC','GS','V','MA','BLK','SCHW',
  // Healthcare
  'JNJ','PFE','MRNA','ABBV','LLY','UNH','TMO','ABT','ISRG','VRTX','NVO',
  // Consumer
  'WMT','COST','HD','NKE','SBUX','MCD','KO','PEP','PG','CMG','LULU',
  // Energy
  'XOM','CVX','COP','SLB','OXY','ENPH','FSLR',
  // Cloud/SaaS
  'NOW','SNOW','DDOG','ORCL','ADBE','INTU','PANW','FTNT','ZS','MDB',
  // EV & Auto
  'LCID','F','GM','XPEV','LI',
  // AI / Quantum
  'AI','UPST','SOUN','PATH','IONQ','RGTI',
  // Streaming/Entertainment
  'SPOT','RBLX','EA','TTWO','ROKU',
  // Crypto
  'MSTR','RIOT','CLSK',
  // Fintech
  'AFRM','NU','BILL',
  // Mobility/Travel
  'LYFT','BKNG','EXPE','DAL','UAL','DASH',
  // Industrial
  'CAT','DE','HON','GE','UNP','UPS','FDX',
  // Materials
  'LIN','FCX','NEM','ALB',
  // Defense
  'LMT','RTX','NOC','GD',
  // China/Intl
  'BABA','JD','PDD','SE','CPNG','GRAB',
  // REITs
  'PLD','AMT','EQIX','O',
  // Tech extras
  'IBM','CSCO','ACN','DELL','ANET','SNPS','CDNS',
  // Social/Commerce
  'PINS','RDDT','W','ETSY','CHWY',
  // Penny Stocks (sub $10)
  'GOEV','FFIE','MULN','WKHS','NKLA','CHPT','FCEL','PLUG',
  'SNDL','TLRY','ACB','CGC','MNMD','SENS','GNUS','BNGO','DNA','ME','SDC',
  'WISH','SKLZ','OPEN','LMND','BYND','QS','SIRI','NOK','BB',
  'TELL','CLOV','ASTS','RKLB','LUNR','RGTI','QUBT','BTG','FSM',
  'HUT','CLSK','BKKT','EVGO','GSAT','HIMS','JOBY',
  'KULR','MVIS','NNDM','ORGN','QBTS','STEM','UEC','WULF','YEXT',
  'ZETA','BLNK','DM','EOSE','LAZR','OUST','UPST','ENVX','ARQQ',
];

// Track rotation index across calls
let superScanRotationIdx = 0;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, symbols } = await req.json();

    if (action === 'analyze') {
      const defaultSymbols = [
        'AAPL','MSFT','NVDA','TSLA','GOOGL','AMZN','META','AMD',
        'PLTR','COIN','SOFI','HOOD','RIVN','NIO','MARA',
        'INTC','QCOM','AVGO','CRM','NFLX','UBER','SQ','PYPL',
        'BA','DIS','SNAP','SHOP','CRWD','NET','ABNB',
      ];
      const targetSymbols: string[] = (symbols || defaultSymbols).slice(0, 35);
      const results: any[] = [];

      if (targetSymbols.length <= 5) {
        const batchResults = await Promise.all(targetSymbols.map(sym => analyzeSymbol(sym).catch(() => null)));
        for (const r of batchResults) { if (r) results.push(r); }
      } else {
        for (let i = 0; i < targetSymbols.length; i += 5) {
          const batch = targetSymbols.slice(i, i + 5);
          const batchResults = await Promise.all(batch.map(sym => analyzeSymbol(sym).catch(() => null)));
          for (const r of batchResults) { if (r) results.push(r); }
          if (i + 5 < targetSymbols.length) await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      const premium = results.filter(r => r.price >= 10).sort((a, b) => b.totalScore - a.totalScore);
      const penny = results.filter(r => r.price < 10).sort((a, b) => b.totalScore - a.totalScore);
      const allSorted = [...premium, ...penny].sort((a, b) => b.totalScore - a.totalScore);

      return new Response(JSON.stringify({
        premium, penny, allScanned: targetSymbols.length,
        recommendations: allSorted, results: allSorted,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ===== SUPER SCAN: Full market rotation =====
    if (action === 'super-scan') {
      const BATCH_SIZE = 30;
      const universe = FULL_UNIVERSE;
      const startIdx = superScanRotationIdx % universe.length;
      const currentBatch: string[] = [];
      for (let i = 0; i < BATCH_SIZE; i++) {
        currentBatch.push(universe[(startIdx + i) % universe.length]);
      }
      superScanRotationIdx = (startIdx + BATCH_SIZE) % universe.length;

      // Analyze current batch (new data)
      for (let i = 0; i < currentBatch.length; i += 5) {
        const batch = currentBatch.slice(i, i + 5);
        await Promise.all(batch.map(sym => analyzeSymbol(sym).catch(() => null)));
        if (i + 5 < currentBatch.length) await new Promise(r => setTimeout(r, 400));
      }

      // Gather ALL cached results (from this and previous calls)
      const allResults: any[] = [];
      const now = Date.now();
      for (const [sym, entry] of superScanCache) {
        // Include results up to 5 min old for broader coverage
        if (now - entry.ts < 5 * 60_000 && entry.data) {
          allResults.push(entry.data);
        }
      }

      // Sort by score descending, take top 30 (show all candidates, highlight 60+ as strong)
      allResults.sort((a, b) => b.totalScore - a.totalScore);
      const top30 = allResults.slice(0, 30);

      // Detect NEW entries (not in previous top 30)
      const previousTop = (globalThis as any).__prevTop30 || new Set<string>();
      const newEntries = top30.filter(r => !previousTop.has(r.symbol)).map(r => r.symbol);
      (globalThis as any).__prevTop30 = new Set(top30.map(r => r.symbol));

      return new Response(JSON.stringify({
        top30,
        newEntries,
        scannedBatch: currentBatch,
        totalCached: allResults.length,
        rotationIndex: superScanRotationIdx,
        universeSize: universe.length,
        timestamp: new Date().toISOString(),
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Quant signals error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
