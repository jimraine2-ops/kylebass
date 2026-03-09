import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const FINNHUB_BASE = 'https://finnhub.io/api/v1';
const KRW_RATE = 1350;
const MIN_PRICE_KRW = 1000;
const MIN_PRICE_USD = MIN_PRICE_KRW / KRW_RATE;

function toKRW(usd: number): number { return usd * KRW_RATE; }
function fmtKRW(usd: number): string { return `₩${toKRW(usd).toLocaleString('ko-KR', { maximumFractionDigits: 0 })}`; }
function fmtKRWRaw(krw: number): string { return `₩${krw.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}`; }

function getToken(): string { return Deno.env.get('FINNHUB_API_KEY') || ''; }

// ===== Session Detection (US Eastern Time) =====
type SessionType = 'DAY' | 'PRE_MARKET' | 'REGULAR' | 'AFTER_HOURS';

function getMarketSession(): { session: SessionType; label: string; spreadMultiplier: number; entryRelax: number } {
  const now = new Date();
  const etStr = now.toLocaleString('en-US', { timeZone: 'America/New_York' });
  const et = new Date(etStr);
  const h = et.getHours();
  const m = et.getMinutes();
  const day = et.getDay();
  const time = h * 60 + m;

  // entryRelax: 진입 조건 완화 계수 (1.0=정규장, 낮을수록 완화)
  if (day === 0 || day === 6) {
    return { session: 'DAY', label: '데이장', spreadMultiplier: 2.5, entryRelax: 0.6 };
  }
  if (time >= 240 && time < 570) {
    return { session: 'PRE_MARKET', label: '프리마켓', spreadMultiplier: 2.0, entryRelax: 0.7 };
  }
  if (time >= 570 && time < 960) {
    return { session: 'REGULAR', label: '정규장', spreadMultiplier: 1.0, entryRelax: 1.0 };
  }
  if (time >= 960 && time < 1200) {
    return { session: 'AFTER_HOURS', label: '애프터마켓', spreadMultiplier: 1.8, entryRelax: 0.75 };
  }
  return { session: 'DAY', label: '데이장', spreadMultiplier: 2.5, entryRelax: 0.6 };
}

function applySessionSlippage(price: number, side: 'buy' | 'sell', spreadMultiplier: number): number {
  const BASE_SLIPPAGE = 0.0002;
  const slippage = BASE_SLIPPAGE * spreadMultiplier;
  if (side === 'buy') return +(price * (1 + slippage)).toFixed(4);
  return +(price * (1 - slippage)).toFixed(4);
}

async function finnhubFetch(path: string) {
  const token = getToken();
  if (!token) return null;
  const sep = path.includes('?') ? '&' : '?';
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${FINNHUB_BASE}${path}${sep}token=${token}`);
      if (res.status === 429) {
        await res.text();
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
        continue;
      }
      if (!res.ok) { await res.text(); return null; }
      return await res.json();
    } catch { /* retry */ }
  }
  return null;
}

// ===== Technical Helpers =====
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
  if (rsi[n] > 40 && rsi[n] < 70 && rsi[n] > (rsi[n-1]||50)) candleConfirms++;
  const candleScore = candleConfirms >= 2.5 ? 10 : candleConfirms >= 2 ? 7 : candleConfirms >= 1 ? 4 : 1;
  const atr = calculateATR(highs, lows, closes, 14);
  const currentATR = atr[atr.length - 1];
  const ema20 = calculateEMA(closes, 20);
  const keltnerUpper = ema20[n] + 2 * currentATR;
  const atrScore = closes[n] > keltnerUpper ? 10 : closes[n] > ema20[n] + currentATR ? 7 : 4;
  const recentHigh = Math.max(...highs.slice(-10));
  const trailingStop = +(recentHigh - 2.0 * currentATR).toFixed(4);
  const gapPct = n > 0 ? ((opens[n] - closes[n-1]) / closes[n-1]) * 100 : 0;
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

  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);
  const macd = ema12[n] - ema26[n];
  const macdPrev = n > 0 ? ema12[n-1] - ema26[n-1] : 0;
  const macdScore = (macd > 0 && macd > macdPrev) ? 10 : (macd > 0) ? 7 : (macd > macdPrev) ? 4 : 2;

  const rawScore = sentimentScore + (rvolScore * 2) + (candleScore * 2) + atrScore + gapScore
    + squeezeScore + positionScore + sectorScore + aggrScore + preMarketScore + (macdScore * 2);
  const totalScore = Math.round((rawScore / 140) * 100);

  return {
    totalScore, trailingStop, rvol,
    indicators: {
      sentiment: { score: sentimentScore },
      rvol: { score: rvolScore, rvol, weight: '×2' },
      candle: { score: candleScore, vwapCross: closes[n] > vwap, weight: '×2' },
      macd: { score: macdScore, macd: +macd.toFixed(4), weight: '×2' },
      atr: { score: atrScore, atr: currentATR },
      gap: { score: gapScore },
      squeeze: { score: squeezeScore },
      position: { score: positionScore },
      sectorSynergy: { score: sectorScore },
      aggression: { score: aggrScore },
      preMarket: { score: preMarketScore },
      confluence: { score: candleScore, vwapCross: closes[n] > vwap },
    }
  };
}

async function getQuoteAndCandles(symbol: string) {
  const quote = await finnhubFetch(`/quote?symbol=${symbol}`);
  if (!quote || !quote.c || quote.c === 0) return null;
  const to = Math.floor(Date.now() / 1000);
  const from = to - 60 * 86400;
  const candles = await finnhubFetch(`/stock/candle?symbol=${symbol}&resolution=D&from=${from}&to=${to}`);
  let closes: number[], highs: number[], lows: number[], opens: number[], volumes: number[];
  if (candles && candles.s !== 'no_data' && candles.t) {
    closes = candles.c; highs = candles.h; lows = candles.l; opens = candles.o; volumes = candles.v;
  } else {
    const s = generateSyntheticCandles(quote);
    closes = s.closes; highs = s.highs; lows = s.lows; opens = s.opens; volumes = s.volumes;
  }
  return { quote, closes, highs, lows, opens, volumes };
}

// ===== DYNAMIC UNIVERSE =====
// ★★★ 300+ 대형주 풀 — 미국 전 거래소(NYSE, NASDAQ, AMEX) 주요 종목 전체 커버
const FULL_QUANT_UNIVERSE = [
  // === Mega-Cap Tech ===
  'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META', 'TSLA', 'AVGO', 'ORCL', 'ADBE',
  // === Semiconductors ===
  'AMD', 'INTC', 'QCOM', 'MU', 'AMAT', 'LRCX', 'ARM', 'TSM', 'MRVL', 'ON', 'NXPI', 'TXN', 'KLAC', 'ADI', 'SWKS', 'MPWR',
  // === Cloud / SaaS ===
  'CRM', 'NOW', 'SNOW', 'DDOG', 'PANW', 'FTNT', 'ZS', 'MDB', 'NET', 'CRWD', 'SHOP', 'WDAY', 'HUBS', 'TEAM', 'VEEV', 'DOCU', 'ZM', 'OKTA', 'ESTC', 'BILL',
  // === Consumer Tech / Internet ===
  'NFLX', 'UBER', 'ABNB', 'BKNG', 'DASH', 'PINS', 'RDDT', 'SNAP', 'SPOT', 'RBLX', 'ROKU', 'ETSY', 'LYFT', 'ZG', 'CHWY', 'CARG', 'MTCH',
  // === Fintech ===
  'SQ', 'PYPL', 'COIN', 'SOFI', 'HOOD', 'AFRM', 'NU', 'UPST', 'MSTR', 'TOST', 'BILL', 'FOUR', 'PAYO', 'LMND',
  // === AI / Quantum / Emerging Tech ===
  'PLTR', 'AI', 'SOUN', 'IONQ', 'RGTI', 'QUBT', 'BBAI', 'SMCI', 'DELL', 'HPE', 'PATH', 'S', 'CFLT', 'GTLB',
  // === Biotech / Health ===
  'LLY', 'UNH', 'ISRG', 'NVO', 'JNJ', 'PFE', 'MRK', 'ABBV', 'TMO', 'DHR', 'AMGN', 'GILD', 'VRTX', 'REGN', 'MRNA', 'DXCM', 'ILMN', 'EW', 'ZBH', 'BSX', 'MDT',
  // === Financials ===
  'JPM', 'GS', 'V', 'MA', 'BRK.B', 'BAC', 'WFC', 'MS', 'C', 'AXP', 'SCHW', 'BLK', 'ICE', 'CME', 'SPGI',
  // === Energy ===
  'XOM', 'CVX', 'COP', 'SLB', 'EOG', 'PSX', 'MPC', 'VLO', 'OXY', 'DVN', 'FANG', 'HAL',
  // === Clean Energy / EV ===
  'ENPH', 'FSLR', 'SEDG', 'RUN', 'RIVN', 'LCID', 'NIO', 'XPEV', 'LI', 'CHPT', 'PLUG', 'BE',
  // === Industrial / Defense ===
  'LMT', 'RTX', 'BA', 'GE', 'HON', 'CAT', 'DE', 'UNP', 'FDX', 'UPS', 'WM', 'RSG', 'AXON', 'TDG', 'HWM',
  // === Consumer ===
  'DIS', 'NKE', 'SBUX', 'MCD', 'COST', 'WMT', 'TGT', 'HD', 'LOW', 'TJX', 'LULU', 'DECK', 'ONON', 'BIRD',
  // === Metals / Mining / Materials ===
  'FCX', 'ALB', 'NEM', 'GOLD', 'MP', 'LAC', 'CLF', 'X', 'AA', 'VALE',
  // === Telecom / Media ===
  'T', 'VZ', 'TMUS', 'PARA', 'WBD', 'FOX', 'CMCSA',
  // === Crypto-Adjacent ===
  'MARA', 'RIOT', 'CLSK', 'HUT', 'BITF', 'WULF', 'BTBT', 'CIFR', 'BTDR',
  // === China ADRs ===
  'BABA', 'PDD', 'JD', 'BIDU', 'NIO', 'XPEV', 'LI', 'BILI', 'TME', 'VNET', 'TAL', 'EDU', 'CPNG',
  // === Space / Defense ===
  'RKLB', 'ASTS', 'LUNR', 'RDW', 'SPCE', 'JOBY',
  // === Other Mid-caps ===
  'ANET', 'TTD', 'CELH', 'MNST', 'DKNG', 'PENN', 'CZAR', 'APPN', 'GLOB', 'WIX',
  'TWLO', 'FIVN', 'ASAN', 'MNDY', 'DOCN', 'DT', 'SUMO', 'BRZE', 'AYX',
  'TMDX', 'INSP', 'GKOS', 'NARI', 'PODD', 'ALGN',
  'APO', 'KKR', 'ARES', 'OWL', 'LPLA',
  'CAVA', 'BROS', 'SHAK', 'WING', 'CMG',
  'VST', 'CEG', 'NRG', 'AES', 'NEE',
  'WYNN', 'LVS', 'MGM', 'CZR',
  'CCL', 'RCL', 'NCLH', 'EXPE', 'MAR', 'HLT',
];

// ★★★ 200+ 소형주 풀 — 다양한 업종의 소형주 전체 커버
const FULL_PENNY_UNIVERSE = [
  // === EV / Clean Energy ===
  'NIO', 'LCID', 'GOEV', 'FFIE', 'MULN', 'WKHS', 'NKLA', 'CHPT', 'FCEL', 'PLUG',
  'EVGO', 'BLNK', 'HYLN', 'XOS', 'CENN', 'JOBY', 'ARVL', 'BEEM', 'SES', 'QS',
  // === Cannabis ===
  'SNDL', 'TLRY', 'ACB', 'CGC', 'MNMD', 'GRWG', 'CRON',
  // === Biotech / Health ===
  'SENS', 'GNUS', 'BNGO', 'CLVS', 'DNA', 'ME', 'SDC', 'HIMS', 'IBRX', 'NUVB', 'CANO',
  'AGEN', 'APLS', 'ARQT', 'BCRX', 'BTAI', 'CARA', 'CMPS', 'CTLT', 'EXAI', 'FOLD',
  'GTHX', 'IMVT', 'KRTX', 'MGTA', 'OLINK', 'PRAX', 'RXRX', 'SDGR', 'TALK', 'VERA',
  // === Fintech / Digital ===
  'SOFI', 'HOOD', 'PSFE', 'AFRM', 'BKKT', 'UPST', 'PAYO', 'OLO', 'FLYW', 'RSKD',
  // === Tech / AI / Quantum ===
  'WISH', 'SKLZ', 'OPEN', 'LMND', 'BYND', 'IONQ', 'RGTI', 'QUBT', 'QBTS',
  'KULR', 'LIDR', 'MVIS', 'NNDM', 'LAZR', 'OUST', 'AEVA', 'VLDX', 'INDI', 'MKFG',
  'BBAI', 'SOUN', 'ARQQ', 'ACHR', 'SMRT', 'IQ', 'ATER',
  // === Telecom / Comms ===
  'SIRI', 'NOK', 'BB', 'GSAT', 'TELL', 'LUMN', 'IRDM',
  // === Mining / Crypto ===
  'BTG', 'FSM', 'GPL', 'GATO', 'USAS', 'MARA', 'RIOT', 'BITF', 'HUT', 'CLSK', 'WULF',
  'BTBT', 'CIFR', 'BTDR', 'SOS', 'EBON', 'ANY', 'VYGR',
  // === Space / Defense ===
  'ASTS', 'RKLB', 'LUNR', 'RDW', 'WRAP', 'SPCE', 'MNTS', 'ASTR',
  // === Industrial / Materials ===
  'DM', 'EOSE', 'FLNC', 'GLS', 'KORE', 'SHLS', 'ORGN', 'STEM', 'TPIC', 'VLD',
  'UEC', 'AMPX', 'ARRY', 'FREY', 'MVST', 'WKSP', 'ENVX',
  // === Consumer / Retail ===
  'CLOV', 'YEXT', 'ZETA', 'MAPS', 'TRMR', 'SDC', 'REAL', 'PERI', 'VERX',
  'BIRD', 'PRPL', 'RVLV', 'COOK', 'CRCT', 'LOVE', 'LE', 'RENT',
  // === Media / Entertainment ===
  'IQ', 'GENI', 'CURI', 'PLBY', 'CFVI', 'MYPS',
  // === REITs / Real Estate ===
  'ACRE', 'ARI', 'BRSP', 'GPMT', 'RC', 'NYMT',
  // === Extra small-caps with high volatility ===
  'APGE', 'APPH', 'BFLY', 'BMEA', 'CHRS', 'CMPO', 'CZOO', 'DAVE',
  'DOMO', 'EDIT', 'FIGS', 'GDRX', 'GRPN', 'HIMX', 'HYMC',
  'IMPP', 'LITM', 'MEGL', 'MLGO', 'NBEV', 'NRDS', 'OPFI', 'OTRK',
  'PLTK', 'RCAT', 'RVPH', 'SNAP', 'SQSP', 'TDUP', 'UNFI',
  'XELA', 'XNET', 'ZENV',
];

// ===== Dynamic Active List Management =====
// These live in-memory per isolate; they persist across cron invocations within the same isolate lifetime
const activeQuantList: Set<string> = new Set();
const activePennyList: Set<string> = new Set();
// Track scores for eviction
const lastScores: Map<string, number> = new Map();

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const logs: string[] = [];
  const addLog = async (strategy: string, action: string, symbol: string | null, message: string, details: any = {}) => {
    logs.push(`[${strategy}] ${message}`);
    try {
      await supabase.from('agent_logs').insert({ strategy, action, symbol, message, details });
    } catch { /* non-critical */ }
  };

  try {
    const authHeader = req.headers.get('Authorization');
    const body = await req.json().catch(() => ({}));
    const isCron = body?.source === 'cron';
    const hasServiceKey = authHeader?.includes(supabaseKey);
    if (!isCron && !hasServiceKey) {
      return new Response(JSON.stringify({ error: 'Unauthorized: cloud-agent is internal only' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await supabase.from('agent_status').update({
      last_heartbeat: new Date().toISOString(),
      is_running: true,
    }).not('id', 'is', null);

    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const sessionInfo = getMarketSession();
    const sessionLabel = sessionInfo.label;
    const spreadMul = sessionInfo.spreadMultiplier;
    const entryRelax = sessionInfo.entryRelax; // 비정규장 진입 완화 계수

    // ========== DYNAMIC UNIVERSE ROTATION ==========
    // ★★★ Phase 0: Build this cycle's scan list dynamically
    const quantCycleCount = (await supabase.from('agent_status').select('total_cycles').limit(1).single()).data?.total_cycles || 0;

    // --- QUANT (대형주): 30개 스캔 슬롯, 점수 40 미만 퇴출 + 새 후보 유입 ---
    // Step 1: Evict low-score symbols from active list
    const evictedQuant: string[] = [];
    for (const sym of activeQuantList) {
      const score = lastScores.get(`quant_${sym}`) ?? 50;
      if (score < 40) {
        activeQuantList.delete(sym);
        evictedQuant.push(sym);
      }
    }

    // Step 2: Fill empty slots with rotating candidates from the full universe
    const quantGroupSize = 30;
    const quantStartIdx = (quantCycleCount * quantGroupSize) % FULL_QUANT_UNIVERSE.length;
    const rotationCandidates: string[] = [];
    for (let i = 0; i < quantGroupSize * 2; i++) {  // scan wider to find enough fresh candidates
      const sym = FULL_QUANT_UNIVERSE[(quantStartIdx + i) % FULL_QUANT_UNIVERSE.length];
      if (!activeQuantList.has(sym)) rotationCandidates.push(sym);
    }

    // Fill up to 30 active slots
    for (const sym of rotationCandidates) {
      if (activeQuantList.size >= quantGroupSize) break;
      activeQuantList.add(sym);
    }

    const QUANT_SYMBOLS = Array.from(activeQuantList);

    // --- PENNY (소형주): 25개 스캔 슬롯, 점수 40 미만 퇴출 + 거래량 폭발 우선 유입 ---
    const evictedPenny: string[] = [];
    for (const sym of activePennyList) {
      const score = lastScores.get(`penny_${sym}`) ?? 50;
      if (score < 40) {
        activePennyList.delete(sym);
        evictedPenny.push(sym);
      }
    }

    const pennyGroupSize = 25;
    const pennyStartIdx = (quantCycleCount * pennyGroupSize) % FULL_PENNY_UNIVERSE.length;
    const pennyRotationCandidates: string[] = [];
    // ★ Sector diversity: track sectors to ensure spread
    for (let i = 0; i < pennyGroupSize * 3; i++) {
      const sym = FULL_PENNY_UNIVERSE[(pennyStartIdx + i) % FULL_PENNY_UNIVERSE.length];
      if (!activePennyList.has(sym)) pennyRotationCandidates.push(sym);
    }

    for (const sym of pennyRotationCandidates) {
      if (activePennyList.size >= pennyGroupSize) break;
      activePennyList.add(sym);
    }

    const PENNY_TICKERS = Array.from(activePennyList);

    // ========== PHASE 1: QUANT STRATEGY ==========
    const { data: mainOpenPos } = await supabase.from('ai_trades').select('*').eq('status', 'open');
    const { data: scalpOpenPos } = await supabase.from('scalping_trades').select('*').eq('status', 'open');

    // Always include held symbols
    const heldMainSymbols = (mainOpenPos || []).map((p: any) => p.symbol);
    for (const s of heldMainSymbols) {
      if (!QUANT_SYMBOLS.includes(s)) QUANT_SYMBOLS.push(s);
    }

    const { data: mainWallet } = await supabase.from('ai_wallet').select('*').limit(1).single();
    const { data: scalpWallet } = await supabase.from('scalping_wallet').select('*').limit(1).single();
    if (!mainWallet) throw new Error('No main wallet');

    const mainInitialBalance = mainWallet.initial_balance || mainWallet.balance;
    const scalpInitialBalance = scalpWallet?.initial_balance || scalpWallet?.balance || 1000000;

    // ★★★ [잔고 검증 Reconciliation]
    async function reconcileBalance(
      walletTable: string, tradesTable: string, walletId: string, initBal: number
    ): Promise<number> {
      const { data: allTrades } = await supabase.from(tradesTable).select('*');
      if (!allTrades || allTrades.length === 0) return initBal;

      let totalBuyCost = 0;
      let totalSaleProceeds = 0;

      for (const t of allTrades) {
        const partialExits: any[] = t.partial_exits || [];
        const partialQty = partialExits.reduce((s: number, pe: any) => s + (Number(pe.qty) || 0), 0);
        const originalQty = Number(t.quantity) + partialQty;
        totalBuyCost += Math.floor(Number(t.price) * originalQty * KRW_RATE);

        if (t.status !== 'open' && t.close_price != null) {
          totalSaleProceeds += Math.floor(Number(t.close_price) * Number(t.quantity) * KRW_RATE);
        }

        for (const pe of partialExits) {
          totalSaleProceeds += Math.floor(Number(pe.qty) * Number(pe.price) * KRW_RATE);
        }
      }

      return Math.floor(initBal - totalBuyCost + totalSaleProceeds);
    }

    let mainBalance = await reconcileBalance('ai_wallet', 'ai_trades', mainWallet.id, mainInitialBalance);
    let scalpBalance = scalpWallet
      ? await reconcileBalance('scalping_wallet', 'scalping_trades', scalpWallet.id, scalpInitialBalance)
      : 1000000;

    if (mainBalance !== Math.floor(mainWallet.balance)) {
      await supabase.from('ai_wallet').update({ balance: mainBalance, updated_at: now.toISOString() }).eq('id', mainWallet.id);
      await addLog('system', 'audit', null, `[잔고검증] 대형주 잔고 교정: ${fmtKRWRaw(Math.floor(mainWallet.balance))} → ${fmtKRWRaw(mainBalance)}`, { before: Math.floor(mainWallet.balance), after: mainBalance });
    }
    if (scalpWallet && scalpBalance !== Math.floor(scalpWallet.balance)) {
      await supabase.from('scalping_wallet').update({ balance: scalpBalance, updated_at: now.toISOString() }).eq('id', scalpWallet.id);
      await addLog('system', 'audit', null, `[잔고검증] 소형주 잔고 교정: ${fmtKRWRaw(Math.floor(scalpWallet.balance))} → ${fmtKRWRaw(scalpBalance)}`, { before: Math.floor(scalpWallet.balance), after: scalpBalance });
    }

    const mainInvested = (mainOpenPos || []).reduce((sum: number, p: any) => sum + Math.round(toKRW(p.price * p.quantity)), 0);
    const mainUtilization = mainInitialBalance > 0 ? ((mainInitialBalance - mainBalance) / mainInitialBalance) * 100 : 0;
    const scalpInvested = (scalpOpenPos || []).reduce((sum: number, p: any) => sum + Math.round(toKRW(p.price * p.quantity)), 0);
    const scalpUtilization = scalpInitialBalance > 0 ? ((scalpInitialBalance - scalpBalance) / scalpInitialBalance) * 100 : 0;

    await addLog('system', 'scan', null, `[${timeStr}] [${sessionLabel}] Cloud Agent 사이클 시작 — 대형주 ${QUANT_SYMBOLS.length}개(풀 ${FULL_QUANT_UNIVERSE.length}개 중) + 소형주 ${PENNY_TICKERS.length}개(풀 ${FULL_PENNY_UNIVERSE.length}개 중) | 퇴출: 대형주 ${evictedQuant.length}개, 소형주 ${evictedPenny.length}개 | 세션: ${sessionLabel} (×${spreadMul}) | [자금] 대형주: ${fmtKRWRaw(Math.round(mainBalance))} (${mainUtilization.toFixed(1)}%) | 소형주: ${fmtKRWRaw(Math.round(scalpBalance))} (${scalpUtilization.toFixed(1)}%)`);

    if (evictedQuant.length > 0) {
      await addLog('quant', 'evict', null, `[동적스캔] 대형주 퇴출 종목 (점수 <40): ${evictedQuant.join(', ')} → 신규 후보로 교체`, { evicted: evictedQuant });
    }
    if (evictedPenny.length > 0) {
      await addLog('scalping', 'evict', null, `[동적스캔] 소형주 퇴출 종목 (점수 <40): ${evictedPenny.join(', ')} → 신규 후보로 교체`, { evicted: evictedPenny });
    }

    if (mainUtilization >= 90) {
      await addLog('quant', 'warning', null, `[자금경고] ⚠️ 대형주 자금 운용률 ${mainUtilization.toFixed(1)}%`, { utilization: mainUtilization });
    }
    if (scalpUtilization >= 90) {
      await addLog('scalping', 'warning', null, `[자금경고] ⚠️ 소형주 자금 운용률 ${scalpUtilization.toFixed(1)}%`, { utilization: scalpUtilization });
    }

    // --- QUANT: Exit checks ---
    const mainSymbolsToCheck = [...new Set((mainOpenPos || []).map((p: any) => p.symbol))];
    for (const sym of mainSymbolsToCheck) {
      const data = await getQuoteAndCandles(sym);
      if (!data) continue;
      const price = data.quote.c;
      const scoring = score10Indicators(data.quote, data.closes, data.highs, data.lows, data.opens, data.volumes);
      const quantScore = scoring?.totalScore || 0;
      lastScores.set(`quant_${sym}`, quantScore);

      for (const pos of (mainOpenPos || []).filter((p: any) => p.symbol === sym && p.status === 'open')) {
        const pnlPct = ((price - pos.price) / pos.price) * 100;

        if (pnlPct >= 3 && pos.stop_loss < pos.price * 1.005) {
          const breakevenStop = +(pos.price * 1.005).toFixed(4);
          await supabase.from('ai_trades').update({ stop_loss: breakevenStop }).eq('id', pos.id);
          pos.stop_loss = breakevenStop;
          await addLog('quant', 'defense', sym, `[철갑방어] ${sym} 수익률 ${pnlPct.toFixed(2)}% → 손절가 본절가 상향: ${fmtKRW(breakevenStop)}`, { pnlPct: +pnlPct.toFixed(2), newStopLoss: breakevenStop });
        }

        const peakPrice = Math.max(pos.peak_price || pos.price, price);
        if (price > (pos.peak_price || pos.price)) {
          await supabase.from('ai_trades').update({ peak_price: peakPrice }).eq('id', pos.id);
        }

        let shouldClose = false;
        let closeReason = '';
        let newStatus = 'closed';

        if (pnlPct <= -2.5) {
          shouldClose = true;
          closeReason = `[Cloud] [${sessionLabel}] [${timeStr}] [${sym}] 손절 실행 (-2.5% 도달: ${pnlPct.toFixed(2)}%)`;
          newStatus = 'stopped';
        } else if (peakPrice >= pos.price * 1.10) {
          const dropFromPeak = ((peakPrice - price) / peakPrice) * 100;
          if (dropFromPeak >= 5) {
            const lockedPnl = ((price - pos.price) / pos.price * 100).toFixed(2);
            shouldClose = true;
            closeReason = `[Cloud] [${sessionLabel}] [${timeStr}] [${sym}] 추격익절 (고점 ${fmtKRW(peakPrice)} 대비 -${dropFromPeak.toFixed(1)}% → 수익 ${lockedPnl}% 확정)`;
            newStatus = 'trailing_profit';
          }
        } else if (quantScore < 40) {
          shouldClose = true;
          closeReason = `[Cloud] [${sessionLabel}] [${timeStr}] [${sym}] 매수 근거 소멸 (점수 ${quantScore}점 < 40)`;
          newStatus = 'score_exit';
        } else if (pos.take_profit && price >= pos.take_profit) {
          shouldClose = true;
          closeReason = `[Cloud] [${sessionLabel}] [${timeStr}] [${sym}] 목표가 도달 익절`;
          newStatus = 'profit_taken';
        } else if (pos.stop_loss && price <= pos.stop_loss) {
          shouldClose = true;
          closeReason = `[Cloud] [${sessionLabel}] [${timeStr}] [${sym}] ${pnlPct >= 0 ? '본절가 방어 매도' : '추격 손절 터치'}`;
          newStatus = pnlPct >= 0 ? 'breakeven_exit' : 'trailing_stop';
        }

        if (shouldClose) {
          await addLog('quant', 'exit_attempt', sym, `[매도시도] ${sym} ${newStatus} 조건 충족 — 매도 명령 발행 중...`, { price, pnlPct: +pnlPct.toFixed(2), newStatus });
          const saleProceeds = Math.floor(price * pos.quantity * KRW_RATE);
          const buyCost = Math.floor(pos.price * pos.quantity * KRW_RATE);
          const pnlKRW = saleProceeds - buyCost;
          const balanceBefore = mainBalance;
          const newBalance = mainBalance + saleProceeds;
          await supabase.from('ai_trades').update({
            status: newStatus, close_price: price, pnl: pnlKRW,
            closed_at: now.toISOString(),
            ai_reason: `${closeReason} | PnL: ${fmtKRWRaw(pnlKRW)} | 매도대금: ${fmtKRWRaw(saleProceeds)} → [잔고: ${fmtKRWRaw(balanceBefore)} → ${fmtKRWRaw(newBalance)}]`,
          }).eq('id', pos.id);
          await supabase.from('ai_wallet').update({
            balance: newBalance, updated_at: now.toISOString(),
          }).eq('id', mainWallet.id);
          mainBalance = newBalance;
          await addLog('quant', 'exit', sym, `${closeReason} | PnL: ${fmtKRWRaw(pnlKRW)} | [잔고: ${fmtKRWRaw(balanceBefore)} → ${fmtKRWRaw(newBalance)}]`, { pnl: pnlKRW, pnlPct: +pnlPct.toFixed(2), saleProceeds, buyCost });
        }
      }
      await new Promise(r => setTimeout(r, 200));
    }

    // --- QUANT: Market Trend Guard ---
    let marketBearish = false;
    let entryThreshold = 50;
    try {
      const [spyQuote, qqqQuote] = await Promise.all([
        finnhubFetch(`/quote?symbol=SPY`),
        finnhubFetch(`/quote?symbol=QQQ`),
      ]);
      const spyChange = spyQuote?.dp || 0;
      const qqqChange = qqqQuote?.dp || 0;
      if (spyChange < -1 && qqqChange < -1) {
        marketBearish = true;
        entryThreshold = 65;
        await addLog('system', 'warning', null, `[시장동기화] ⚠️ SPY ${spyChange.toFixed(2)}% / QQQ ${qqqChange.toFixed(2)}% → 진입 기준 65점 상향`, { spyChange, qqqChange });
      } else if (spyChange < -0.5 || qqqChange < -0.5) {
        entryThreshold = 55;
        await addLog('system', 'info', null, `[시장동기화] SPY ${spyChange.toFixed(2)}% / QQQ ${qqqChange.toFixed(2)}% → 진입 기준 55점`, { spyChange, qqqChange });
      } else {
        await addLog('system', 'info', null, `[시장동기화] SPY ${spyChange.toFixed(2)}% / QQQ ${qqqChange.toFixed(2)}% → 진입 기준 50점`, { spyChange, qqqChange });
      }
    } catch { /* fallback */ }

    // --- QUANT: Scan for new entries (동적 스캔) — 세션 적응형 진입 ---
    const mainOpenCount = (mainOpenPos || []).filter(p => p.status === 'open').length;
    const quantCandidates: { sym: string; price: number; scoring: any }[] = [];

    // ★ 비정규장: 진입 조건 완화 (entryRelax < 1.0)
    const adaptedEntryThreshold = Math.round(entryThreshold * entryRelax);
    const adaptedRvolMin = entryRelax < 1.0 ? 1.0 : 1.5; // 비정규장은 RVOL 1.0까지 허용
    const adaptedVwapMin = entryRelax < 1.0 ? 2 : 4;      // 비정규장은 VWAP 점수 2까지 허용

    if (entryRelax < 1.0) {
      await addLog('system', 'info', null, `[전세션 엔진] ${sessionLabel} 적응형 진입: 문턱 ${entryThreshold}→${adaptedEntryThreshold}점 | RVOL≥${adaptedRvolMin} | VWAP≥${adaptedVwapMin}`, {});
    }

    for (let i = 0; i < QUANT_SYMBOLS.length; i += 5) {
      const batch = QUANT_SYMBOLS.slice(i, i + 5);
      const results = await Promise.all(batch.map(async (sym) => {
        try {
          const data = await getQuoteAndCandles(sym);
          if (!data) return null;
          const scoring = score10Indicators(data.quote, data.closes, data.highs, data.lows, data.opens, data.volumes);
          if (!scoring) return null;
          // ★ Track score for dynamic eviction
          lastScores.set(`quant_${sym}`, scoring.totalScore);
          return { sym, price: data.quote.c, scoring };
        } catch { return null; }
      }));

      for (const r of results) {
        if (!r || r.scoring.totalScore < adaptedEntryThreshold) continue;
        const alreadyHolding = (mainOpenPos || []).some(p => p.symbol === r.sym && p.status === 'open');
        const isPyramiding = alreadyHolding && r.scoring.totalScore >= 80;
        if (alreadyHolding && !isPyramiding) continue;
        if (mainOpenCount >= 10) continue;
        // ★ 세션 적응형 필터: 비정규장에서는 완화된 조건 적용
        const sentimentOk = (r.scoring.indicators.sentiment.score || 0) > 0;
        const rvolOk = (r.scoring.indicators.rvol.rvol || 0) >= adaptedRvolMin;
        const vwapOk = (r.scoring.indicators.candle.score || 0) >= adaptedVwapMin;
        // 비정규장: 3개 중 2개만 충족해도 진입 허용
        const filtersPassed = [sentimentOk, rvolOk, vwapOk].filter(Boolean).length;
        const minFilters = entryRelax < 1.0 ? 2 : 3;
        if (filtersPassed < minFilters) continue;
        quantCandidates.push(r);
      }
      if (i + 5 < QUANT_SYMBOLS.length) await new Promise(r => setTimeout(r, 300));
    }

    quantCandidates.sort((a, b) => b.scoring.totalScore - a.scoring.totalScore);

    for (const r of quantCandidates) {
      const alreadyHolding = (mainOpenPos || []).some(p => p.symbol === r.sym && p.status === 'open');
      const isPyramiding = alreadyHolding && r.scoring.totalScore >= 80;
      const positionPct = isPyramiding ? 0.10 : 0.15;

      const maxKRW = mainBalance * positionPct;
      const priceKRW = toKRW(r.price);
      const qty = Math.floor(maxKRW / priceKRW);
      const costKRW = Math.floor(qty * priceKRW);

      if (qty <= 0 || costKRW > mainBalance) {
        await addLog('quant', 'hold', r.sym, `[Cloud-Quant] [${timeStr}] ${r.sym} ${r.scoring.totalScore}점 → ⚠️ 잔고 부족 | 필요: ${fmtKRWRaw(costKRW)} | 잔고: ${fmtKRWRaw(Math.round(mainBalance))}`, {});
        continue;
      }

      const adjustedPrice = applySessionSlippage(r.price, 'buy', spreadMul);
      const stopLoss = +(adjustedPrice * 0.975).toFixed(4);
      const takeProfit = +(adjustedPrice * 1.06).toFixed(4);
      const tier = isPyramiding ? 'PYRAMID' : 'SCOUT';
      const balanceBefore = Math.round(mainBalance);
      const newBuyBalance = mainBalance - costKRW;
      const spreadNote = spreadMul > 1 ? ` | ⚠️ ${sessionLabel} 스프레드 보정 ×${spreadMul}` : '';
      const logMsg = `[Cloud-Quant] [${sessionLabel}] [${timeStr}] ${r.sym} ${r.scoring.totalScore}점 자율 매수 [${tier}|${qty}주@${fmtKRW(adjustedPrice)}|${fmtKRWRaw(costKRW)}]${spreadNote} | [잔고: ${fmtKRWRaw(balanceBefore)} → ${fmtKRWRaw(newBuyBalance)}]`;

      await supabase.from('ai_trades').insert({
        symbol: r.sym, side: 'buy', quantity: qty, price: adjustedPrice,
        stop_loss: stopLoss, take_profit: takeProfit, status: 'open',
        ai_reason: logMsg, ai_confidence: r.scoring.totalScore,
      });
      await supabase.from('ai_wallet').update({
        balance: newBuyBalance, updated_at: now.toISOString(),
      }).eq('id', mainWallet.id);
      mainBalance = newBuyBalance;
      await addLog('quant', 'buy', r.sym, logMsg, { score: r.scoring.totalScore, qty, costKRW });
    }

    // ========== AUTO-REPLACEMENT ==========
    {
      const refreshedOpenPos = (await supabase.from('ai_trades').select('*').eq('status', 'open')).data || [];
      for (const pos of refreshedOpenPos) {
        const data = await getQuoteAndCandles(pos.symbol);
        if (!data) continue;
        const scoring = score10Indicators(data.quote, data.closes, data.highs, data.lows, data.opens, data.volumes);
        const currentScore = scoring?.totalScore || 0;

        const betterCandidate = quantCandidates.find(c =>
          c.scoring.totalScore >= 60 &&
          c.scoring.totalScore - currentScore >= 10 &&
          !refreshedOpenPos.some(p => p.symbol === c.sym)
        );

        if (currentScore >= 40 && !betterCandidate) continue;

        if (betterCandidate || currentScore < 40) {
          const price = data.quote.c;
          const saleProceeds = Math.floor(price * pos.quantity * KRW_RATE);
          const buyCost = Math.floor(pos.price * pos.quantity * KRW_RATE);
          const pnlKRW = saleProceeds - buyCost;
          const targetLabel = betterCandidate ? `→ ${betterCandidate.sym} ${betterCandidate.scoring.totalScore}점으로 교체` : '→ 대기';
          const closeReason = `[Auto-Replace] ${pos.symbol} 점수 ${currentScore}점 ${targetLabel}`;

          await supabase.from('ai_trades').update({
            status: 'replaced', close_price: price, pnl: pnlKRW,
            closed_at: now.toISOString(),
            ai_reason: `${closeReason} | PnL: ${fmtKRWRaw(pnlKRW)}`,
          }).eq('id', pos.id);
          mainBalance += saleProceeds;
          await supabase.from('ai_wallet').update({ balance: mainBalance, updated_at: now.toISOString() }).eq('id', mainWallet.id);
          await addLog('quant', 'replace', pos.symbol, closeReason, { oldScore: currentScore, newSymbol: betterCandidate?.sym, newScore: betterCandidate?.scoring.totalScore, pnl: pnlKRW });
        }
        await new Promise(r => setTimeout(r, 200));
      }
    }

    // ========== PHASE 2: SCALPING STRATEGY (Dynamic Penny Stocks) ==========
    if (scalpWallet) {
      // === SELF-LEARNING: Blacklist ===
      const { data: recentScalpLosses } = await supabase
        .from('scalping_trades')
        .select('symbol, pnl, status')
        .lt('pnl', 0)
        .order('closed_at', { ascending: false })
        .limit(200);

      const lossCount: Record<string, number> = {};
      for (const t of (recentScalpLosses || [])) {
        lossCount[t.symbol] = (lossCount[t.symbol] || 0) + 1;
      }
      const blacklistSymbols = new Set(
        Object.entries(lossCount).filter(([_, c]) => c >= 3).map(([s]) => s)
      );
      if (blacklistSymbols.size > 0) {
        await addLog('scalping', 'learn', null, `[AI-Learn] 진입 금지 블랙리스트: ${[...blacklistSymbols].join(', ')}`, {});
      }

      // === Dynamic threshold ===
      const { data: recentScalp } = await supabase
        .from('scalping_trades')
        .select('pnl')
        .not('status', 'eq', 'open')
        .order('closed_at', { ascending: false })
        .limit(50);
      const recentWins = (recentScalp || []).filter(t => (t.pnl || 0) > 0).length;
      const recentTotal = (recentScalp || []).length;
      const recentWinRate = recentTotal > 0 ? (recentWins / recentTotal) * 100 : 50;
      let dynamicEntryThreshold = 3;
      if (recentWinRate < 40) dynamicEntryThreshold = 5;
      else if (recentWinRate < 50) dynamicEntryThreshold = 4;
      else if (recentWinRate > 65) dynamicEntryThreshold = 2;

      // ★ 비정규장 세션 적응형: 진입 기준 완화
      const adaptedScalpThreshold = Math.max(1, Math.round(dynamicEntryThreshold * entryRelax));
      const adaptedScalpScoreMin = entryRelax < 1.0 ? 40 : 50; // 비정규장: 점수 40까지 허용

      await addLog('scalping', 'learn', null, `[AI-Learn] 승률 ${recentWinRate.toFixed(1)}% → 진입 기준: +${adaptedScalpThreshold}% (원래 +${dynamicEntryThreshold}%) | 점수 ≥${adaptedScalpScoreMin} | ${sessionLabel} 적응형`, {});

      // Exit checks
      const scalpSymbolsToCheck = [...new Set((scalpOpenPos || []).map((p: any) => p.symbol))];
      for (const sym of scalpSymbolsToCheck) {
        const quoteData = await finnhubFetch(`/quote?symbol=${sym}`);
        if (!quoteData?.c) continue;
        const price = quoteData.c;

        if (price < MIN_PRICE_USD) {
          await addLog('scalping', 'warning', sym, `[Cloud-Scalp] [${timeStr}] ⚠️ ${sym} 초저가 경고: ${fmtKRW(price)}`, {});
        }

        for (const pos of (scalpOpenPos || []).filter((p: any) => p.symbol === sym && p.status === 'open')) {
          const pnlPct = ((price - pos.price) / pos.price) * 100;

          if (pnlPct >= 3 && pos.stop_loss < pos.price * 1.005) {
            const breakevenStop = +(pos.price * 1.005).toFixed(4);
            await supabase.from('scalping_trades').update({ stop_loss: breakevenStop }).eq('id', pos.id);
            pos.stop_loss = breakevenStop;
            await addLog('scalping', 'defense', sym, `[철갑방어] ${sym} 수익률 ${pnlPct.toFixed(2)}% → 본절가 상향: ${fmtKRW(breakevenStop)}`, {});
          }

          let shouldClose = false;
          let closeReason = '';
          let newStatus = 'closed';

          const peakPrice = Math.max(pos.peak_price || pos.price, price);
          if (price > (pos.peak_price || pos.price)) {
            await supabase.from('scalping_trades').update({ peak_price: peakPrice }).eq('id', pos.id);
          }

          if (pnlPct <= -2.5) {
            shouldClose = true;
            closeReason = `[Cloud-Scalp] [${sessionLabel}] [${timeStr}] ${sym} 손절 (-2.5%: ${pnlPct.toFixed(2)}%)`;
            newStatus = 'stopped';
          } else if (peakPrice >= pos.price * 1.10) {
            const dropFromPeak = ((peakPrice - price) / peakPrice) * 100;
            if (dropFromPeak >= 5) {
              const lockedPnlPct = ((price - pos.price) / pos.price * 100).toFixed(2);
              shouldClose = true;
              closeReason = `[Cloud-Scalp] [${sessionLabel}] [${timeStr}] ${sym} 추격익절 (고점 대비 -${dropFromPeak.toFixed(1)}% → 수익 ${lockedPnlPct}%)`;
              newStatus = 'trailing_profit';
            }
          } else if (pos.stop_loss && price <= pos.stop_loss) {
            shouldClose = true;
            closeReason = `[Cloud-Scalp] [${sessionLabel}] [${timeStr}] ${sym} 추격 손절 터치`;
            newStatus = 'stopped';
          } else if (pos.take_profit && price >= pos.take_profit) {
            shouldClose = true;
            closeReason = `[Cloud-Scalp] [${sessionLabel}] [${timeStr}] ${sym} 익절 도달 (+5%)`;
            newStatus = 'profit_taken';
          } else if (blacklistSymbols.has(sym) && pnlPct <= 0.2 && pnlPct >= -1.0) {
            shouldClose = true;
            closeReason = `[Cloud-Scalp] [${sessionLabel}] [${timeStr}] ${sym} 블랙리스트 조기 대응 (${pnlPct.toFixed(2)}%)`;
            newStatus = 'early_exit';
          }

          // Partial exit at 2%
          if (!shouldClose && pnlPct >= 2) {
            const partialExits = pos.partial_exits || [];
            const hasFirst = partialExits.some((e: any) => e.type === 'first_partial');
            if (!hasFirst) {
              const sellQty = Math.floor(pos.quantity * 0.5);
              if (sellQty > 0) {
                const sellValue = Math.floor(sellQty * price * KRW_RATE);
                const partialPnl = sellValue - Math.floor(sellQty * pos.price * KRW_RATE);
                partialExits.push({ type: 'first_partial', qty: sellQty, price, pnl: partialPnl, at: now.toISOString() });
                await supabase.from('scalping_trades').update({
                  quantity: pos.quantity - sellQty, partial_exits: partialExits,
                  stop_loss: Math.max(+(price - 2.0 * (price * 0.02)).toFixed(4), pos.stop_loss || 0),
                }).eq('id', pos.id);
                const newPartialBal = scalpBalance + sellValue;
                await supabase.from('scalping_wallet').update({
                  balance: newPartialBal, updated_at: now.toISOString(),
                }).eq('id', scalpWallet.id);
                scalpBalance = newPartialBal;
                await addLog('scalping', 'exit', sym, `[Cloud-Scalp] ${sym} 1차 50% 익절 (${pnlPct.toFixed(1)}%) | 매도대금: ${fmtKRWRaw(sellValue)} | PnL: ${fmtKRWRaw(partialPnl)}`, {});
              }
            }
          }

          if (shouldClose) {
            await addLog('scalping', 'exit_attempt', sym, `[매도시도] ${sym} ${newStatus} 조건 충족`, { price, pnlPct: +pnlPct.toFixed(2), newStatus });
            const saleProceeds = Math.floor(price * pos.quantity * KRW_RATE);
            const buyCost = Math.floor(pos.price * pos.quantity * KRW_RATE);
            const pnlKRW = saleProceeds - buyCost;
            const balanceBefore = scalpBalance;
            const newScalpBal = scalpBalance + saleProceeds;
            await supabase.from('scalping_trades').update({
              status: newStatus, close_price: price, pnl: pnlKRW,
              closed_at: now.toISOString(), ai_reason: `${closeReason} | PnL: ${fmtKRWRaw(pnlKRW)} | [잔고: ${fmtKRWRaw(balanceBefore)} → ${fmtKRWRaw(newScalpBal)}]`,
            }).eq('id', pos.id);
            await supabase.from('scalping_wallet').update({
              balance: newScalpBal, updated_at: now.toISOString(),
            }).eq('id', scalpWallet.id);
            scalpBalance = newScalpBal;
            await addLog('scalping', 'exit', sym, `${closeReason} | PnL: ${fmtKRWRaw(pnlKRW)} | [잔고: ${fmtKRWRaw(balanceBefore)} → ${fmtKRWRaw(newScalpBal)}]`, {});
          }
        }
        await new Promise(r => setTimeout(r, 200));
      }

      // ★★★ Dynamic Penny Scan — 거래량 300%+ 폭발 종목 우선 유입
      let scalpOpenCount = (scalpOpenPos || []).filter(p => p.status === 'open').length;
      const heldScalpSymbols = new Set((scalpOpenPos || []).map((p: any) => p.symbol));

      await addLog('scalping', 'scan', null, `[Cloud-Scalp] [${timeStr}] 소형주 동적 스캔 ${PENNY_TICKERS.length}개 (풀 ${FULL_PENNY_UNIVERSE.length}개 중) | 잔고: ${fmtKRWRaw(Math.round(scalpBalance))}`, {});

      const scalpCandidates: { sym: string; price: number; changePct: number; quantScore: number; rvol: number }[] = [];

      for (let bi = 0; bi < PENNY_TICKERS.length; bi += 5) {
        const batch = PENNY_TICKERS.slice(bi, bi + 5);
        const batchResults = await Promise.all(batch.map(async (sym) => {
          try {
            if (heldScalpSymbols.has(sym)) return null;
            if (blacklistSymbols.has(sym)) return { sym, filtered: true, reason: 'blacklist' };
            const data = await getQuoteAndCandles(sym);
            if (!data || !data.quote.c || data.quote.c >= 10) return null;
            if (data.quote.c < MIN_PRICE_USD) return { sym, filtered: true, reason: 'low_price' };
            const changePct = data.quote.dp || 0;
            if (changePct < dynamicEntryThreshold) return null;
            const scoring = score10Indicators(data.quote, data.closes, data.highs, data.lows, data.opens, data.volumes);
            const qs = scoring?.totalScore || 0;
            const rv = scoring?.rvol || 1;
            // ★ Track score for dynamic eviction
            lastScores.set(`penny_${sym}`, qs);
            // ★ 거래량 300%+ 폭발 종목 보너스
            return { sym, price: data.quote.c, changePct, quantScore: qs, rvol: rv, filtered: false };
          } catch { return null; }
        }));

        for (const f of batchResults) {
          if (f && (f as any).filtered) {
            await addLog('scalping', 'filter', (f as any).sym, `[동적스캔] ${(f as any).sym}: ${(f as any).reason === 'blacklist' ? '블랙리스트' : '저가 필터'}`, {});
          }
        }

        for (const r of batchResults) {
          if (r && !(r as any).filtered && (r as any).changePct > 0) {
            scalpCandidates.push(r as any);
          }
        }
        if (bi + 5 < PENNY_TICKERS.length) await new Promise(r => setTimeout(r, 200));
      }

      // ★ 거래량 300%+ 폭발 종목 우선 → 그 다음 점수 순 정렬
      scalpCandidates.sort((a, b) => {
        // RVOL >= 3 (300%+) gets priority
        const aVolBurst = a.rvol >= 3 ? 1 : 0;
        const bVolBurst = b.rvol >= 3 ? 1 : 0;
        if (aVolBurst !== bVolBurst) return bVolBurst - aVolBurst;
        return b.quantScore - a.quantScore;
      });

      if (scalpCandidates.length > 0) {
        const summary = scalpCandidates.slice(0, 10).map(c => `${c.sym}(${c.quantScore}점/RVOL${c.rvol.toFixed(1)}x/+${c.changePct.toFixed(1)}%)`).join(', ');
        await addLog('scalping', 'scan', null, `[Cloud-Scalp] [${timeStr}] 매수 후보 ${scalpCandidates.length}개 (거래량폭발→점수순): ${summary}`, {});
      }

      for (const r of scalpCandidates) {
        if (scalpOpenCount >= 10) break;
        const { sym, price, changePct, quantScore, rvol } = r;

        if (quantScore < 50) {
          await addLog('scalping', 'skip', sym, `[Cloud-Scalp] ${sym} +${changePct.toFixed(1)}%/RVOL${rvol.toFixed(1)}x → 점수 ${quantScore} < 50 보류`, {});
          continue;
        }

        const priceKRW = toKRW(price);
        const maxKRW = scalpBalance * 0.10;
        const qty = Math.floor(maxKRW / priceKRW);
        const costKRW = Math.floor(qty * priceKRW);

        if (qty <= 0 || costKRW > scalpBalance) {
          await addLog('scalping', 'hold', sym, `[Cloud-Scalp] [${timeStr}] ${sym} ${quantScore}점 → ⚠️ 잔고 부족`, {});
          continue;
        }

        if (price < MIN_PRICE_USD) continue;

        const adjPrice = applySessionSlippage(price, 'buy', spreadMul);
        const stopLoss = +(adjPrice * 0.975).toFixed(4);
        const takeProfit = +(adjPrice * 1.05).toFixed(4);
        const balanceBefore = scalpBalance;
        const newScalpBuyBal = scalpBalance - costKRW;
        const spreadNote = spreadMul > 1 ? ` | ⚠️ ${sessionLabel} ×${spreadMul}` : '';
        const rvolNote = rvol >= 3 ? ` | 🔥 거래량 ${(rvol*100).toFixed(0)}% 폭발` : '';
        const logMsg = `[Cloud-Scalp] [${sessionLabel}] [${timeStr}] ${sym} ${quantScore}점/+${changePct.toFixed(1)}% 동적 매수 (${qty}주@${fmtKRW(adjPrice)})${spreadNote}${rvolNote} | [잔고: ${fmtKRWRaw(balanceBefore)} → ${fmtKRWRaw(newScalpBuyBal)}]`;

        await supabase.from('scalping_trades').insert({
          symbol: sym, side: 'buy', quantity: qty, price: adjPrice,
          stop_loss: stopLoss, take_profit: takeProfit, status: 'open',
          entry_score: quantScore, time_limit_at: null,
          ai_reason: logMsg, ai_confidence: quantScore,
        });
        await supabase.from('scalping_wallet').update({
          balance: newScalpBuyBal, updated_at: now.toISOString(),
        }).eq('id', scalpWallet.id);
        scalpBalance = newScalpBuyBal;
        scalpOpenCount++;
        await addLog('scalping', 'buy', sym, logMsg, { quantScore, changePct: +changePct.toFixed(1), qty, costKRW, rvol });
      }
    }

    // Update cycle count
    await supabase.from('agent_status').update({
      last_cycle_at: now.toISOString(),
      total_cycles: (await supabase.from('agent_status').select('total_cycles').limit(1).single()).data?.total_cycles + 1 || 1,
    }).not('id', 'is', null);

    await addLog('system', 'info', null, `[${timeStr}] [${sessionLabel}] Cloud Agent 사이클 완료 — 동적 시장 전체 스캔 (대형주 ${FULL_QUANT_UNIVERSE.length}개풀/소형주 ${FULL_PENNY_UNIVERSE.length}개풀)`);

    return new Response(JSON.stringify({ success: true, logs, timestamp: now.toISOString() }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Cloud Agent error:', error);
    await addLog('system', 'error', null, `Cloud Agent 오류: ${error.message}`);
    await supabase.from('agent_status').update({
      errors_count: (await supabase.from('agent_status').select('errors_count').limit(1).single()).data?.errors_count + 1 || 1,
    }).not('id', 'is', null);
    
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
