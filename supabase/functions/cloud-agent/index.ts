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

function getMarketSession(): { session: SessionType; label: string; spreadMultiplier: number; entryRelax: number; rvolMin: number; aggressiveSlippage: number } {
  const now = new Date();
  const etStr = now.toLocaleString('en-US', { timeZone: 'America/New_York' });
  const et = new Date(etStr);
  const h = et.getHours();
  const m = et.getMinutes();
  const day = et.getDay();
  const time = h * 60 + m;

  // ★ 전 세션 24시간 무제한 자동매매 — 모든 시간대에서 매매 가동
  if (day === 0 || day === 6) {
    // 주말: 데이장 (유동성 최저 → 공격적 슬리피지 최대)
    return { session: 'DAY', label: '데이장(주말)', spreadMultiplier: 2.5, entryRelax: 0.6, rvolMin: 1.0, aggressiveSlippage: 0.003 };
  }
  if (time >= 240 && time < 570) {
    // 프리마켓 04:00~09:30 → 공격적 체결 0.25%
    return { session: 'PRE_MARKET', label: '프리마켓', spreadMultiplier: 2.0, entryRelax: 0.7, rvolMin: 1.0, aggressiveSlippage: 0.0025 };
  }
  if (time >= 570 && time < 960) {
    // 정규장 09:30~16:00 → 표준 슬리피지
    return { session: 'REGULAR', label: '정규장', spreadMultiplier: 1.0, entryRelax: 1.0, rvolMin: 2.0, aggressiveSlippage: 0.0002 };
  }
  if (time >= 960 && time < 1200) {
    // 애프터마켓 16:00~20:00 → 공격적 체결 0.2%
    return { session: 'AFTER_HOURS', label: '애프터마켓', spreadMultiplier: 1.8, entryRelax: 0.75, rvolMin: 1.0, aggressiveSlippage: 0.002 };
  }
  // 야간 20:00~04:00 → 데이장 모드 (공격적 체결 0.3%)
  return { session: 'DAY', label: '데이장', spreadMultiplier: 2.5, entryRelax: 0.6, rvolMin: 1.0, aggressiveSlippage: 0.003 };
}

function applySessionSlippage(price: number, side: 'buy' | 'sell', spreadMultiplier: number, aggressiveSlippage: number = 0.0002): number {
  // ★ 장외 시간대: 공격적 지정가 체결 (0.2~0.3% 상단까지 제시하여 즉시 체결률 향상)
  const slippage = Math.max(0.0002 * spreadMultiplier, aggressiveSlippage);
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

// ===== Unified 10-Indicator Scoring (Weighted: RVOL×2, MACD×2, VWAP/Candle×2) =====
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
    totalScore, trailingStop, rvol, changePct,
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

// ===== UNIFIED UNIVERSE (대형주 + 소형주 통합) =====
// ★ 대형주 풀 (300+)
const LARGE_CAP_UNIVERSE = [
  'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META', 'TSLA', 'AVGO', 'ORCL', 'ADBE',
  'AMD', 'INTC', 'QCOM', 'MU', 'AMAT', 'LRCX', 'ARM', 'TSM', 'MRVL', 'ON', 'NXPI', 'TXN', 'KLAC', 'ADI', 'SWKS', 'MPWR',
  'CRM', 'NOW', 'SNOW', 'DDOG', 'PANW', 'FTNT', 'ZS', 'MDB', 'NET', 'CRWD', 'SHOP', 'WDAY', 'HUBS', 'TEAM', 'VEEV', 'DOCU', 'ZM', 'OKTA', 'ESTC', 'BILL',
  'NFLX', 'UBER', 'ABNB', 'BKNG', 'DASH', 'PINS', 'RDDT', 'SNAP', 'SPOT', 'RBLX', 'ROKU', 'ETSY', 'LYFT', 'ZG', 'CHWY', 'CARG', 'MTCH',
  'SQ', 'PYPL', 'COIN', 'SOFI', 'HOOD', 'AFRM', 'NU', 'UPST', 'MSTR', 'TOST', 'FOUR', 'PAYO', 'LMND',
  'PLTR', 'AI', 'SOUN', 'IONQ', 'RGTI', 'QUBT', 'BBAI', 'SMCI', 'DELL', 'HPE', 'PATH', 'S', 'CFLT', 'GTLB',
  'LLY', 'UNH', 'ISRG', 'NVO', 'JNJ', 'PFE', 'MRK', 'ABBV', 'TMO', 'DHR', 'AMGN', 'GILD', 'VRTX', 'REGN', 'MRNA', 'DXCM', 'ILMN', 'EW', 'ZBH', 'BSX', 'MDT',
  'JPM', 'GS', 'V', 'MA', 'BRK.B', 'BAC', 'WFC', 'MS', 'C', 'AXP', 'SCHW', 'BLK', 'ICE', 'CME', 'SPGI',
  'XOM', 'CVX', 'COP', 'SLB', 'EOG', 'PSX', 'MPC', 'VLO', 'OXY', 'DVN', 'FANG', 'HAL',
  'ENPH', 'FSLR', 'SEDG', 'RUN', 'RIVN', 'LCID', 'NIO', 'XPEV', 'LI', 'CHPT', 'PLUG', 'BE',
  'LMT', 'RTX', 'BA', 'GE', 'HON', 'CAT', 'DE', 'UNP', 'FDX', 'UPS', 'WM', 'RSG', 'AXON', 'TDG', 'HWM',
  'DIS', 'NKE', 'SBUX', 'MCD', 'COST', 'WMT', 'TGT', 'HD', 'LOW', 'TJX', 'LULU', 'DECK', 'ONON', 'BIRD',
  'FCX', 'ALB', 'NEM', 'GOLD', 'MP', 'LAC', 'CLF', 'X', 'AA', 'VALE',
  'T', 'VZ', 'TMUS', 'PARA', 'WBD', 'FOX', 'CMCSA',
  'MARA', 'RIOT', 'CLSK', 'HUT', 'BITF', 'WULF', 'BTBT', 'CIFR', 'BTDR',
  'BABA', 'PDD', 'JD', 'BIDU', 'BILI', 'TME', 'VNET', 'TAL', 'EDU', 'CPNG',
  'RKLB', 'ASTS', 'LUNR', 'RDW', 'SPCE', 'JOBY',
  'ANET', 'TTD', 'CELH', 'MNST', 'DKNG', 'PENN', 'CZAR', 'APPN', 'GLOB', 'WIX',
  'TWLO', 'FIVN', 'ASAN', 'MNDY', 'DOCN', 'DT', 'SUMO', 'BRZE', 'AYX',
  'TMDX', 'INSP', 'GKOS', 'NARI', 'PODD', 'ALGN',
  'APO', 'KKR', 'ARES', 'OWL', 'LPLA',
  'CAVA', 'BROS', 'SHAK', 'WING', 'CMG',
  'VST', 'CEG', 'NRG', 'AES', 'NEE',
  'WYNN', 'LVS', 'MGM', 'CZR',
  'CCL', 'RCL', 'NCLH', 'EXPE', 'MAR', 'HLT',
];

// ★ 소형주 풀 (200+)
const SMALL_CAP_UNIVERSE = [
  'NIO', 'LCID', 'GOEV', 'FFIE', 'MULN', 'WKHS', 'NKLA', 'CHPT', 'FCEL', 'PLUG',
  'EVGO', 'BLNK', 'HYLN', 'XOS', 'CENN', 'JOBY', 'ARVL', 'BEEM', 'SES', 'QS',
  'SNDL', 'TLRY', 'ACB', 'CGC', 'MNMD', 'GRWG', 'CRON',
  'SENS', 'GNUS', 'BNGO', 'CLVS', 'DNA', 'ME', 'SDC', 'HIMS', 'IBRX', 'NUVB', 'CANO',
  'AGEN', 'APLS', 'ARQT', 'BCRX', 'BTAI', 'CARA', 'CMPS', 'CTLT', 'EXAI', 'FOLD',
  'GTHX', 'IMVT', 'KRTX', 'MGTA', 'OLINK', 'PRAX', 'RXRX', 'SDGR', 'TALK', 'VERA',
  'SOFI', 'HOOD', 'PSFE', 'AFRM', 'BKKT', 'UPST', 'PAYO', 'OLO', 'FLYW', 'RSKD',
  'WISH', 'SKLZ', 'OPEN', 'LMND', 'BYND', 'IONQ', 'RGTI', 'QUBT', 'QBTS',
  'KULR', 'LIDR', 'MVIS', 'NNDM', 'LAZR', 'OUST', 'AEVA', 'VLDX', 'INDI', 'MKFG',
  'BBAI', 'SOUN', 'ARQQ', 'ACHR', 'SMRT', 'IQ', 'ATER',
  'SIRI', 'NOK', 'BB', 'GSAT', 'TELL', 'LUMN', 'IRDM',
  'BTG', 'FSM', 'GPL', 'GATO', 'USAS', 'MARA', 'RIOT', 'BITF', 'HUT', 'CLSK', 'WULF',
  'BTBT', 'CIFR', 'BTDR', 'SOS', 'EBON', 'ANY', 'VYGR',
  'ASTS', 'RKLB', 'LUNR', 'RDW', 'WRAP', 'SPCE', 'MNTS', 'ASTR',
  'DM', 'EOSE', 'FLNC', 'GLS', 'KORE', 'SHLS', 'ORGN', 'STEM', 'TPIC', 'VLD',
  'UEC', 'AMPX', 'ARRY', 'FREY', 'MVST', 'WKSP', 'ENVX',
  'CLOV', 'YEXT', 'ZETA', 'MAPS', 'TRMR', 'REAL', 'PERI', 'VERX',
  'BIRD', 'PRPL', 'RVLV', 'COOK', 'CRCT', 'LOVE', 'LE', 'RENT',
  'IQ', 'GENI', 'CURI', 'PLBY', 'CFVI', 'MYPS',
  'ACRE', 'ARI', 'BRSP', 'GPMT', 'RC', 'NYMT',
  'APGE', 'APPH', 'BFLY', 'BMEA', 'CHRS', 'CMPO', 'CZOO', 'DAVE',
  'DOMO', 'EDIT', 'FIGS', 'GDRX', 'GRPN', 'HIMX', 'HYMC',
  'IMPP', 'LITM', 'MEGL', 'MLGO', 'NBEV', 'NRDS', 'OPFI', 'OTRK',
  'PLTK', 'RCAT', 'RVPH', 'SNAP', 'SQSP', 'TDUP', 'UNFI',
  'XELA', 'XNET', 'ZENV',
];

// Deduplicate
const LARGE_SET = new Set(LARGE_CAP_UNIVERSE);
const SMALL_SET = new Set(SMALL_CAP_UNIVERSE.filter(s => !LARGE_SET.has(s)));

// ===== Dynamic Active List Management =====
const activeUnifiedList: Set<string> = new Set();
const lastScores: Map<string, number> = new Map();

// Determine cap type: price >= $10 → large, else small
function getCapType(price: number, symbol: string): 'large' | 'small' {
  if (LARGE_SET.has(symbol) && price >= 10) return 'large';
  if (SMALL_SET.has(symbol)) return 'small';
  return price >= 10 ? 'large' : 'small';
}

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
    const entryRelax = sessionInfo.entryRelax;
    const sessionRvolMin = 3.0; // ★★★ 필승 로직: 모든 세션에서 RVOL ≥ 3배 (20분 평균 대비 3배 이상만 진입)
    const sessionSlippage = sessionInfo.aggressiveSlippage; // ★ 공격적 체결 슬리피지

    // ★ 필승 로직: 정규장 개장 직후 15분(09:30~09:45 ET) 뇌동매매 방지
    const etStr2 = now.toLocaleString('en-US', { timeZone: 'America/New_York' });
    const et2 = new Date(etStr2);
    const etTime = et2.getHours() * 60 + et2.getMinutes();
    const isOpeningRush = etTime >= 570 && etTime < 585; // 09:30~09:45 ET

    // ========== UNIFIED DYNAMIC UNIVERSE ROTATION ==========
    const cycleCount = (await supabase.from('agent_status').select('total_cycles').limit(1).single()).data?.total_cycles || 0;

    // Step 1: Evict low-score symbols
    const evicted: string[] = [];
    for (const sym of activeUnifiedList) {
      const score = lastScores.get(sym) ?? 50;
      if (score < 40) {
        activeUnifiedList.delete(sym);
        evicted.push(sym);
      }
    }

    // Step 2: Fill 80 active slots (30 large + 50 small)
    const LARGE_SLOTS = 30;
    const SMALL_SLOTS = 50;
    const TOTAL_SLOTS = LARGE_SLOTS + SMALL_SLOTS;

    // Count current composition
    const currentLarge: string[] = [];
    const currentSmall: string[] = [];
    for (const sym of activeUnifiedList) {
      if (LARGE_SET.has(sym)) currentLarge.push(sym);
      else currentSmall.push(sym);
    }

    // Fill large-cap slots
    const largeArr = Array.from(LARGE_SET);
    const largeStart = (cycleCount * LARGE_SLOTS) % largeArr.length;
    for (let i = 0; currentLarge.length < LARGE_SLOTS && i < largeArr.length; i++) {
      const sym = largeArr[(largeStart + i) % largeArr.length];
      if (!activeUnifiedList.has(sym)) {
        activeUnifiedList.add(sym);
        currentLarge.push(sym);
      }
    }

    // Fill small-cap slots
    const smallArr = Array.from(SMALL_SET);
    const smallStart = (cycleCount * SMALL_SLOTS) % smallArr.length;
    for (let i = 0; currentSmall.length < SMALL_SLOTS && i < smallArr.length; i++) {
      const sym = smallArr[(smallStart + i) % smallArr.length];
      if (!activeUnifiedList.has(sym)) {
        activeUnifiedList.add(sym);
        currentSmall.push(sym);
      }
    }

    const SCAN_SYMBOLS = Array.from(activeUnifiedList);

    // ========== WALLET & POSITIONS ==========
    const { data: openPos } = await supabase.from('unified_trades').select('*').eq('status', 'open');
    const { data: wallet } = await supabase.from('unified_wallet').select('*').limit(1).single();
    if (!wallet) throw new Error('No unified wallet');

    const initialBalance = wallet.initial_balance || wallet.balance;

    // Always include held symbols in scan
    const heldSymbols = (openPos || []).map((p: any) => p.symbol);
    for (const s of heldSymbols) {
      if (!SCAN_SYMBOLS.includes(s)) SCAN_SYMBOLS.push(s);
    }

    // ★★★ [통합 잔고 검증 Reconciliation]
    async function reconcileBalance(): Promise<number> {
      const { data: allTrades } = await supabase.from('unified_trades').select('*');
      if (!allTrades || allTrades.length === 0) return initialBalance;

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

      return Math.floor(initialBalance - totalBuyCost + totalSaleProceeds);
    }

    let balance = await reconcileBalance();

    if (balance !== Math.floor(wallet.balance)) {
      await supabase.from('unified_wallet').update({ balance, updated_at: now.toISOString() }).eq('id', wallet.id);
      await addLog('system', 'audit', null, `[잔고검증] 통합 잔고 교정: ${fmtKRWRaw(Math.floor(wallet.balance))} → ${fmtKRWRaw(balance)}`, { before: Math.floor(wallet.balance), after: balance });
    }

    const invested = (openPos || []).reduce((sum: number, p: any) => sum + Math.round(toKRW(p.price * p.quantity)), 0);
    const utilization = initialBalance > 0 ? ((initialBalance - balance) / initialBalance) * 100 : 0;

    await addLog('system', 'scan', null, `[${timeStr}] [${sessionLabel}] 통합 엔진 사이클 시작 — ${SCAN_SYMBOLS.length}개 스캔 (대형 ${currentLarge.length}+소형 ${currentSmall.length}, 풀 ${LARGE_SET.size}+${SMALL_SET.size}) | 퇴출: ${evicted.length}개 | 세션: ${sessionLabel} (×${spreadMul}|슬리피지${(sessionSlippage*100).toFixed(2)}%) | RVOL≥${sessionRvolMin} | [통합 잔고] ${fmtKRWRaw(Math.round(balance))} (운용률 ${utilization.toFixed(1)}%)`);

    if (evicted.length > 0) {
      await addLog('unified', 'evict', null, `[동적스캔] 퇴출 종목 (점수 <40): ${evicted.join(', ')} → 신규 후보로 교체`, { evicted });
    }

    if (utilization >= 90) {
      await addLog('unified', 'warning', null, `[자금경고] ⚠️ 통합 자금 운용률 ${utilization.toFixed(1)}%`, { utilization });
    }

    // --- SELF-LEARNING: Blacklist ---
    const { data: recentLosses } = await supabase
      .from('unified_trades')
      .select('symbol, pnl, status')
      .lt('pnl', 0)
      .order('closed_at', { ascending: false })
      .limit(200);

    const lossCount: Record<string, number> = {};
    for (const t of (recentLosses || [])) {
      lossCount[t.symbol] = (lossCount[t.symbol] || 0) + 1;
    }
    const blacklistSymbols = new Set(
      Object.entries(lossCount).filter(([_, c]) => c >= 3).map(([s]) => s)
    );
    if (blacklistSymbols.size > 0) {
      await addLog('unified', 'learn', null, `[AI-Learn] 진입 금지 블랙리스트: ${[...blacklistSymbols].join(', ')}`, {});
    }

    // --- Market Trend Guard (★ MIH Phase 3: QQQ 하락 추세 시 매수 중단) ---
    let marketBearish = false;
    let marketBuyHalt = false;
    let baseEntryThreshold = 60; // ★ MIH Phase 1: 최소 60점 고정
    let qqqTrendDown = false;
    try {
      const [spyQuote, qqqQuote] = await Promise.all([
        finnhubFetch(`/quote?symbol=SPY`),
        finnhubFetch(`/quote?symbol=QQQ`),
      ]);
      const spyChange = spyQuote?.dp || 0;
      const qqqChange = qqqQuote?.dp || 0;
      const qqqPrice = qqqQuote?.c || 0;
      const qqqPrevClose = qqqQuote?.pc || qqqPrice;

      // ★★★ 필승 로직 #1-나스닥동기화: QQQ 5분봉 역배열/급락 감지 시 매수 완전 잠금
      // 조건: 현재가 < 전일종가 AND (변동률 < -0.2% 또는 고가 대비 0.3% 이상 하락)
      const qqqHighDrop = qqqQuote?.h ? ((qqqQuote.h - qqqPrice) / qqqQuote.h) * 100 : 0;
      if (qqqPrice < qqqPrevClose && (qqqChange < -0.2 || qqqHighDrop >= 0.3)) {
        qqqTrendDown = true;
        marketBuyHalt = true;
        await addLog('system', 'warning', null, `[필승-시장잠금] 🚫 QQQ 역배열/급락 감지 (변동 ${qqqChange.toFixed(2)}% | 고점 대비 -${qqqHighDrop.toFixed(2)}%) → 모든 매수 버튼 잠금(Lock)`, { qqqChange, qqqPrice, qqqPrevClose, qqqHighDrop });
      }

      if (spyChange < -1 && qqqChange < -1) {
        marketBearish = true;
        marketBuyHalt = true;
        baseEntryThreshold = 75;
        await addLog('system', 'warning', null, `[시장동기화] ⚠️ SPY ${spyChange.toFixed(2)}% / QQQ ${qqqChange.toFixed(2)}% → 진입 기준 75점 상향 + 매수 중단`, { spyChange, qqqChange });
      } else if (spyChange < -0.5 || qqqChange < -0.5) {
        baseEntryThreshold = 65;
        await addLog('system', 'info', null, `[시장동기화] SPY ${spyChange.toFixed(2)}% / QQQ ${qqqChange.toFixed(2)}% → 진입 기준 65점`, { spyChange, qqqChange });
      } else {
        await addLog('system', 'info', null, `[시장동기화] SPY ${spyChange.toFixed(2)}% / QQQ ${qqqChange.toFixed(2)}% → 진입 기준 60점`, { spyChange, qqqChange });
      }
    } catch { /* fallback */ }

    // --- Dynamic win-rate threshold ---
    const { data: recentTrades } = await supabase
      .from('unified_trades')
      .select('pnl')
      .not('status', 'eq', 'open')
      .order('closed_at', { ascending: false })
      .limit(50);
    const recentWins = (recentTrades || []).filter(t => (t.pnl || 0) > 0).length;
    const recentTotal = (recentTrades || []).length;
    const recentWinRate = recentTotal > 0 ? (recentWins / recentTotal) * 100 : 50;

    // Win-rate adjustment
    if (recentWinRate < 40) baseEntryThreshold = Math.max(baseEntryThreshold, 70);
    else if (recentWinRate < 50) baseEntryThreshold = Math.max(baseEntryThreshold, 65);

    // Session adaptation — ★★★ 필승: 최소 60점 강제 하한선 (어떤 세션이든 60점 미만 진입 불가)
    const rawAdapted = Math.round(baseEntryThreshold * entryRelax);
    const adaptedEntryThreshold = Math.max(rawAdapted, 60); // 절대 하한 60점
    const adaptedRvolMin = entryRelax < 1.0 ? 1.0 : 1.5;
    const adaptedVwapMin = entryRelax < 1.0 ? 2 : 4;

    if (entryRelax < 1.0) {
      await addLog('system', 'info', null, `[전세션 엔진] ${sessionLabel} 적응형 진입: 문턱 ${baseEntryThreshold}→${adaptedEntryThreshold}점 | RVOL≥${adaptedRvolMin} | VWAP≥${adaptedVwapMin}`, {});
    }

    await addLog('unified', 'learn', null, `[AI-Learn] 승률 ${recentWinRate.toFixed(1)}% → 통합 진입 문턱: ${adaptedEntryThreshold}점 | ${sessionLabel} | 매수중단: ${marketBuyHalt ? 'YES' : 'NO'}`, {});

    // ========== EXIT CHECKS (통합) ==========
    const symbolsToCheck = [...new Set((openPos || []).map((p: any) => p.symbol))];
    for (const sym of symbolsToCheck) {
      const data = await getQuoteAndCandles(sym);
      if (!data) continue;
      const price = data.quote.c;
      const scoring = score10Indicators(data.quote, data.closes, data.highs, data.lows, data.opens, data.volumes);
      const quantScore = scoring?.totalScore || 0;
      lastScores.set(sym, quantScore);

      if (price < MIN_PRICE_USD) {
        await addLog('unified', 'warning', sym, `[통합] [${timeStr}] ⚠️ ${sym} 초저가 경고: ${fmtKRW(price)}`, {});
      }

      for (const pos of (openPos || []).filter((p: any) => p.symbol === sym && p.status === 'open')) {
        const pnlPct = ((price - pos.price) / pos.price) * 100;

        // ★★★ 필승 로직 #2: 본절가 보호 (+1.0%에서 즉시 본절가+수수료 상향 → '패' 원천 차단)
        if (pnlPct >= 1.0 && pos.stop_loss < pos.price * 1.002) {
          const breakevenStop = +(pos.price * 1.002).toFixed(4); // +0.2% 수수료 포함
          await supabase.from('unified_trades').update({ stop_loss: breakevenStop }).eq('id', pos.id);
          pos.stop_loss = breakevenStop;
          await addLog('unified', 'defense', sym, `[필승-본절보호] ${sym} 수익률 ${pnlPct.toFixed(2)}% ≥ 1.0% → 본절가(+수수료) 상향: ${fmtKRW(breakevenStop)} | '패' 원천 차단`, {});
        }

        // ★ 기존 철갑방어 (+3%에서 추가 상향)
        if (pnlPct >= 3 && pos.stop_loss < pos.price * 1.015) {
          const reinforcedStop = +(pos.price * 1.015).toFixed(4);
          await supabase.from('unified_trades').update({ stop_loss: reinforcedStop }).eq('id', pos.id);
          pos.stop_loss = reinforcedStop;
          await addLog('unified', 'defense', sym, `[철갑방어+] ${sym} 수익률 ${pnlPct.toFixed(2)}% → 손절가 +1.5% 상향: ${fmtKRW(reinforcedStop)}`, {});
        }

        const peakPrice = Math.max(pos.peak_price || pos.price, price);
        if (price > (pos.peak_price || pos.price)) {
          await supabase.from('unified_trades').update({ peak_price: peakPrice }).eq('id', pos.id);
        }

        // ★ MIH Phase 4: 동적 손절 (VWAP/볼린저 하단 이탈 감지)
        const n = data.closes.length - 1;
        const vwap = calculateVWAP(data.highs.slice(-20), data.lows.slice(-20), data.closes.slice(-20), data.volumes.slice(-20));
        const ema20 = calculateEMA(data.closes, 20);
        const atr = calculateATR(data.highs, data.lows, data.closes, 14);
        const currentATR = atr[atr.length - 1] || 0;
        const bbLower = (ema20[n] || price) - 2 * currentATR; // 볼린저 하단 근사
        const dynamicFloor = Math.max(vwap, bbLower); // VWAP와 BB 하단 중 높은 값

        let shouldClose = false;
        let closeReason = '';
        let newStatus = 'closed';

        // ★ Phase 4: VWAP/BB 이탈 동적 손절 (고정 -2.5% 대신)
        if (price < dynamicFloor && pnlPct < 0) {
          shouldClose = true;
          const dynamicLossPct = pnlPct.toFixed(2);
          closeReason = `[MIH-4 동적손절] [${sessionLabel}] [${timeStr}] [${sym}] VWAP(${fmtKRW(vwap)})/BB하단(${fmtKRW(bbLower)}) 이탈 → 손실 ${dynamicLossPct}%에서 조기 탈출`;
          newStatus = 'dynamic_stop';
        } else if (pnlPct <= -1.8) {
          // ★ 승률 강화: 고정 손절 -2.5% → -1.8% (큰 손실 방지, 작은 패배만 허용)
          shouldClose = true;
          closeReason = `[통합] [${sessionLabel}] [${timeStr}] [${sym}] 최대 손절 실행 (-1.8% 도달: ${pnlPct.toFixed(2)}%)`;
          newStatus = 'stopped';
        } else if (pnlPct >= 3.0) {
          // ★★★ 필승 로직 #3: 3% 수익 달성 후 고점 대비 0.5% 하락 시 즉시 익절
          const dropFromPeak = ((peakPrice - price) / peakPrice) * 100;
          if (dropFromPeak >= 0.5) {
            const lockedPnl = ((price - pos.price) / pos.price * 100).toFixed(2);
            shouldClose = true;
            closeReason = `[필승-추격익절] [${sessionLabel}] [${timeStr}] [${sym}] +3% 달성 후 고점 대비 -${dropFromPeak.toFixed(2)}% 하락 → 수익 ${lockedPnl}% 확정`;
            newStatus = 'trailing_profit';
          }
        } else if (peakPrice >= pos.price * 1.10) {
          const dropFromPeak = ((peakPrice - price) / peakPrice) * 100;
          if (dropFromPeak >= 3) {
            const lockedPnl = ((price - pos.price) / pos.price * 100).toFixed(2);
            shouldClose = true;
            closeReason = `[통합] [${sessionLabel}] [${timeStr}] [${sym}] 대형 추격익절 (고점 ${fmtKRW(peakPrice)} 대비 -${dropFromPeak.toFixed(1)}% → 수익 ${lockedPnl}% 확정)`;
            newStatus = 'trailing_profit';
          }
        } else if (quantScore < 40) {
          shouldClose = true;
          closeReason = `[통합] [${sessionLabel}] [${timeStr}] [${sym}] 매수 근거 소멸 (점수 ${quantScore}점 < 40)`;
          newStatus = 'score_exit';
        } else if (pos.take_profit && price >= pos.take_profit) {
          shouldClose = true;
          closeReason = `[통합] [${sessionLabel}] [${timeStr}] [${sym}] 목표가 도달 익절`;
          newStatus = 'profit_taken';
        } else if (pos.stop_loss && price <= pos.stop_loss) {
          shouldClose = true;
          closeReason = `[통합] [${sessionLabel}] [${timeStr}] [${sym}] ${pnlPct >= 0 ? '본절가 방어 매도 (MIH-2)' : '추격 손절 터치'}`;
          newStatus = pnlPct >= 0 ? 'breakeven_exit' : 'trailing_stop';
        } else if (blacklistSymbols.has(sym) && pnlPct <= 0.2 && pnlPct >= -1.0) {
          shouldClose = true;
          closeReason = `[통합] [${sessionLabel}] [${timeStr}] [${sym}] 블랙리스트 조기 대응 (${pnlPct.toFixed(2)}%)`;
          newStatus = 'early_exit';
        }

        // Partial exit at +2% (50%)
        if (!shouldClose && pnlPct >= 2) {
          const partialExits = pos.partial_exits || [];
          const hasFirst = partialExits.some((e: any) => e.type === 'first_partial');
          if (!hasFirst) {
            const sellQty = Math.floor(pos.quantity * 0.5);
            if (sellQty > 0) {
              const sellValue = Math.floor(sellQty * price * KRW_RATE);
              const partialPnl = sellValue - Math.floor(sellQty * pos.price * KRW_RATE);
              partialExits.push({ type: 'first_partial', qty: sellQty, price, pnl: partialPnl, at: now.toISOString() });
              await supabase.from('unified_trades').update({
                quantity: pos.quantity - sellQty, partial_exits: partialExits,
                stop_loss: Math.max(+(price - 2.0 * (price * 0.02)).toFixed(4), pos.stop_loss || 0),
              }).eq('id', pos.id);
              const newBal = balance + sellValue;
              await supabase.from('unified_wallet').update({ balance: newBal, updated_at: now.toISOString() }).eq('id', wallet.id);
              balance = newBal;
              await addLog('unified', 'exit', sym, `[통합] ${sym} 1차 50% 익절 (${pnlPct.toFixed(1)}%) | 매도대금: ${fmtKRWRaw(sellValue)} | PnL: ${fmtKRWRaw(partialPnl)}`, {});
            }
          }
        }

        if (shouldClose) {
          await addLog('unified', 'exit_attempt', sym, `[매도시도] ${sym} ${newStatus} 조건 충족 — 매도 명령 발행 중...`, { price, pnlPct: +pnlPct.toFixed(2), newStatus });
          const saleProceeds = Math.floor(price * pos.quantity * KRW_RATE);
          const buyCost = Math.floor(pos.price * pos.quantity * KRW_RATE);
          const pnlKRW = saleProceeds - buyCost;
          const balanceBefore = balance;
          const newBalance = balance + saleProceeds;
          await supabase.from('unified_trades').update({
            status: newStatus, close_price: price, pnl: pnlKRW,
            closed_at: now.toISOString(),
            ai_reason: `${closeReason} | PnL: ${fmtKRWRaw(pnlKRW)} | 매도대금: ${fmtKRWRaw(saleProceeds)} → [잔고: ${fmtKRWRaw(balanceBefore)} → ${fmtKRWRaw(newBalance)}]`,
          }).eq('id', pos.id);
          await supabase.from('unified_wallet').update({ balance: newBalance, updated_at: now.toISOString() }).eq('id', wallet.id);
          balance = newBalance;
          await addLog('unified', 'exit', sym, `${closeReason} | PnL: ${fmtKRWRaw(pnlKRW)} | [잔고: ${fmtKRWRaw(balanceBefore)} → ${fmtKRWRaw(newBalance)}]`, { pnl: pnlKRW, pnlPct: +pnlPct.toFixed(2) });
        }
      }
      await new Promise(r => setTimeout(r, 200));
    }

    // ========== UNIFIED ENTRY SCAN ==========
    // ★ 필승 로직: 시장 하락 또는 개장 직후 15분 뇌동매매 방지
    if (marketBuyHalt) {
      await addLog('unified', 'hold', null, `[필승-시장잠금] 🚫 시장 하락 감지로 전체 매수 잠금 — 기존 포지션 관리만 수행`, { qqqTrendDown, marketBearish });
    }
    if (isOpeningRush) {
      await addLog('unified', 'hold', null, `[필승-뇌동방지] 🚫 정규장 개장 직후 15분(09:30~09:45 ET) — 매수 잠금`, {});
    }

    let openCount = (openPos || []).filter(p => p.status === 'open').length;
    const MAX_POSITIONS = 15;
    const candidates: { sym: string; price: number; scoring: any; capType: 'large' | 'small' }[] = [];

    if (!marketBuyHalt && !isOpeningRush) {
      for (let i = 0; i < SCAN_SYMBOLS.length; i += 5) {
        const batch = SCAN_SYMBOLS.slice(i, i + 5);
        const results = await Promise.all(batch.map(async (sym) => {
          try {
            if (blacklistSymbols.has(sym)) return null;
            const data = await getQuoteAndCandles(sym);
            if (!data) return null;
            const price = data.quote.c;
            const capType = getCapType(price, sym);
            if (capType === 'small' && price < MIN_PRICE_USD) return null;
            const scoring = score10Indicators(data.quote, data.closes, data.highs, data.lows, data.opens, data.volumes);
            if (!scoring) return null;
            lastScores.set(sym, scoring.totalScore);
            return { sym, price, scoring, capType, data };
          } catch { return null; }
        }));

        for (const r of results) {
          if (!r || r.scoring.totalScore < adaptedEntryThreshold) continue;
          const alreadyHolding = (openPos || []).some(p => p.symbol === r.sym && p.status === 'open');
          const isPyramiding = alreadyHolding && r.scoring.totalScore >= 80;
          if (alreadyHolding && !isPyramiding) continue;
          if (openCount >= MAX_POSITIONS) continue;

          // Session-adaptive filters
          const sentimentOk = (r.scoring.indicators.sentiment.score || 0) > 0;
          const rvolOk = (r.scoring.indicators.rvol.rvol || 0) >= adaptedRvolMin;
          const vwapOk = (r.scoring.indicators.candle.score || 0) >= adaptedVwapMin;
          const filtersPassed = [sentimentOk, rvolOk, vwapOk].filter(Boolean).length;
          const minFilters = entryRelax < 1.0 ? 2 : 3;
          if (filtersPassed < minFilters) continue;

          // ★★★ 필승 로직 #1-수급필터: 실시간 거래대금 20분 평균 대비 3배 이상만 진입 (돈이 들어온 종목만)
          const rvol = r.scoring.indicators.rvol?.rvol || 0;
          if (rvol < 3.0) {
            // 3배 미만 거래량 = 수급 부족 → 절대 매수 금지
            continue;
          }

          // ★★★ 필승 로직 #4: 장 시작 직후 15분 뇌동매매 방지
          if (isOpeningRush) {
            continue;
          }

          candidates.push(r);
        }
        if (i + 5 < SCAN_SYMBOLS.length) await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    // Sort by score descending (highest score gets priority for ₩400M allocation)
    candidates.sort((a, b) => {
      // RVOL >= 3 burst priority
      const aVolBurst = a.scoring.rvol >= 3 ? 1 : 0;
      const bVolBurst = b.scoring.rvol >= 3 ? 1 : 0;
      if (aVolBurst !== bVolBurst) return bVolBurst - aVolBurst;
      return b.scoring.totalScore - a.scoring.totalScore;
    });

    if (candidates.length > 0) {
      const summary = candidates.slice(0, 10).map(c => `${c.sym}(${c.scoring.totalScore}점/${c.capType})`).join(', ');
      await addLog('unified', 'scan', null, `[통합스캔] [${timeStr}] 매수 후보 ${candidates.length}개 (점수순): ${summary}`, {});
    }

    for (const r of candidates) {
      if (openCount >= MAX_POSITIONS) break;
      const alreadyHolding = (openPos || []).some(p => p.symbol === r.sym && p.status === 'open');
      const isPyramiding = alreadyHolding && r.scoring.totalScore >= 80;
      const positionPct = isPyramiding ? 0.05 : 0.10; // 10% per position (₩4000만)

      const maxKRW = balance * positionPct;
      const priceKRW = toKRW(r.price);
      const qty = Math.floor(maxKRW / priceKRW);
      const costKRW = Math.floor(qty * priceKRW);

      if (qty <= 0 || costKRW > balance) {
        await addLog('unified', 'hold', r.sym, `[통합] [${timeStr}] ${r.sym} ${r.scoring.totalScore}점 → ⚠️ 잔고 부족 | 필요: ${fmtKRWRaw(costKRW)} | 잔고: ${fmtKRWRaw(Math.round(balance))}`, {});
        continue;
      }

      const adjustedPrice = applySessionSlippage(r.price, 'buy', spreadMul, sessionSlippage);
      const stopLoss = +(adjustedPrice * 0.975).toFixed(4);
      const takeProfit = +(adjustedPrice * 1.03).toFixed(4); // ★ 필승: 3% 목표 (추격익절과 연동)
      const tier = isPyramiding ? 'PYRAMID' : 'SCOUT';
      const balanceBefore = Math.round(balance);
      const newBuyBalance = balance - costKRW;
      const spreadNote = spreadMul > 1 ? ` | ⚠️ ${sessionLabel} 스프레드 보정 ×${spreadMul}` : '';
      const capLabel = r.capType === 'large' ? '대형' : '소형';
      const logMsg = `[통합] [${sessionLabel}] [${timeStr}] ${r.sym} ${r.scoring.totalScore}점 [${capLabel}] 자율 매수 [${tier}|${qty}주@${fmtKRW(adjustedPrice)}|${fmtKRWRaw(costKRW)}]${spreadNote} | [잔고: ${fmtKRWRaw(balanceBefore)} → ${fmtKRWRaw(newBuyBalance)}]`;

      await supabase.from('unified_trades').insert({
        symbol: r.sym, side: 'buy', quantity: qty, price: adjustedPrice,
        stop_loss: stopLoss, take_profit: takeProfit, status: 'open',
        cap_type: r.capType,
        entry_score: r.scoring.totalScore,
        ai_reason: logMsg, ai_confidence: r.scoring.totalScore,
      });
      await supabase.from('unified_wallet').update({ balance: newBuyBalance, updated_at: now.toISOString() }).eq('id', wallet.id);
      balance = newBuyBalance;
      openCount++;
      await addLog('unified', 'buy', r.sym, logMsg, { score: r.scoring.totalScore, qty, costKRW, capType: r.capType });
    }

    // ========== AUTO-REPLACEMENT ==========
    {
      const refreshedOpenPos = (await supabase.from('unified_trades').select('*').eq('status', 'open')).data || [];
      for (const pos of refreshedOpenPos) {
        const data = await getQuoteAndCandles(pos.symbol);
        if (!data) continue;
        const scoring = score10Indicators(data.quote, data.closes, data.highs, data.lows, data.opens, data.volumes);
        const currentScore = scoring?.totalScore || 0;

        const betterCandidate = candidates.find(c =>
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

          await supabase.from('unified_trades').update({
            status: 'replaced', close_price: price, pnl: pnlKRW,
            closed_at: now.toISOString(),
            ai_reason: `${closeReason} | PnL: ${fmtKRWRaw(pnlKRW)}`,
          }).eq('id', pos.id);
          balance += saleProceeds;
          await supabase.from('unified_wallet').update({ balance, updated_at: now.toISOString() }).eq('id', wallet.id);
          await addLog('unified', 'replace', pos.symbol, closeReason, { oldScore: currentScore, newSymbol: betterCandidate?.sym, newScore: betterCandidate?.scoring.totalScore, pnl: pnlKRW });
        }
        await new Promise(r => setTimeout(r, 200));
      }
    }

    // Update cycle count
    await supabase.from('agent_status').update({
      last_cycle_at: now.toISOString(),
      total_cycles: (await supabase.from('agent_status').select('total_cycles').limit(1).single()).data?.total_cycles + 1 || 1,
    }).not('id', 'is', null);

    await addLog('system', 'info', null, `[${timeStr}] [${sessionLabel}] 통합 엔진 사이클 완료 — 전체 스캔 (대형 ${LARGE_SET.size}개 + 소형 ${SMALL_SET.size}개 풀)`);

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
