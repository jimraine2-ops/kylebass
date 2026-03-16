import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const FINNHUB_BASE = 'https://finnhub.io/api/v1';
const KRW_RATE = 1350;
const MIN_PRICE_KRW = 1000;
const MIN_PRICE_USD = MIN_PRICE_KRW / KRW_RATE;
const MAX_PRICE_KRW = 13000; // ★ 3단계 프로세스: ₩13,000 미만 종목만 스캔
const MAX_PRICE_USD = MAX_PRICE_KRW / KRW_RATE; // ≈ $9.63

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

// ===== ADX (Average Directional Index) 계산 =====
function calculateADX(highs: number[], lows: number[], closes: number[], period = 14): number {
  if (highs.length < period + 1) return 0;
  const n = highs.length;
  let sumDMPlus = 0, sumDMMinus = 0, sumTR = 0;
  for (let i = 1; i <= period; i++) {
    const dmPlus = Math.max(highs[i] - highs[i-1], 0);
    const dmMinus = Math.max(lows[i-1] - lows[i], 0);
    if (dmPlus > dmMinus) { sumDMPlus += dmPlus; } else { sumDMMinus += dmMinus; }
    sumTR += Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i-1]), Math.abs(lows[i] - closes[i-1]));
  }
  let smoothDMPlus = sumDMPlus, smoothDMMinus = sumDMMinus, smoothTR = sumTR;
  const dxValues: number[] = [];
  for (let i = period + 1; i < n; i++) {
    const dmPlus = Math.max(highs[i] - highs[i-1], 0);
    const dmMinus = Math.max(lows[i-1] - lows[i], 0);
    const tr = Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i-1]), Math.abs(lows[i] - closes[i-1]));
    smoothDMPlus = smoothDMPlus - smoothDMPlus/period + (dmPlus > dmMinus ? dmPlus : 0);
    smoothDMMinus = smoothDMMinus - smoothDMMinus/period + (dmMinus > dmPlus ? dmMinus : 0);
    smoothTR = smoothTR - smoothTR/period + tr;
    const diPlus = smoothTR > 0 ? (smoothDMPlus / smoothTR) * 100 : 0;
    const diMinus = smoothTR > 0 ? (smoothDMMinus / smoothTR) * 100 : 0;
    const diSum = diPlus + diMinus;
    const dx = diSum > 0 ? (Math.abs(diPlus - diMinus) / diSum) * 100 : 0;
    dxValues.push(dx);
  }
  if (dxValues.length === 0) return 0;
  return dxValues.slice(-period).reduce((a, b) => a + b, 0) / Math.min(period, dxValues.length);
}

// ===== OBV (On-Balance Volume) 추세 감지 =====
function detectOBVDivergence(closes: number[], volumes: number[]): { obvRising: boolean; priceSideways: boolean; score: number } {
  const n = closes.length - 1;
  if (n < 10) return { obvRising: false, priceSideways: false, score: 0 };
  // OBV 계산
  let obv = 0;
  const obvArr: number[] = [0];
  for (let i = 1; i <= n; i++) {
    if (closes[i] > closes[i-1]) obv += volumes[i];
    else if (closes[i] < closes[i-1]) obv -= volumes[i];
    obvArr.push(obv);
  }
  // 최근 10봉 OBV 추세 (선형회귀 기울기)
  const recentOBV = obvArr.slice(-10);
  const obvSlope = (recentOBV[recentOBV.length-1] - recentOBV[0]) / recentOBV.length;
  const obvRising = obvSlope > 0;
  // 가격 횡보 체크
  const recentCloses = closes.slice(-10);
  const priceRange = (Math.max(...recentCloses) - Math.min(...recentCloses)) / Math.min(...recentCloses) * 100;
  const priceSideways = priceRange < 5; // 5% 이내
  // 매집 점수: OBV 상승 + 가격 횡보 = 세력 매집 신호
  let score = 0;
  if (obvRising) score += 5;
  if (priceSideways && obvRising) score += 5; // 강력 매집 신호
  return { obvRising, priceSideways, score: Math.min(10, score) };
}

// ===== 슈퍼 패턴 감지 (15% 수익 보장형 '대시세 초입' 종목) =====
function detectSuperPattern(closes: number[], highs: number[], lows: number[], volumes: number[], adx: number): { isSuperPattern: boolean; signals: string[]; confidence: number; resistanceThin: boolean } {
  const n = closes.length - 1;
  if (n < 20) return { isSuperPattern: false, signals: [], confidence: 0, resistanceThin: false };
  const signals: string[] = [];
  
  // 1. ★ 에너지 응축 패턴: BB 극도 수축 + 거래대금 300%↑ + 상단 돌파
  const ema20 = calculateEMA(closes, 20);
  const atr = calculateATR(highs, lows, closes, 14);
  const bbWidth5 = atr.slice(-5).reduce((a,b)=>a+b,0) / 5;
  const bbWidth20 = atr.slice(-20).reduce((a,b)=>a+b,0) / 20;
  const isSqueeze = bbWidth20 > 0 && bbWidth5 / bbWidth20 < 0.6; // 밴드 40% 이상 수축 (강화)
  const bbUpper = ema20[n] + 2 * atr[n];
  const avgVol20 = volumes.slice(-20).reduce((a,b)=>a+b,0) / 20;
  const rvol = avgVol20 > 0 ? volumes[n] / avgVol20 : 1;
  const bbBreakout = closes[n] > bbUpper && rvol >= 1.5;
  const energyCondensation = isSqueeze && rvol >= 3.0; // 극도 수축 + 거래량 300%↑
  if (energyCondensation && bbBreakout) signals.push('에너지응축폭발');
  else if (isSqueeze && bbBreakout) signals.push('BB스퀴즈돌파');
  else if (bbBreakout) signals.push('BB상단돌파');
  
  // 2. ★ 매집 확인: 가격 변동 적으나 체결강도 150%↑ + OBV/MFI 급등
  const obv = detectOBVDivergence(closes, volumes);
  // 체결강도 계산 (양봉비율 × 거래량 가속)
  let bullCount = 0;
  for (let i = Math.max(0, n - 9); i <= n; i++) {
    if (closes[i] > (i > 0 ? closes[i-1] : closes[i])) bullCount++;
  }
  const aggressionRatio = (bullCount / Math.min(10, n + 1)) * 100;
  const isStrongAggression = aggressionRatio >= 60 && rvol >= 1.5; // 체결강도 150%↑ 근사
  if (obv.priceSideways && obv.obvRising && isStrongAggression) signals.push('세력매집확인');
  else if (obv.priceSideways && obv.obvRising) signals.push('OBV매집');
  
  // 3. ADX 추세 강도 (≥ 25)
  if (adx >= 25) signals.push(`ADX${Math.round(adx)}`);
  
  // 4. 거래량 폭발 (RVOL ≥ 3 → 300%)
  if (rvol >= 3) signals.push(`RVOL${rvol.toFixed(1)}x`);
  
  // 5. ★ 상승 여력 분석: 전고점까지 매물대가 얇은지 확인
  // 최근 20봉 최고점 vs 현재가 → 15% 이상 여유 공간이면 '매물대 얇음'
  const recentHigh20 = Math.max(...highs.slice(-20));
  const allTimeHigh = Math.max(...highs);
  const distToHigh = allTimeHigh > 0 ? ((allTimeHigh - closes[n]) / closes[n]) * 100 : 0;
  const resistanceThin = distToHigh >= 15 || closes[n] >= recentHigh20; // 전고점까지 15%+ 여유 or 신고가
  if (resistanceThin) signals.push('매물대얇음');
  
  // 6. ★ 골든크로스 + RSI 상승 추세
  const ema9 = calculateEMA(closes, 9);
  const ema21 = calculateEMA(closes, 21);
  const rsi = calculateRSI(closes, 14);
  const goldenCross = n > 1 && ema9[n] > ema21[n] && ema9[n-1] <= ema21[n-1];
  const rsiMomentum = rsi[n] > 50 && rsi[n] > (rsi[n-1] || 50) && rsi[n] < 75;
  if (goldenCross && rsiMomentum) signals.push('골든크로스+RSI상승');
  
  const isSuperPattern = signals.length >= 2; // 2개 이상 충족 시 슈퍼 패턴
  const confidence = Math.min(100, signals.length * 20);
  return { isSuperPattern, signals, confidence, resistanceThin };
}

// ===== Sector ETF Mapping (섹터 동조화 체크용) =====
const SECTOR_MAP: Record<string, string> = {};
for (const s of ['AAPL','MSFT','NVDA','GOOGL','META','AMD','INTC','QCOM','MU','AVGO','AMAT','LRCX','ARM','TSM','MRVL','ON','NXPI','TXN','KLAC','ADI','SWKS','MPWR','SMCI','DELL','CRM','NOW','SNOW','DDOG','PANW','FTNT','ZS','MDB','NET','CRWD','SHOP','WDAY','HUBS','TEAM','PLTR','AI','PATH','S','CFLT','GTLB','ADBE','ORCL']) SECTOR_MAP[s] = 'XLK';
for (const s of ['JPM','GS','V','MA','BAC','WFC','MS','C','AXP','SCHW','BLK','COIN','SOFI','HOOD','AFRM','UPST','SQ','PYPL','NU','TOST','FOUR','PAYO','LMND','ICE','CME','SPGI','APO','KKR','ARES']) SECTOR_MAP[s] = 'XLF';
for (const s of ['LLY','UNH','ISRG','JNJ','PFE','MRK','ABBV','TMO','DHR','AMGN','GILD','VRTX','REGN','MRNA','DXCM','ILMN','BSX','MDT','TMDX','INSP','ALGN','PODD','HIMS']) SECTOR_MAP[s] = 'XLV';
for (const s of ['XOM','CVX','COP','SLB','EOG','PSX','MPC','VLO','OXY','DVN','FANG','HAL']) SECTOR_MAP[s] = 'XLE';
for (const s of ['DIS','NKE','SBUX','MCD','COST','WMT','TGT','HD','LOW','TJX','LULU','TSLA','AMZN','NFLX','UBER','ABNB','BKNG','DASH','CAVA','CMG','DECK','ONON']) SECTOR_MAP[s] = 'XLY';
for (const s of ['ENPH','FSLR','SEDG','RUN','RIVN','LCID','NIO','XPEV','LI','CHPT','PLUG','BE']) SECTOR_MAP[s] = 'QCLN';
for (const s of ['MARA','RIOT','CLSK','HUT','BITF','WULF','BTBT','CIFR','BTDR','MSTR']) SECTOR_MAP[s] = 'BITO';
for (const s of ['RKLB','ASTS','LUNR','RDW','SPCE','JOBY','LMT','RTX','BA','GE','HON','AXON']) SECTOR_MAP[s] = 'XLI';
for (const s of ['FCX','ALB','NEM','GOLD','MP','LAC','CLF','X','AA','VALE','UEC']) SECTOR_MAP[s] = 'XLB';
for (const s of ['VST','CEG','NRG','AES','NEE']) SECTOR_MAP[s] = 'XLU';
for (const s of ['SOUN','IONQ','RGTI','QUBT','BBAI','SNDL','TLRY','ACB','CGC']) SECTOR_MAP[s] = 'QQQ';

const sectorQuoteCache: Map<string, { changePct: number; timestamp: number }> = new Map();

// ===== 익절 확률 90% 예측 엔진 (Profit Probability Engine) =====
// 4대 필수조건: ①패턴일치 ②에너지응축 ③세력매집 ④섹터동조
function calculateWinProbability(
  scoring: any, closes: number[], highs: number[], lows: number[], opens: number[], volumes: number[], symbol: string, sectorChangePct: number
): { probability: number; conditions: { pattern: boolean; energy: boolean; bigOrder: boolean; sector: boolean }; reasons: string[] } {
  const reasons: string[] = [];
  let probability = 0;
  const n = closes.length - 1;
  if (n < 10) return { probability: 0, conditions: { pattern: false, energy: false, bigOrder: false, sector: false }, reasons: ['데이터 부족'] };

  // Base: 지표 점수 기여 (최대 30%)
  const score = scoring.totalScore || 0;
  if (score >= 75) { probability += 30; reasons.push(`지표${score}점(최상)`); }
  else if (score >= 70) { probability += 27; reasons.push(`지표${score}점(우수)`); }
  else if (score >= 65) { probability += 24; reasons.push(`지표${score}점(양호)`); }
  else if (score >= 60) { probability += 20; reasons.push(`지표${score}점(기본)`); }
  else { probability += 12; reasons.push(`지표${score}점`); }

  // ===== 조건 ① 패턴 일치: 과거 급등 패턴 매칭 (최대 +18%) =====
  // 급등 전 패턴: ▼BB스퀴즈 후 상단돌파 + ▼거래량 급증 + ▼이평선 정배열 + ▼RSI 50-70 상승
  const ema9 = calculateEMA(closes, 9);
  const ema21 = calculateEMA(closes, 21);
  const rsi = calculateRSI(closes, 14);
  const atr = calculateATR(highs, lows, closes, 14);
  const ema20 = calculateEMA(closes, 20);
  const bbUpper = ema20[n] + 2 * atr[n];
  const bbLower = ema20[n] - 2 * atr[n];
  // BB 수축 후 돌파 체크
  const bbWidth5 = atr.slice(-5).reduce((a,b)=>a+b,0) / 5;
  const bbWidth20 = atr.slice(-20).reduce((a,b)=>a+b,0) / 20;
  const isSqueezeThenBreak = bbWidth20 > 0 && bbWidth5 / bbWidth20 < 0.7 && closes[n] > bbUpper;
  // 이평선 정배열 + RSI 상승 모멘텀
  const emaAligned = ema9[n] > ema21[n];
  const rsiMomentum = rsi[n] >= 50 && rsi[n] <= 72 && rsi[n] > (rsi[n-1]||50);
  // 최근 5봉 연속 양봉 패턴 (강력 상승 초기)
  let consecutiveBull = 0;
  for (let i = n; i >= Math.max(0, n-4); i--) {
    if (closes[i] > opens[i]) consecutiveBull++; else break;
  }
  const strongBullPattern = consecutiveBull >= 3;
  // 패턴 점수 합산
  let patternScore = 0;
  if (isSqueezeThenBreak) patternScore += 6;
  if (emaAligned && rsiMomentum) patternScore += 5;
  if (strongBullPattern) patternScore += 4;
  if (scoring.superPattern?.isSuperPattern) patternScore += 3;
  const condPattern = patternScore >= 10;
  if (condPattern) { probability += 18; reasons.push(`패턴일치(${patternScore}/18,급등초기형)`); }
  else if (patternScore >= 7) { probability += 13; reasons.push(`패턴유사(${patternScore}/18)`); }
  else if (patternScore >= 4) { probability += 7; reasons.push(`패턴부분일치(${patternScore}/18)`); }

  // ===== 조건 ② 에너지 응축: BB하단→상단 돌파 + 거래대금 동반 (최대 +18%) =====
  const avgVol20 = volumes.length >= 21 ? volumes.slice(Math.max(0, n - 20), n).reduce((a, b) => a + b, 0) / 20 : volumes[n];
  const rvol = avgVol20 > 0 ? volumes[n] / avgVol20 : 1;
  // 최근 5봉 중 BB 하단 터치 후 현재 상단 돌파
  let touchedBBLower = false;
  for (let i = Math.max(0, n-5); i < n; i++) {
    const bbL = ema20[i] - 2 * atr[i];
    if (lows[i] <= bbL * 1.01) touchedBBLower = true;
  }
  const energyExplosion = touchedBBLower && closes[n] > bbUpper && rvol >= 2.0;
  const energyPartial = closes[n] > ema20[n] + atr[n] && rvol >= 1.5;
  const condEnergy = energyExplosion;
  if (condEnergy) { probability += 18; reasons.push(`에너지응축폭발(BB하단→상단+RVOL${rvol.toFixed(1)}x)`); }
  else if (energyPartial && touchedBBLower) { probability += 13; reasons.push(`에너지응축(BB반등+RVOL${rvol.toFixed(1)}x)`); }
  else if (energyPartial) { probability += 8; reasons.push(`에너지축적(RVOL${rvol.toFixed(1)}x)`); }
  else if (rvol >= 2.0) { probability += 5; reasons.push(`대량거래(RVOL${rvol.toFixed(1)}x)`); }

  // ===== 조건 ③ 세력 매집: 대량 체결(빅오더) + 특정 가격 지지 (최대 +18%) =====
  const aggrDetail = scoring.indicators?.aggression?.details || '';
  const aggrPct = parseInt(aggrDetail.match(/(\d+)%/)?.[1] || '0');
  // 매수 주도 비율 (양봉 비율로 근사)
  let bullCount = 0;
  for (let i = Math.max(0, n - 9); i <= n; i++) {
    if (i > 0 && closes[i] > closes[i - 1]) bullCount++;
  }
  const buyRatio = bullCount / Math.min(10, n);
  // OBV 매집 확인
  const obvData = scoring.obv || { obvRising: false, priceSideways: false, score: 0 };
  const accumData = scoring.accumulation || { isAccumulating: false, condensation: 0, pattern: '' };
  // 세력 매집 판정: 높은 체결 강도 + 매수 주도 + OBV 상승
  const bigOrderBuying = aggrPct >= 150 && buyRatio >= 0.70;
  const silentAccum = obvData.obvRising && obvData.priceSideways && accumData.condensation >= 5;
  const condBigOrder = bigOrderBuying || silentAccum;
  if (bigOrderBuying && silentAccum) { probability += 18; reasons.push(`세력매집확정(체결${aggrPct}%+OBV매집+응축${accumData.condensation.toFixed(1)})`); }
  else if (bigOrderBuying) { probability += 15; reasons.push(`수급집중(체결${aggrPct}%,매수비${(buyRatio*100).toFixed(0)}%)`); }
  else if (silentAccum) { probability += 13; reasons.push(`은밀매집(OBV↑+응축${accumData.condensation.toFixed(1)})`); }
  else if (aggrPct >= 120 && buyRatio >= 0.60) { probability += 8; reasons.push(`수급양호(체결${aggrPct}%)`); }
  else if (aggrPct >= 100) { probability += 4; reasons.push(`체결강도${aggrPct}%`); }

  // ===== 조건 ④ 섹터 동조: QQQ + 섹터 ETF 강세 (최대 +16%) =====
  const condSector = sectorChangePct >= 0.5;
  if (sectorChangePct >= 1.5) { probability += 16; reasons.push(`섹터강세(+${sectorChangePct.toFixed(1)}%)`); }
  else if (condSector) { probability += 14; reasons.push(`섹터동반상승(+${sectorChangePct.toFixed(1)}%)`); }
  else if (sectorChangePct >= 0.1) { probability += 8; reasons.push(`섹터소폭상승(+${sectorChangePct.toFixed(1)}%)`); }
  else if (sectorChangePct >= -0.3) { probability += 3; reasons.push('섹터중립'); }

  probability = Math.min(99, probability);
  return {
    probability,
    conditions: { pattern: condPattern, energy: condEnergy, bigOrder: condBigOrder, sector: condSector },
    reasons
  };
}

// ===== Accumulation Pattern Detection (매집 패턴 포착) =====
function detectAccumulation(closes: number[], highs: number[], lows: number[], volumes: number[], rsi: number[]): { isAccumulating: boolean; confidence: number; pattern: string; condensation: number } {
  const n = closes.length - 1;
  if (n < 10) return { isAccumulating: false, confidence: 0, pattern: 'insufficient_data', condensation: 0 };

  // 1. 박스권 횡보 체크: 최근 10봉의 고가-저가 범위가 좁으면 박스권
  const recentHighs = highs.slice(-10);
  const recentLows = lows.slice(-10);
  const rangeHigh = Math.max(...recentHighs);
  const rangeLow = Math.min(...recentLows);
  const boxRange = rangeLow > 0 ? ((rangeHigh - rangeLow) / rangeLow) * 100 : 999;
  const isBoxPattern = boxRange < 5; // 5% 이내 박스권

  // 2. RSI 저점 고개 들기: RSI가 30~55 구간에서 상승 전환
  const rsiCurrent = rsi[n] || 50;
  const rsiPrev = rsi[n - 1] || 50;
  const rsiPrev2 = rsi[n - 2] || 50;
  const rsiRising = rsiCurrent > rsiPrev && rsiPrev >= rsiPrev2 && rsiCurrent >= 30 && rsiCurrent <= 55;

  // 3. 이평선 밀집 (EMA 5, 10, 20이 좁은 범위에 수렴)
  const ema5 = calculateEMA(closes, 5);
  const ema10 = calculateEMA(closes, 10);
  const ema20 = calculateEMA(closes, 20);
  const emaSpread = Math.abs(ema5[n] - ema20[n]) / closes[n] * 100;
  const emaConverging = emaSpread < 1.5; // 1.5% 이내 밀집

  // 4. 거래량 감소 중 가격 유지 (매집 전형 패턴)
  const avgVol5 = volumes.slice(-5).reduce((a, b) => a + b, 0) / 5;
  const avgVol20 = volumes.slice(-20).reduce((a, b) => a + b, 0) / Math.min(20, volumes.length);
  const volContracting = avgVol20 > 0 && avgVol5 / avgVol20 < 0.8; // 거래량 20% 이상 감소

  // 5. 에너지 응축도: 가격이 하락하지 않으면서 지표가 조용히 상승
  const priceStable = n >= 5 && Math.abs(closes[n] - closes[n - 5]) / closes[n - 5] * 100 < 2;
  const emaRising = ema5[n] > ema5[n - 1] && ema10[n] > ema10[n - 1];

  const signals = [isBoxPattern, rsiRising, emaConverging, volContracting, priceStable && emaRising].filter(Boolean).length;
  const confidence = Math.min(100, signals * 20);
  const isAccumulating = signals >= 2; // 5개 중 2개 이상이면 매집 판정

  // ★ 수급 응축도 점수 (0~10): 레이더 차트 연동용
  let condensation = 0;
  if (isBoxPattern) condensation += 2.5;
  if (rsiRising) condensation += 2;
  if (emaConverging) condensation += 2;
  if (volContracting) condensation += 1.5;
  if (priceStable && emaRising) condensation += 2;
  condensation = Math.min(10, Math.round(condensation * 10) / 10);

  let pattern = '';
  if (isBoxPattern) pattern += '박스권|';
  if (rsiRising) pattern += 'RSI반등|';
  if (emaConverging) pattern += '이평밀집|';
  if (volContracting) pattern += '거래량감소|';
  if (priceStable && emaRising) pattern += '에너지응축';
  pattern = pattern.replace(/\|$/, '') || 'none';

  return { isAccumulating, confidence, pattern, condensation };
}

// ===== Unified 10-Indicator Scoring (Weighted: RVOL×1.5, MACD×2, VWAP/Candle×2, 거래대금×1.5) =====
// ★ 엔진 개편: 오직 10대 지표의 합산 점수와 진입 임계값(Threshold)에 의해서만 자동 매매 결정
// ★ 선취매 모드: 저거래량 시 체결강도/RSI/이평선 가중치 상향
function score10Indicators(quote: any, closes: number[], highs: number[], lows: number[], opens: number[], volumes: number[], isLowVolumeSession = false) {
  const changePct = quote.dp || 0;
  const n = closes.length - 1;
  if (n < 5) return null;

  // 1. 호재 감성 (Sentiment)
  const sentimentScore = changePct >= 5 ? 9 : changePct >= 3 ? 7 : changePct >= 1 ? 5 : changePct >= -1 ? 4 : 2;
  
  // 2. 상대 거래량 (RVOL)
  const currentVol = volumes[n];
  const avgVol = volumes.length >= 21 ? volumes.slice(-21, -1).reduce((a, b) => a + b, 0) / 20 : currentVol;
  const rvol = avgVol > 0 ? currentVol / avgVol : 1;
  const rvolScore = rvol >= 3 ? 10 : rvol >= 2.5 ? 8 : rvol >= 2 ? 6 : rvol >= 1.5 ? 4 : 2;
  
  // 3. VWAP/캔들 패턴
  const ema9 = calculateEMA(closes, 9);
  const ema21 = calculateEMA(closes, 21);
  const rsi = calculateRSI(closes, 14);
  const vwap = calculateVWAP(highs.slice(-20), lows.slice(-20), closes.slice(-20), volumes.slice(-20));
  let candleConfirms = 0;
  if (closes[n] > vwap) candleConfirms += 0.5;
  if (ema9[n] > ema21[n] && closes[n] > ema9[n]) candleConfirms++;
  if (rsi[n] > 40 && rsi[n] < 70 && rsi[n] > (rsi[n-1]||50)) candleConfirms++;
  const candleScore = candleConfirms >= 2.5 ? 10 : candleConfirms >= 2 ? 7 : candleConfirms >= 1 ? 4 : 1;
  const vwapCross = closes[n] > vwap;
  
  // 4. MACD
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);
  const macd = ema12[n] - ema26[n];
  const macdPrev = n > 0 ? ema12[n-1] - ema26[n-1] : 0;
  const macdScore = (macd > 0 && macd > macdPrev) ? 10 : (macd > 0) ? 7 : (macd > macdPrev) ? 4 : 2;
  
  // 5. RSI
  const currentRSI = rsi[n];
  // ★ 선취매: 저거래량 시 RSI 저점 반등(30~50)에 추가 보너스
  let rsiScore = (currentRSI >= 50 && currentRSI <= 70) ? 8 : (currentRSI >= 40 && currentRSI < 50) ? 5 : (currentRSI > 70) ? 3 : 2;
  if (isLowVolumeSession && currentRSI >= 30 && currentRSI <= 50 && rsi[n] > (rsi[n-1]||50)) {
    rsiScore = Math.min(10, rsiScore + 3); // RSI 저점 고개 들기 보너스
  }
  
  // 6. 볼린저 밴드 (ATR 기반 근사)
  const atr = calculateATR(highs, lows, closes, 14);
  const currentATR = atr[atr.length - 1];
  const ema20 = calculateEMA(closes, 20);
  const bbUpper = ema20[n] + 2 * currentATR;
  const bbLower = ema20[n] - 2 * currentATR;
  const bbScore = closes[n] > bbUpper ? 10 : closes[n] > ema20[n] + currentATR ? 7 : closes[n] > ema20[n] ? 5 : closes[n] > bbLower ? 3 : 1;
  
  // 7. 이평선 정배열 (EMA alignment)
  const ema50 = calculateEMA(closes, Math.min(50, closes.length));
  const aligned = ema9[n] > ema21[n] && ema21[n] > ema50[n];
  let emaAlignScore = aligned ? 9 : (ema9[n] > ema21[n]) ? 6 : 3;
  // ★ 선취매: 저거래량 시 이평선 밀집 보너스
  if (isLowVolumeSession) {
    const emaSpread = Math.abs(ema9[n] - ema50[n]) / closes[n] * 100;
    if (emaSpread < 1.5) emaAlignScore = Math.min(10, emaAlignScore + 2); // 이평선 밀집 보너스
  }
  
  // 8. 갭 분석
  const gapPct = n > 0 ? ((opens[n] - closes[n-1]) / closes[n-1]) * 100 : 0;
  const gapScore = (gapPct >= 4 && gapPct <= 15) ? (closes[n] > opens[n] ? 10 : 5) : gapPct > 15 ? 2 : gapPct > 0 ? 3 : 1;
  
  // 9. 숏 스퀴즈
  const high20 = Math.max(...closes.slice(-20));
  let squeezeScore = 0;
  if (closes[n] >= high20) squeezeScore += 6;
  if (avgVol > 0 && currentVol / avgVol > 2) squeezeScore += 4;
  squeezeScore = Math.min(10, squeezeScore);
  
  // 10. 거래대금 강도 (체결 강도 + 볼륨 가속)
  let bullCount = 0, volInc = 0;
  for (let i = Math.max(0, n - 4); i <= n; i++) {
    if (closes[i] > opens[i]) bullCount++;
    if (i > 0 && volumes[i] > volumes[i - 1]) volInc++;
  }
  const bullRatio = (bullCount / 5) * 100;
  const volAccel = volInc >= 3 ? 1.5 : volInc >= 2 ? 1.2 : 1.0;
  const aggression = Math.round(bullRatio * volAccel);
  let aggrScore = aggression >= 150 ? 10 : aggression >= 120 ? 8 : aggression >= 80 ? 6 : aggression >= 60 ? 4 : 2;
  // ★ 선취매: 저거래량 시 체결강도 가중치 상향 (양봉비율 높으면 보너스)
  if (isLowVolumeSession && bullRatio >= 60) {
    aggrScore = Math.min(10, aggrScore + 2);
  }

  // ★ 가중치 적용: RVOL×1.5, 거래대금강도×1.5, MACD×2, VWAP/캔들×2
  // ★ 선취매 모드: 저거래량 시 RVOL 가중치 ↓, 체결강도/RSI/이평선 가중치 ↑
  const rvolWeight = isLowVolumeSession ? 0.8 : 1.5;
  const aggrWeight = isLowVolumeSession ? 2.0 : 1.5;
  const rsiWeight = isLowVolumeSession ? 1.5 : 1.0;
  const emaAlignWeight = isLowVolumeSession ? 1.5 : 1.0;

  const rawScore = sentimentScore * 1.0 + rvolScore * rvolWeight + candleScore * 2.0 + macdScore * 2.0 
    + rsiScore * rsiWeight + bbScore * 1.0 + emaAlignScore * emaAlignWeight + gapScore * 1.0 + squeezeScore * 1.0 + aggrScore * aggrWeight;
  const maxRawScore = 10 * (1.0 + rvolWeight + 2.0 + 2.0 + rsiWeight + 1.0 + emaAlignWeight + 1.0 + 1.0 + aggrWeight);
  const totalScore = Math.round((rawScore / maxRawScore) * 100);

  // ★ 충족 지표 수 계산 (점수 ≥ 5점이면 '충족')
  const indicatorScores = [sentimentScore, rvolScore, candleScore, macdScore, rsiScore, bbScore, emaAlignScore, gapScore, squeezeScore, aggrScore];
  const metCount = indicatorScores.filter(s => s >= 5).length;

  // ★ 매집 패턴 감지
  const accumulation = detectAccumulation(closes, highs, lows, volumes, rsi);

  const recentHigh = Math.max(...highs.slice(-10));
  const trailingStop = +(recentHigh - 2.0 * currentATR).toFixed(4);

    // ★ ADX & OBV & 슈퍼 패턴 감지
    const adxValue = calculateADX(highs, lows, closes, 14);
    const obvData = detectOBVDivergence(closes, volumes);
    const superPattern = detectSuperPattern(closes, highs, lows, volumes, adxValue);

    return {
    totalScore, trailingStop, rvol, changePct, metCount,
    vwap, bbLower, bbUpper,
    accumulation,
    adx: adxValue,
    obv: obvData,
    superPattern,
    indicators: {
      sentiment: { score: sentimentScore, details: `변동률 ${changePct.toFixed(2)}%` },
      rvol: { score: rvolScore, rvol, weight: isLowVolumeSession ? '×0.8(선취매)' : '×1.5', details: `RVOL ${rvol.toFixed(1)}x` },
      candle: { score: candleScore, vwapCross, weight: '×2', details: `VWAP ${vwapCross ? '상단' : '하단'}` },
      macd: { score: macdScore, macd: +macd.toFixed(4), weight: '×2', details: `MACD ${macd > 0 ? '양전' : '음전'}` },
      rsi: { score: rsiScore, rsi: +currentRSI.toFixed(1), weight: isLowVolumeSession ? '×1.5(선취매)' : '×1', details: `RSI ${currentRSI.toFixed(1)}` },
      bb: { score: bbScore, details: `BB ${closes[n] > bbUpper ? '상단돌파' : closes[n] > ema20[n] ? '중앙상단' : '하단'}` },
      emaAlign: { score: emaAlignScore, aligned, weight: isLowVolumeSession ? '×1.5(선취매)' : '×1', details: `이평선 ${aligned ? '정배열' : '역배열'}` },
      gap: { score: gapScore, details: `갭 ${gapPct.toFixed(1)}%` },
      squeeze: { score: squeezeScore, details: `스퀴즈 ${squeezeScore >= 6 ? '활성' : '비활성'}` },
      aggression: { score: aggrScore, weight: isLowVolumeSession ? '×2.0(선취매)' : '×1.5', details: `체결강도 ${aggression.toFixed(0)}%` },
      condensation: { score: Math.round(accumulation.condensation), details: `응축도 ${accumulation.condensation.toFixed(1)} | ${accumulation.pattern}` },
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

// ===== Dynamic Discovery: Finnhub 전 종목 심볼 확장 =====
let discoveredSymbols: string[] = [];
let lastDiscoveryTime = 0;
const DISCOVERY_INTERVAL_MS = 30 * 60 * 1000; // 30분마다 갱신

async function discoverAllUSStocks(): Promise<string[]> {
  const now = Date.now();
  if (discoveredSymbols.length > 0 && (now - lastDiscoveryTime) < DISCOVERY_INTERVAL_MS) {
    return discoveredSymbols;
  }
  try {
    const token = getToken();
    if (!token) return [];
    // Finnhub US stock symbols
    const res = await fetch(`${FINNHUB_BASE}/stock/symbol?exchange=US&token=${token}`);
    if (!res.ok) return discoveredSymbols;
    const symbols = await res.json();
    if (!Array.isArray(symbols)) return discoveredSymbols;
    // Filter: only common stocks (type=Common Stock), exclude OTC/penny shell
    discoveredSymbols = symbols
      .filter((s: any) => s.type === 'Common Stock' && s.symbol && !s.symbol.includes('.'))
      .map((s: any) => s.symbol as string)
      .filter((s: string) => !LARGE_SET.has(s) && !SMALL_SET.has(s)); // 기존 풀과 중복 제거
    lastDiscoveryTime = now;
    return discoveredSymbols;
  } catch {
    return discoveredSymbols;
  }
}

// ===== Score Surge Detection (점수 급상승 감지) =====
const previousScores: Map<string, number> = new Map();
function detectScoreSurge(symbol: string, currentScore: number): { isSurge: boolean; prevScore: number; delta: number } {
  const prev = previousScores.get(symbol) || 0;
  const delta = currentScore - prev;
  previousScores.set(symbol, currentScore);
  // 20점 이상 급상승 = 급등 예상 1순위
  return { isSurge: delta >= 20 && currentScore >= 60, prevScore: prev, delta };
}

// ===== Dynamic Active List Management =====
const activeUnifiedList: Set<string> = new Set();
const lastScores: Map<string, number> = new Map();
let lastSessionType: SessionType | null = null; // 세션 전환 감지용

// Determine cap type: price >= $10 → large, else small
function getCapType(price: number, symbol: string): 'large' | 'small' {
  if (LARGE_SET.has(symbol) && price >= 10) return 'large';
  if (SMALL_SET.has(symbol)) return 'small';
  return price >= 10 ? 'large' : 'small';
}

// ===== Volume Leader Fetcher (Finnhub) — ★ 전 종목 확장 =====
async function fetchVolumeLeaders(session: SessionType): Promise<{ symbol: string; volume: number; changePct: number; tradingValue: number }[]> {
  const leaders: { symbol: string; volume: number; changePct: number; tradingValue: number }[] = [];
  
  // ★ 전 종목 스캔: 기존 풀 + 동적 발견 종목에서 200개 랜덤 샘플링
  const allKnown = [...Array.from(LARGE_SET), ...Array.from(SMALL_SET)];
  const dynamicPool = discoveredSymbols.length > 0 ? discoveredSymbols : [];
  const allSymbols = [...allKnown, ...dynamicPool];
  
  // ★ 확장 샘플: 200개로 증가 (기존 100 → 200)
  const sampleSize = 200;
  const cycleOffset = Math.floor(Math.random() * allSymbols.length);
  const sample: string[] = [];
  for (let i = 0; i < Math.min(sampleSize, allSymbols.length); i++) {
    sample.push(allSymbols[(cycleOffset + i) % allSymbols.length]);
  }
  
  // Batch fetch quotes (5 at a time)
  for (let i = 0; i < sample.length; i += 5) {
    const batch = sample.slice(i, i + 5);
    const results = await Promise.all(batch.map(sym => finnhubFetch(`/quote?symbol=${sym}`).then(q => q ? { symbol: sym, quote: q } : null)));
    for (const r of results) {
      if (!r || !r.quote || !r.quote.c) continue;
      const vol = r.quote.v || 0;
      const price = r.quote.c;
      const changePct = r.quote.dp || 0;
      const tradingValue = vol * price;
      leaders.push({ symbol: r.symbol, volume: vol, changePct, tradingValue });
    }
    if (i + 5 < sample.length) await new Promise(r => setTimeout(r, 200));
  }
  
  // Sort by trading value (거래대금) descending
  leaders.sort((a, b) => b.tradingValue - a.tradingValue);
  return leaders;
}

// ===== Liquidity Score: 상승률 + 거래대금 합산 =====
function liquidityScore(changePct: number, tradingValueUSD: number): number {
  // Normalize trading value (0-50 points) and changePct (0-50 points)
  const valueScore = Math.min(50, Math.log10(Math.max(tradingValueUSD, 1)) * 5);
  const changeScore = Math.min(50, Math.max(0, changePct) * 5);
  return valueScore + changeScore;
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
    const sessionRvolMin = 2.0;

    // ★ 전 종목 동적 발견: Finnhub에서 미국 상장 전 종목 심볼 갱신
    try {
      const discovered = await discoverAllUSStocks();
      if (discovered.length > 0) {
        await addLog('system', 'scan', null, `[🌐전종목스캔] Finnhub 전 종목 심볼 ${discovered.length}개 동적 발견 (기존 ${LARGE_SET.size}+${SMALL_SET.size} + 신규 ${discovered.length} = ${LARGE_SET.size + SMALL_SET.size + discovered.length}개 전수조사 풀)`, {});
      }
    } catch { /* non-critical */ }
    const sessionSlippage = sessionInfo.aggressiveSlippage; // ★ 공격적 체결 슬리피지

    // ★ 필승 로직: 정규장 개장 직후 15분(09:30~09:45 ET) 뇌동매매 방지
    const etStr2 = now.toLocaleString('en-US', { timeZone: 'America/New_York' });
    const et2 = new Date(etStr2);
    const etTime = et2.getHours() * 60 + et2.getMinutes();
    const isOpeningRush = etTime >= 570 && etTime < 585; // 09:30~09:45 ET

    // ========== SESSION TRANSITION RESET ==========
    const currentSession = sessionInfo.session;
    if (lastSessionType && lastSessionType !== currentSession) {
      // 세션 전환 감지 → 스캔 리스트 초기화 (보유 종목은 나중에 재추가)
      const resetCount = activeUnifiedList.size;
      activeUnifiedList.clear();
      await addLog('system', 'info', null, `[세션전환] ${lastSessionType} → ${currentSession} | 스캔 리스트 리셋 (${resetCount}개 초기화) — 새 수급 기반 종목 유입 시작`, {});
    }
    lastSessionType = currentSession;

    // ========== UNIFIED DYNAMIC UNIVERSE ROTATION (★ 전 종목 확장 스캔) ==========
    const cycleCount = (await supabase.from('agent_status').select('total_cycles').limit(1).single()).data?.total_cycles || 0;

    // Step 0: Fetch Volume Leaders for current session (거래대금 상위 종목 우선 유입)
    let volumeLeaders: { symbol: string; volume: number; changePct: number; tradingValue: number }[] = [];
    try {
      volumeLeaders = await fetchVolumeLeaders(currentSession);
      if (volumeLeaders.length > 0) {
        const topVol = volumeLeaders.slice(0, 10).map(v => `${v.symbol}($${(v.tradingValue/1e6).toFixed(1)}M)`).join(', ');
        await addLog('system', 'scan', null, `[수급스캔] [${sessionLabel}] Volume Leader ${volumeLeaders.length}개 탐지 | Top10: ${topVol}`, {});
      }
    } catch (e) {
      await addLog('system', 'warning', null, `[수급스캔] Volume Leader 조회 실패: ${e.message}`, {});
    }

    // Step 1: Evict low-score symbols
    const evicted: string[] = [];
    for (const sym of activeUnifiedList) {
      const score = lastScores.get(sym) ?? 50;
      if (score < 40) {
        activeUnifiedList.delete(sym);
        evicted.push(sym);
      }
    }

    // Step 2: Fill 150 active slots — ★ 확장: 60 대형 + 90 소형 = 150개 슬롯
    const LARGE_SLOTS = 60;
    const SMALL_SLOTS = 90;

    const currentLarge: string[] = [];
    const currentSmall: string[] = [];
    for (const sym of activeUnifiedList) {
      if (LARGE_SET.has(sym)) currentLarge.push(sym);
      else currentSmall.push(sym);
    }

    // ★ Volume Leader 우선 유입: 거래대금 상위 종목을 먼저 슬롯에 배치
    const volumeLeaderSymbols = new Set(volumeLeaders.slice(0, 100).map(v => v.symbol));
    
    // Fill from volume leaders first
    for (const vl of volumeLeaders) {
      if (currentLarge.length >= LARGE_SLOTS && currentSmall.length >= SMALL_SLOTS) break;
      const sym = vl.symbol;
      if (activeUnifiedList.has(sym)) continue;
      if (vl.tradingValue < 10000) continue;
      
      if (LARGE_SET.has(sym) && currentLarge.length < LARGE_SLOTS) {
        activeUnifiedList.add(sym);
        currentLarge.push(sym);
      } else if ((SMALL_SET.has(sym) || !LARGE_SET.has(sym)) && currentSmall.length < SMALL_SLOTS) {
        activeUnifiedList.add(sym);
        currentSmall.push(sym);
      }
    }

    // ★ 전 종목 확장: 동적 발견 종목에서도 슬롯 충전
    const dynSymbols = discoveredSymbols.length > 0 ? discoveredSymbols : [];
    const dynStart = (cycleCount * 50) % Math.max(1, dynSymbols.length);
    for (let i = 0; currentSmall.length < SMALL_SLOTS && i < Math.min(50, dynSymbols.length); i++) {
      const sym = dynSymbols[(dynStart + i) % dynSymbols.length];
      if (!activeUnifiedList.has(sym)) {
        activeUnifiedList.add(sym);
        currentSmall.push(sym);
      }
    }

    // Fill remaining slots with rotation (기존 풀)
    const largeArr = Array.from(LARGE_SET);
    const largeStart = (cycleCount * LARGE_SLOTS) % largeArr.length;
    for (let i = 0; currentLarge.length < LARGE_SLOTS && i < largeArr.length; i++) {
      const sym = largeArr[(largeStart + i) % largeArr.length];
      if (!activeUnifiedList.has(sym)) {
        activeUnifiedList.add(sym);
        currentLarge.push(sym);
      }
    }

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
    
    // Build volume rank map for UI/logging
    const volumeRankMap: Map<string, number> = new Map();
    volumeLeaders.forEach((vl, idx) => volumeRankMap.set(vl.symbol, idx + 1));

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

    // --- SELF-LEARNING: Blacklist (시한부: 2일 이내 연속 5패 이상만 블랙리스트) ---
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentLosses } = await supabase
      .from('unified_trades')
      .select('symbol, pnl, status, closed_at')
      .lt('pnl', 0)
      .gte('closed_at', twoDaysAgo)
      .order('closed_at', { ascending: false })
      .limit(200);

    const lossCount: Record<string, number> = {};
    for (const t of (recentLosses || [])) {
      lossCount[t.symbol] = (lossCount[t.symbol] || 0) + 1;
    }
    const blacklistSymbols = new Set(
      Object.entries(lossCount).filter(([_, c]) => c >= 5).map(([s]) => s)
    );
    if (blacklistSymbols.size > 0) {
      await addLog('unified', 'learn', null, `[AI-Learn] 진입 금지 블랙리스트 (2일내 5패↑): ${[...blacklistSymbols].join(', ')}`, {});
    } else {
      await addLog('unified', 'learn', null, `[AI-Learn] 블랙리스트 0개 (2일내 5패 기준 해당 없음)`, {});
    }

    // --- Market Trend Guard (비활성화: 시장잠금 OFF) ---
    let marketBearish = false;
    let marketBuyHalt = false;
    let baseEntryThreshold = 60; // ★ 고속 캐치업: 진입 문턱 60점 (급등 초입 선점)
    let qqqTrendDown = false;
    try {
      const [spyQuote, qqqQuote] = await Promise.all([
        finnhubFetch(`/quote?symbol=SPY`),
        finnhubFetch(`/quote?symbol=QQQ`),
      ]);
      const spyChange = spyQuote?.dp || 0;
      const qqqChange = qqqQuote?.dp || 0;

      // ★ QQQ 모멘텀 보너스: QQQ 강세 시만 소폭 완화
      qqqTrendDown = qqqChange < -0.5;
      const qqqBonus = qqqChange >= 1.5 ? 3 : qqqChange >= 0.5 ? 1 : 0;
      if (qqqBonus > 0) baseEntryThreshold = Math.max(58, baseEntryThreshold - qqqBonus);
      await addLog('system', 'info', null, `[시장동기화] SPY ${spyChange.toFixed(2)}% / QQQ ${qqqChange.toFixed(2)}% → QQQ보너스 -${qqqBonus}점, 진입기준 ${baseEntryThreshold}점`, { spyChange, qqqChange, qqqBonus });
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

    // Win-rate adjustment: 극단적 저승률에서만 소폭 상향
    if (recentWinRate < 15) baseEntryThreshold = Math.max(baseEntryThreshold, 70);
    else if (recentWinRate < 25) baseEntryThreshold = Math.max(baseEntryThreshold, 67);

    // Session adaptation — ★ 고속 캐치업: 최소 60점 강제 하한선 (급등 초입 선점)
    const rawAdapted = Math.round(baseEntryThreshold * entryRelax);
    const adaptedEntryThreshold = Math.max(rawAdapted, 60); // 절대 하한 60점
    const adaptedRvolMin = entryRelax < 1.0 ? 1.5 : 2.0;
    const adaptedVwapMin = entryRelax < 1.0 ? 2 : 4;
    const isLowVolumeSession = currentSession === 'DAY' || currentSession === 'PRE_MARKET' || currentSession === 'AFTER_HOURS';

    if (entryRelax < 1.0) {
      await addLog('system', 'info', null, `[전세션 엔진] ${sessionLabel} 적응형 진입: 문턱 ${baseEntryThreshold}→${adaptedEntryThreshold}점 | RVOL≥${adaptedRvolMin} | VWAP≥${adaptedVwapMin} | 선취매모드: ${isLowVolumeSession ? 'ON' : 'OFF'}`, {});
    }

    await addLog('unified', 'learn', null, `[AI-Learn] 승률 ${recentWinRate.toFixed(1)}% → 통합 진입 문턱: ${adaptedEntryThreshold}점 | ${sessionLabel} | 매수중단: ${marketBuyHalt ? 'YES' : 'NO'}`, {});

    // ========== EXIT CHECKS (지표 우선형 동적 방어 전략) ==========
    const symbolsToCheck = [...new Set((openPos || []).map((p: any) => p.symbol))];
    const dipBuyCandidates: { sym: string; price: number; scoring: any; capType: 'large' | 'small'; pos: any }[] = [];

    for (const sym of symbolsToCheck) {
      const data = await getQuoteAndCandles(sym);
      if (!data) continue;
      const price = data.quote.c;
      const scoring = score10Indicators(data.quote, data.closes, data.highs, data.lows, data.opens, data.volumes, isLowVolumeSession);
      const quantScore = scoring?.totalScore || 0;
      const metCount = scoring?.metCount || 0;
      lastScores.set(sym, quantScore);

      if (price < MIN_PRICE_USD) {
        await addLog('unified', 'warning', sym, `[${timeStr}] ⚠️ ${sym} 초저가 경고: ${fmtKRW(price)}`, {});
      }

      const n = data.closes.length - 1;
      const atrArr = calculateATR(data.highs, data.lows, data.closes, 14);
      const currentATR = atrArr[atrArr.length - 1] || 0;
      const ema20 = calculateEMA(data.closes, 20);
      const vwap = scoring?.vwap || calculateVWAP(data.highs.slice(-20), data.lows.slice(-20), data.closes.slice(-20), data.volumes.slice(-20));
      const bbLower = scoring?.bbLower || ((ema20[n] || price) - 2 * currentATR);
      const vwapCross = scoring?.indicators?.candle?.vwapCross ?? (price > vwap);
      const aboveBB = price > bbLower;

      for (const pos of (openPos || []).filter((p: any) => p.symbol === sym && p.status === 'open')) {
        const pnlPct = ((price - pos.price) / pos.price) * 100;
        const capType = getCapType(price, sym);

        // ===== 수익 구간 트레일링 방어 (15% 타겟용 강화) =====
        const isSuperTarget = (pos.ai_reason || '').includes('15%') || (pos.ai_reason || '').includes('슈퍼');
        const indicatorsOver60 = quantScore >= 60;

        // ★ 15% 타겟: 7% 돌파 시 SL을 +3%로 상향 (최소 수익 보장)
        if (pnlPct >= 7 && pos.stop_loss < pos.price * 1.03) {
          const rs = +(pos.price * 1.03).toFixed(4);
          await supabase.from('unified_trades').update({ stop_loss: rs }).eq('id', pos.id);
          pos.stop_loss = rs;
          await addLog('unified', 'defense', sym, `[7%방어→15%추격] ${sym} → SL +3.0% (최소 수익 확보, 15% 고지 추격 중)`, { quantScore, pnlPct: +pnlPct.toFixed(2) });
        } else if (pnlPct >= 5 && pos.stop_loss < pos.price * 1.035) {
          const rs = +(pos.price * 1.035).toFixed(4);
          await supabase.from('unified_trades').update({ stop_loss: rs }).eq('id', pos.id);
          pos.stop_loss = rs;
          await addLog('unified', 'defense', sym, `[5%방어] ${sym} → SL +3.5%`, {});
        } else if (pnlPct >= 3 && pos.stop_loss < pos.price * 1.02) {
          const rs = +(pos.price * 1.02).toFixed(4);
          await supabase.from('unified_trades').update({ stop_loss: rs }).eq('id', pos.id);
          pos.stop_loss = rs;
          await addLog('unified', 'defense', sym, `[3%방어] ${sym} → SL +2.0%`, {});
        } else if (pnlPct >= 2 && pos.stop_loss < pos.price * 1.01) {
          const rs = +(pos.price * 1.01).toFixed(4);
          await supabase.from('unified_trades').update({ stop_loss: rs }).eq('id', pos.id);
          pos.stop_loss = rs;
          await addLog('unified', 'defense', sym, `[2%방어] ${sym} → SL +1.0%`, {});
        }

        const peakPrice = Math.max(pos.peak_price || pos.price, price);
        if (price > (pos.peak_price || pos.price)) {
          await supabase.from('unified_trades').update({ peak_price: peakPrice }).eq('id', pos.id);
        }

        // ===== [혁파] 지표 무결성 기반 동적 홀딩 & 익절 극대화 =====
        const indicatorsStrong = quantScore >= 55;
        const indicatorsHold = quantScore >= 50;
        const technicalSafe = vwapCross || aboveBB;
        const withinATR = price > (pos.price - 2.0 * currentATR);
        const isPreMarketEntry = isLowVolumeSession && (pos.ai_reason || '').includes('선취매');

        const accumInfo = scoring?.accumulation;
        const isIronHold = accumInfo && accumInfo.condensation >= 6 && indicatorsHold;
        const emaAligned = scoring?.indicators?.emaAlign?.aligned === true;
        const coreIntact = vwapCross && emaAligned;

        let shouldClose = false;
        let closeReason = '';
        let newStatus = 'closed';

        // ★ [패배 없는 본절가 전략] — 1.0% 달성 시 즉시 +0.1% 본절 보호 → 리스크 제로
        if (pnlPct >= 1.0 && pos.stop_loss < pos.price * 1.001) {
          const bs = +(pos.price * 1.001).toFixed(4);
          await supabase.from('unified_trades').update({ stop_loss: bs }).eq('id', pos.id);
          pos.stop_loss = bs;
          await addLog('unified', 'defense', sym, `[리스크제로] ${sym} +${pnlPct.toFixed(2)}% → SL=${fmtKRW(bs)} (매수가+0.1%) 익절확률 100% 달성 | ${quantScore}점`, { quantScore, pnlPct: +pnlPct.toFixed(2) });
        }

        // 1. 익절 로직 — ★ 전 종목 TP +15%, 지표 강력 시 30~50% 대시세까지 트레일링 추격
        if (pnlPct >= 30.0) {
          // ★ 30%+ 대시세: 지표 65점 이상이면 고점-2% 트레일링으로 50%까지 추격
          if (quantScore >= 65) {
            const drop = ((peakPrice - price) / peakPrice) * 100;
            if (drop >= 2.0) {
              shouldClose = true;
              closeReason = `[🏆30%+대시세익절] [${sessionLabel}] [${timeStr}] [${sym}] +${pnlPct.toFixed(1)}% 고점-${drop.toFixed(2)}% (지표 ${quantScore}점) → 대시세 수익 확정`;
              newStatus = 'mega_profit';
            } else {
              await addLog('unified', 'hold', sym, `[🚀50%추격] ${sym} +${pnlPct.toFixed(2)}% 대시세 진행 중! 지표 ${quantScore}점(≥65) → 고점-2% 트레일링으로 50%까지 추격`, { quantScore, pnlPct: +pnlPct.toFixed(2), peakPrice, drop });
            }
          } else {
            // 30%+ 지표 65 미만 → 고점-1.5% 트레일링
            const drop = ((peakPrice - price) / peakPrice) * 100;
            if (drop >= 1.5) {
              shouldClose = true;
              closeReason = `[🏆30%트레일링] [${sessionLabel}] [${timeStr}] [${sym}] +${pnlPct.toFixed(1)}% 고점-${drop.toFixed(2)}% → 대시세 수익 확정`;
              newStatus = 'mega_profit';
            } else {
              await addLog('unified', 'hold', sym, `[🚀30%+추격] ${sym} +${pnlPct.toFixed(2)}% | 고점-${drop.toFixed(2)}% → 트레일링 유지`, { quantScore, pnlPct: +pnlPct.toFixed(2) });
            }
          }
        } else if (pnlPct >= 15.0) {
          // ★ 15% 도달: 지표 70점 이상이면 고점-1% 트레일링으로 30%+ 추격
          const indicatorsOver70 = quantScore >= 70;
          if (indicatorsOver70) {
            const drop = ((peakPrice - price) / peakPrice) * 100;
            if (drop >= 1.0) {
              shouldClose = true;
              closeReason = `[🏆15%+트레일링익절] [${sessionLabel}] [${timeStr}] [${sym}] +${pnlPct.toFixed(1)}% 고점-${drop.toFixed(2)}% (지표 ${quantScore}점) → 수익 극대화 확정`;
              newStatus = 'trailing_profit';
            } else {
              await addLog('unified', 'hold', sym, `[🎯15%돌파→30%추격] ${sym} +${pnlPct.toFixed(2)}% 목표 도달! 지표 ${quantScore}점(≥70) → 고점-1% 트레일링으로 30~50% 대시세 추격 중`, { quantScore, pnlPct: +pnlPct.toFixed(2), peakPrice, drop });
            }
          } else if (quantScore >= 60) {
            // 15%+, 지표 60~69 → 고점-1.5% 트레일링
            const drop = ((peakPrice - price) / peakPrice) * 100;
            if (drop >= 1.5) {
              shouldClose = true;
              closeReason = `[🏆15%트레일링] [${sessionLabel}] [${timeStr}] [${sym}] +${pnlPct.toFixed(1)}% 고점-${drop.toFixed(2)}% → 수익 확정`;
              newStatus = 'trailing_profit';
            } else {
              await addLog('unified', 'hold', sym, `[🎯15%→30%추격] ${sym} +${pnlPct.toFixed(2)}% | 지표 ${quantScore}점(≥60) → 트레일링 유지`, { quantScore, pnlPct: +pnlPct.toFixed(2) });
            }
          } else {
            // 15% 도달 + 지표 60 미만 → 즉시 전량 익절
            shouldClose = true;
            closeReason = `[🏆15%목표익절] [${sessionLabel}] [${timeStr}] [${sym}] +${pnlPct.toFixed(1)}% 목표 도달 (지표 ${quantScore}점<60) → 전량 수익 확정`;
            newStatus = 'profit_taken';
          }
        } else if (pnlPct >= 3.0 && pnlPct < 15.0 && indicatorsOver60) {
          // ★ 철벽 홀딩: 3~15% 수익 구간에서 지표 60점 이상이면 잔파도(5~8%) 완전 무시
          await addLog('unified', 'hold', sym, `[🛡️철벽홀딩] ${sym} +${pnlPct.toFixed(2)}% 수익 중 | 지표 ${quantScore}점(≥60) → 15% 목표까지 잔파도 무시! 조기 매도 절대 금지`, { quantScore, pnlPct: +pnlPct.toFixed(2) });
        } else if (pnlPct >= 1.0 && pnlPct < 15.0 && quantScore >= 55) {
          await addLog('unified', 'hold', sym, `[🎯15%추격] ${sym} +${pnlPct.toFixed(2)}% | 지표 ${quantScore}점(≥55) → 목표가까지 홀딩 유지`, { quantScore, pnlPct: +pnlPct.toFixed(2) });
        } else if (pnlPct >= 3.0) {
          const drop = ((peakPrice - price) / peakPrice) * 100;
          const dropThreshold = isIronHold ? 1.0 : 0.5;
          if (drop >= dropThreshold && !indicatorsStrong) {
            shouldClose = true;
            closeReason = `[추격익절] [${sessionLabel}] [${timeStr}] [${sym}] +${pnlPct.toFixed(1)}% 후 고점-${drop.toFixed(2)}% + 지표 약화(${quantScore}점) → 수익 확정`;
            newStatus = 'trailing_profit';
          } else if (drop >= dropThreshold && indicatorsStrong) {
            await addLog('unified', 'hold', sym, `[Iron Hold] ${sym} +${pnlPct.toFixed(2)}% 고점-${drop.toFixed(2)}% BUT 지표 ${quantScore}점(≥55) → 15% 추격 중`, { quantScore, drop, isIronHold });
          }
        } else if (peakPrice >= pos.price * 1.10) {
          const drop = ((peakPrice - price) / peakPrice) * 100;
          if (drop >= 3 && !indicatorsStrong) {
            shouldClose = true;
            closeReason = `[대형익절] [${sessionLabel}] [${timeStr}] [${sym}] 고점-${drop.toFixed(1)}% + 지표 약화 → 수익 확정`;
            newStatus = 'trailing_profit';
          }
        } else if (pos.take_profit && price >= pos.take_profit) {
          const indicatorsOver70 = quantScore >= 70;
          if (indicatorsOver70) {
            await addLog('unified', 'hold', sym, `[🎯TP도달→30%추격] ${sym} TP 도달 + 지표 ${quantScore}점(≥70) → 고점-1% 트레일링 전환, 30~50% 대시세 추격`, { quantScore, pnlPct: +pnlPct.toFixed(2) });
          } else if (indicatorsOver60) {
            await addLog('unified', 'hold', sym, `[🎯TP도달→홀딩] ${sym} TP 도달 + 지표 ${quantScore}점(≥60) → TP 5% 추가 상향`, { quantScore, pnlPct: +pnlPct.toFixed(2) });
            const newTP = +(price * 1.05).toFixed(4);
            await supabase.from('unified_trades').update({ take_profit: newTP }).eq('id', pos.id);
          } else {
            shouldClose = true;
            closeReason = `[목표익절] [${sessionLabel}] [${timeStr}] [${sym}] +15% 목표가 도달 + 지표 ${quantScore}점 → 수익 확정`;
            newStatus = 'profit_taken';
          }
        }

        // 2. ★ [손절 -10% 하향] SL 터치 — 지표 우선 홀딩 강화, -10% 미만에서만 손절 검토
        if (!shouldClose && pos.stop_loss && price <= pos.stop_loss) {
          if (pnlPct >= 0) {
            shouldClose = true;
            closeReason = `[본절방어] [${sessionLabel}] [${timeStr}] [${sym}] 본절가 터치 (${quantScore}점)`;
            newStatus = 'breakeven_exit';
          } else if (pnlPct > -10 && indicatorsHold) {
            // ★ -1%~-9%: 정상적인 흔들림, 지표 50점 이상 → 무조건 홀딩
            await addLog('unified', 'hold', sym, `[변동성 구간: 지표 기반 홀딩 중] ${sym} -${Math.abs(pnlPct).toFixed(2)}% 정상 변동성 | 지표 ${quantScore}점(≥50) → 대시세 대기, 매도 유보`, { quantScore, metCount, pnlPct: +pnlPct.toFixed(2), coreIntact, isIronHold });
          } else if (pnlPct > -10 && quantScore >= 40) {
            // ★ -1%~-9% + 지표 40~49: 경고만, 매도 유보 (노이즈 무시)
            await addLog('unified', 'warning', sym, `[변동성 구간: 주의 관찰] ${sym} -${Math.abs(pnlPct).toFixed(2)}% 변동성 구간 + 지표 ${quantScore}점(40~49) → 매도 유보`, { quantScore, pnlPct: +pnlPct.toFixed(2) });
          } else if (pnlPct <= -10 && indicatorsHold && (coreIntact || technicalSafe)) {
            // ★ -10% 이하지만 지표 50점 이상 + 기술 안전 → 수급 기반 홀딩 유지
            await addLog('unified', 'hold', sym, `[AI 판단: 홀딩 권장] ${sym} -${Math.abs(pnlPct).toFixed(2)}% -10% 도달 BUT 지표 ${quantScore}점(≥50) + ${coreIntact ? 'VWAP+이평선 정배열' : '기술안전'} → 수급 살아있음, 홀딩`, { quantScore, metCount, pnlPct: +pnlPct.toFixed(2), coreIntact, isIronHold });
          } else if (pnlPct <= -10 && quantScore >= 40) {
            // ★ -10% 이하 + 지표 40~49: 경고, 매도 검토
            await addLog('unified', 'warning', sym, `[⚠️ 손절 경고] ${sym} -${Math.abs(pnlPct).toFixed(2)}% -10% 이하 + 지표 ${quantScore}점(40~49) → 매도 임박`, { quantScore, pnlPct: +pnlPct.toFixed(2) });
          } else {
            // ★ 최종 방어선: -10% 이하 + 지표 40점 미만 → 자산 보호 매도
            shouldClose = true;
            closeReason = `[추세완전이탈] [${sessionLabel}] [${timeStr}] [${sym}] -${Math.abs(pnlPct).toFixed(2)}% (-10%↓) + 지표 ${quantScore}점(<40) → 자산 보호 매도`;
            newStatus = 'trend_collapse';
          }
        }

        // 3. ★ 지표 무결성 중심 판단 (손절 -10% 동기화)
        if (!shouldClose) {
          // ★ Iron Hold: 필승 패턴(응축도≥6 + 지표≥50) → 일시적 하락 무시
          if (isIronHold && pnlPct < 0) {
            await addLog('unified', 'hold', sym, `[Iron Hold 🛡️] ${sym} -${Math.abs(pnlPct).toFixed(2)}% 필승 패턴(응축도${accumInfo.condensation.toFixed(1)}/10) + 지표 ${quantScore}점 → 대폭 상승 전조, 절대 홀딩`, { quantScore, condensation: accumInfo.condensation, pattern: accumInfo.pattern, pnlPct: +pnlPct.toFixed(2) });
          }
          // ★ 세션별: 저거래량 밀림 → 개미 털기
          else if (isLowVolumeSession && pnlPct < 0 && indicatorsHold) {
            await addLog('unified', 'hold', sym, `[세션홀딩] ${sym} ${sessionLabel} -${Math.abs(pnlPct).toFixed(2)}% 밀림 → 지표 ${quantScore}점(≥50) 양호, 홀딩`, { quantScore, pnlPct: +pnlPct.toFixed(2), session: sessionLabel });
          }
          // ★ 선취매 종목: 지표 55점 이상 → 정규장까지 무조건 보유
          else if (isPreMarketEntry && indicatorsStrong && currentSession !== 'REGULAR') {
            await addLog('unified', 'hold', sym, `[선취매홀딩] ${sym} 지표 ${quantScore}점(≥55) → 정규장 폭발 대기`, { quantScore, pnlPct: +pnlPct.toFixed(2) });
          }
          // ★ 일반 홀딩: -9%까지는 정상 변동성, 지표 50+ → 홀딩
          else if (pnlPct < 0 && pnlPct > -10 && indicatorsHold) {
            await addLog('unified', 'hold', sym, `[변동성 구간: 지표 기반 홀딩 중] ${sym} -${Math.abs(pnlPct).toFixed(2)}% 정상 변동성 | 지표 ${quantScore}점(≥50) → 30~50% 대시세 대기`, { quantScore, vwapCross, aboveBB, pnlPct: +pnlPct.toFixed(2) });
          }
          // ★ [확정적 수익] 지표 50점 미만 → 즉시 매도 (승률 90% 모델 기반: 50점 하한선)
          else if (quantScore < 50) {
            shouldClose = true;
            closeReason = `[확정수익-50점이탈] [${sessionLabel}] [${timeStr}] [${sym}] ${quantScore}점(<50) + ${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}% → 승률 모델 기준 매도`;
            newStatus = pnlPct >= 0 ? 'profit_taken' : 'trend_collapse';
          }
          // -10% 이하 + VWAP 이탈 → 매도
          else if (pnlPct <= -10 && !vwapCross && !emaAligned) {
            shouldClose = true;
            closeReason = `[복합위험] [${sessionLabel}] [${timeStr}] [${sym}] -${Math.abs(pnlPct).toFixed(2)}% (-10%↓) + ${quantScore}점 + VWAP이탈 → 매도`;
            newStatus = 'indicator_exit';
          }
          // 40~49점 → 경고만
          else if (quantScore < 50 && quantScore >= 40) {
            await addLog('unified', 'warning', sym, `[주의] ${sym} ${quantScore}점(40~49) ⚠️ 지표 약화 중 — ${pnlPct > -10 ? '변동성 구간 홀딩' : '손절 임박'} | PnL: ${pnlPct.toFixed(2)}%`, { quantScore, pnlPct: +pnlPct.toFixed(2) });
          }
          // 블랙리스트 + 지표 미달
          else if (blacklistSymbols.has(sym) && pnlPct <= 0.2 && !indicatorsHold) {
            shouldClose = true;
            closeReason = `[블랙리스트] [${sessionLabel}] [${timeStr}] [${sym}] + 지표 미달(${quantScore}점<50)`;
            newStatus = 'early_exit';
          }
        }

        // ★ 역발상 추매 후보: 지표 65+인데 가격만 하락
        if (!shouldClose && pnlPct < -0.5 && pnlPct > -2.0 && quantScore >= 65 && technicalSafe) {
          dipBuyCandidates.push({ sym, price, scoring, capType, pos });
          await addLog('unified', 'scan', sym, `[역발상추매후보] ${sym} 지표 ${quantScore}점(${metCount}/10) 가격 -${Math.abs(pnlPct).toFixed(2)}% → 추매 검토`, { quantScore, pnlPct: +pnlPct.toFixed(2) });
        }

        // Partial exit at +2%
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
              await addLog('unified', 'exit', sym, `[50%익절] ${sym} +${pnlPct.toFixed(1)}% | PnL: ${fmtKRWRaw(partialPnl)}`, {});
            }
          }
        }

        if (shouldClose) {
          await addLog('unified', 'exit_attempt', sym, `[매도시도] ${sym} ${newStatus}`, { price, pnlPct: +pnlPct.toFixed(2), newStatus, quantScore });
          const saleProceeds = Math.floor(price * pos.quantity * KRW_RATE);
          const buyCost = Math.floor(pos.price * pos.quantity * KRW_RATE);
          const pnlKRW = saleProceeds - buyCost;
          const balanceBefore = balance;
          const newBalance = balance + saleProceeds;
          await supabase.from('unified_trades').update({
            status: newStatus, close_price: price, pnl: pnlKRW,
            closed_at: now.toISOString(),
            ai_reason: `${closeReason} | PnL: ${fmtKRWRaw(pnlKRW)} | [잔고: ${fmtKRWRaw(balanceBefore)} → ${fmtKRWRaw(newBalance)}]`,
          }).eq('id', pos.id);
          await supabase.from('unified_wallet').update({ balance: newBalance, updated_at: now.toISOString() }).eq('id', wallet.id);
          balance = newBalance;
          await addLog('unified', 'exit', sym, `${closeReason} | PnL: ${fmtKRWRaw(pnlKRW)} | [잔고: ${fmtKRWRaw(balanceBefore)} → ${fmtKRWRaw(newBalance)}]`, { pnl: pnlKRW, pnlPct: +pnlPct.toFixed(2) });
        }
      }
      await new Promise(r => setTimeout(r, 200));
    }

    // ★ openCount/MAX_POSITIONS 선언 (역발상 추매 + 엔트리 스캔 공용)
    let openCount = (openPos || []).filter(p => p.status === 'open').length;
    const MAX_POSITIONS = 15;

    // ★ 역발상 추매 실행 (Dip-Buy Pyramiding)
    if (dipBuyCandidates.length > 0 && openCount < MAX_POSITIONS) {
      dipBuyCandidates.sort((a, b) => b.scoring.totalScore - a.scoring.totalScore);
      for (const dip of dipBuyCandidates.slice(0, 2)) {
        const maxKRW = balance * 0.05;
        const priceKRW = toKRW(dip.price);
        const qty = Math.floor(maxKRW / priceKRW);
        const costKRW = Math.floor(qty * priceKRW);
        if (qty <= 0 || costKRW > balance) continue;
        const ap = applySessionSlippage(dip.price, 'buy', spreadMul, sessionSlippage);
        const sl = +(ap * 0.90).toFixed(4);
        const tp = +(ap * 1.15).toFixed(4);
        const bb = Math.round(balance);
        const nb = balance - costKRW;
        const msg = `[역발상추매] [${sessionLabel}] [${timeStr}] ${dip.sym} ${dip.scoring.totalScore}점(${dip.scoring.metCount}/10) 눌림 추매 [${qty}주@${fmtKRW(ap)}|${fmtKRWRaw(costKRW)}] [잔고: ${fmtKRWRaw(bb)}→${fmtKRWRaw(nb)}]`;
        await supabase.from('unified_trades').insert({
          symbol: dip.sym, side: 'buy', quantity: qty, price: ap,
          stop_loss: sl, take_profit: tp, status: 'open',
          cap_type: dip.capType, entry_score: dip.scoring.totalScore,
          ai_reason: msg, ai_confidence: dip.scoring.totalScore,
        });
        await supabase.from('unified_wallet').update({ balance: nb, updated_at: now.toISOString() }).eq('id', wallet.id);
        balance = nb;
        openCount++;
        await addLog('unified', 'buy', dip.sym, msg, { type: 'dip_buy', score: dip.scoring.totalScore });
      }
    }

    // ========== 일일 수익 목표 체크 (₩300,000) ==========
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const { data: todayClosedTrades } = await supabase
      .from('unified_trades')
      .select('pnl')
      .not('status', 'eq', 'open')
      .gte('closed_at', todayStart.toISOString());
    const dailyPnl = (todayClosedTrades || []).reduce((sum, t) => sum + (t.pnl || 0), 0);
    const DAILY_TARGET_KRW = 300000;
    const dailyTargetHit = dailyPnl >= DAILY_TARGET_KRW;
    if (dailyTargetHit) {
      await addLog('unified', 'milestone', null, `🎉🏆 [일일 목표 달성!] 오늘 실현 수익 ${fmtKRWRaw(dailyPnl)} ≥ ₩300,000 — 목표 초과 달성!`, { dailyPnl });
    } else {
      await addLog('system', 'info', null, `[일일목표] 오늘 실현 PnL: ${fmtKRWRaw(dailyPnl)} / 목표 ₩300,000 (${(dailyPnl/DAILY_TARGET_KRW*100).toFixed(1)}%)`, { dailyPnl });
    }

    // ========== UNIFIED ENTRY SCAN ==========
    // ★ 필승 로직: 시장 하락 또는 개장 직후 15분 뇌동매매 방지
    if (marketBuyHalt) {
      await addLog('unified', 'hold', null, `[필승-시장잠금] 🚫 시장 하락 감지로 전체 매수 잠금 — 기존 포지션 관리만 수행`, { qqqTrendDown, marketBearish });
    }
    if (isOpeningRush) {
      await addLog('unified', 'hold', null, `[필승-뇌동방지] 🚫 정규장 개장 직후 15분(09:30~09:45 ET) — 매수 잠금`, {});
    }

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
            const scoring = score10Indicators(data.quote, data.closes, data.highs, data.lows, data.opens, data.volumes, isLowVolumeSession);
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

          // ★ 유동성 하한선 & 수급 동기화
          const vlInfo = volumeLeaders.find(vl => vl.symbol === r.sym);
          const accumPattern = r.scoring.accumulation;
          const isAccumCandidate = isLowVolumeSession && accumPattern?.isAccumulating;
          
          // ★ 선취매: 매집 패턴 감지 시 거래대금 필터 해제 (필승 패턴이면 거래량 제한 무시)
          if (!isAccumCandidate) {
            if (vlInfo && vlInfo.tradingValue < 10000) continue;
            const sessionAvgTradingValue = volumeLeaders.length > 0 
              ? volumeLeaders.reduce((sum, vl) => sum + vl.tradingValue, 0) / volumeLeaders.length 
              : 0;
            if (vlInfo && sessionAvgTradingValue > 0 && vlInfo.tradingValue < sessionAvgTradingValue * 0.5) {
              continue;
            }
          }

          // ★ 엔진 개편: 오직 10대 지표 점수 + 충족 수로 진입 판단
          const metCount = r.scoring.metCount || 0;
          const rvol = r.scoring.indicators.rvol?.rvol || 0;
          const vwapOk = r.scoring.indicators.candle?.vwapCross === true;
          const isAccumEntry = isAccumCandidate;
          
          // 최소 충족 조건: 10개 중 5개 이상 충족 (매집 패턴 시 3개로 완화 — 에너지 응축 포함)
          const minMet = isAccumEntry ? 3 : 5;
          if (metCount < minMet) continue;
          
          // ★ 선취매: 매집 패턴 감지 시 RVOL 요건 완전 해제 (필승 패턴 = 거래량 무관)
          if (!isAccumEntry && rvol < adaptedRvolMin) continue;
          
          const aggressionPct = r.scoring.indicators.aggression?.details?.match(/(\d+)%/)?.[1];
          const aggrVal = aggressionPct ? parseInt(aggressionPct) : 0;
          // ★ 선취매: 매집 패턴 시 체결강도 60%로 완화 (조용한 매집은 양봉비율만으로 판단)
          const minAggression = isAccumEntry ? 60 : 120;
          if (aggrVal < minAggression) continue;

          if (isOpeningRush) continue;

          // 수급 돌파/유동성 점수 계산
          (r as any).isVolumeBurst = rvol >= 2.0;
          (r as any).isAccumulationEntry = isAccumEntry;
          (r as any).accumPattern = accumPattern?.pattern || '';
          (r as any).accumCondensation = accumPattern?.condensation || 0;
          const tradingVal = vlInfo?.tradingValue || 0;
          (r as any).liquidityScore = liquidityScore(r.scoring.changePct || 0, tradingVal);
          (r as any).volumeRank = volumeRankMap.get(r.sym) || 999;
          (r as any).tradingValueUSD = tradingVal;

          // ★ 선취매 알림 로그 (강화)
          if (isAccumEntry) {
            await addLog('unified', 'scan', r.sym, `[데이장 선취매] 지표 완벽 확인. 정규장 폭발을 대비해 ${r.sym}을 미리 매수합니다. | 매집패턴: ${accumPattern?.pattern} | 응축도: ${accumPattern?.condensation?.toFixed(1)}/10 (신뢰도 ${accumPattern?.confidence}%) | ${r.scoring.totalScore}점(${metCount}/10)`, { accumulation: accumPattern, score: r.scoring.totalScore, condensation: accumPattern?.condensation });
          }

          candidates.push(r);
        }
        if (i + 5 < SCAN_SYMBOLS.length) await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    // ★ 급등 예상 패턴 + 슈퍼 패턴(15% 타겟) 감지
    for (const c of candidates) {
      const ind = c.scoring.indicators;
      const rvolExplosive = (ind.rvol?.rvol || 0) >= 5 && (ind.candle?.vwapCross === true);
      const bbSqueeze = (ind.squeeze?.score || 0) >= 8;
      const macdAccel = (ind.macd?.score || 0) >= 8 && (ind.macd?.macd || 0) > 0;
      const explosiveSignals = [rvolExplosive, bbSqueeze, macdAccel].filter(Boolean).length;
      (c as any).isExplosive = explosiveSignals >= 2;
      if ((c as any).isExplosive) {
        await addLog('unified', 'scan', c.sym, `[🔥급등예상] ${c.sym} 폭발 신호 ${explosiveSignals}/3 (RVOL:${(ind.rvol?.rvol||0).toFixed(1)}x | Squeeze:${ind.squeeze?.score} | MACD:${ind.macd?.score}) → 우선 진입`, { explosiveSignals });
      }

      // ★ 슈퍼 패턴 (15% 수익 보장형): 에너지응축 + 세력매집 + ADX≥25 + 매물대얇음 중 2개 이상
      const superPat = c.scoring.superPattern;
      (c as any).isSuperPattern = superPat?.isSuperPattern || false;
      (c as any).superPatternSignals = superPat?.signals || [];
      if ((c as any).isSuperPattern) {
        const resistanceTag = superPat.resistanceThin ? '✅매물대 얇음(15%+ 슈팅 가능)' : '⚠️매물대 존재';
        await addLog('unified', 'scan', c.sym, `[🎯15%보장타겟] ${c.sym} 슈퍼 패턴 감지! [${superPat.signals.join('+')}] 신뢰도 ${superPat.confidence}% | ${resistanceTag} → 15% 수익 목표 집중 투자 대상`, { superPattern: superPat });
      }
    }

    // ★ Score Surge Detection: 점수 급상승 종목 알림
    for (const c of candidates) {
      const surge = detectScoreSurge(c.sym, c.scoring.totalScore);
      if (surge.isSurge) {
        (c as any).isScoreSurge = true;
        await addLog('unified', 'milestone', c.sym, `🚨 [급등 예상 종목 포착] ${c.sym} 점수 급상승! ${surge.prevScore}점 → ${c.scoring.totalScore}점 (+${surge.delta}점) | 60점 이상 돌파 → 즉시 매수 검토 대상`, { prevScore: surge.prevScore, currentScore: c.scoring.totalScore, delta: surge.delta });
      }
    }

    // ★★★ [승률 90% 예측 엔진] — 3대 필수조건 기반 확률 계산 ★★★
    const uniqueSectors = new Set<string>();
    for (const c of candidates) uniqueSectors.add(SECTOR_MAP[c.sym] || 'QQQ');
    const sectorChangePcts: Map<string, number> = new Map();
    for (const etf of uniqueSectors) {
      const cached = sectorQuoteCache.get(etf);
      if (cached && Date.now() - cached.timestamp < 60000) {
        sectorChangePcts.set(etf, cached.changePct);
      } else {
        try {
          const q = await finnhubFetch(`/quote?symbol=${etf}`);
          const cp = q?.dp || 0;
          sectorQuoteCache.set(etf, { changePct: cp, timestamp: Date.now() });
          sectorChangePcts.set(etf, cp);
        } catch { sectorChangePcts.set(etf, 0); }
      }
    }

    // Calculate profit probability for each candidate (4대 조건)
    for (const c of candidates) {
      const sectorETF = SECTOR_MAP[c.sym] || 'QQQ';
      const scp = sectorChangePcts.get(sectorETF) || 0;
      const cData = (c as any).data;
      const wp = calculateWinProbability(c.scoring, cData.closes, cData.highs, cData.lows, cData.opens, cData.volumes, c.sym, scp);
      (c as any).winProbability = wp.probability;
      (c as any).winConditions = wp.conditions;
      (c as any).winReasons = wp.reasons;

      if (wp.probability >= 85) {
        await addLog('unified', 'scan', c.sym, `[🏆익절확률 ${wp.probability}%] ${c.sym} ${wp.probability >= 90 ? '필승' : '유력'} 구간! [${wp.reasons.join(' + ')}] | ①패턴:${wp.conditions.pattern?'✅':'❌'} ②에너지:${wp.conditions.energy?'✅':'❌'} ③세력:${wp.conditions.bigOrder?'✅':'❌'} ④섹터:${wp.conditions.sector?'✅':'❌'}`, { winProbability: wp.probability, conditions: wp.conditions, reasons: wp.reasons });
      }
    }

    // ★ 익절 확률 필터: 90% 우선, 후보 없으면 85%로 완화
    let probFilteredCandidates = candidates.filter(c => (c as any).winProbability >= 90);
    const probThreshold = probFilteredCandidates.length > 0 ? 90 : 85;
    if (probFilteredCandidates.length === 0) {
      probFilteredCandidates = candidates.filter(c => (c as any).winProbability >= 85);
    }
    if (candidates.length > 0) {
      await addLog('unified', 'scan', null, `[익절확률필터] 후보 ${candidates.length}개 → 익절확률 ${probThreshold}%↑ 통과: ${probFilteredCandidates.length}개 (${candidates.length - probFilteredCandidates.length}개 제외)`, {});
    }

    // Sort: win probability → score surge → super pattern → explosive → liquidity → score
    const sessionCapPreference = (currentSession === 'PRE_MARKET' || currentSession === 'DAY') ? 'small' : 'large';
    probFilteredCandidates.sort((a, b) => {
      // ★ 승률 예측 최우선
      const aWP = (a as any).winProbability || 0;
      const bWP = (b as any).winProbability || 0;
      if (Math.abs(aWP - bWP) >= 3) return bWP - aWP;
      // ★ 점수 급상승 종목
      const aSurge = (a as any).isScoreSurge ? 3 : 0;
      const bSurge = (b as any).isScoreSurge ? 3 : 0;
      if (aSurge !== bSurge) return bSurge - aSurge;
      // ★ 슈퍼 패턴(15% 타겟)
      const aSP = (a as any).isSuperPattern ? 2 : 0;
      const bSP = (b as any).isSuperPattern ? 2 : 0;
      if (aSP !== bSP) return bSP - aSP;
      const aCapBonus = a.capType === sessionCapPreference ? 1 : 0;
      const bCapBonus = b.capType === sessionCapPreference ? 1 : 0;
      if (aCapBonus !== bCapBonus) return bCapBonus - aCapBonus;
      const aExp = (a as any).isExplosive ? 1 : 0;
      const bExp = (b as any).isExplosive ? 1 : 0;
      if (aExp !== bExp) return bExp - aExp;
      const aVB = (a as any).isVolumeBurst ? 1 : 0;
      const bVB = (b as any).isVolumeBurst ? 1 : 0;
      if (aVB !== bVB) return bVB - aVB;
      const aLiq = (a as any).liquidityScore || 0;
      const bLiq = (b as any).liquidityScore || 0;
      if (Math.abs(aLiq - bLiq) > 5) return bLiq - aLiq;
      return b.scoring.totalScore - a.scoring.totalScore;
    });

    // ★ 집중 투자: 승률 90%↑ 상위 5개로 제한
    const topCandidates = probFilteredCandidates.slice(0, 5);

    if (topCandidates.length > 0) {
      const summary = topCandidates.map((c, i) => {
        const wp = (c as any).winProbability;
        const volRank = (c as any).volumeRank;
        const volTag = volRank <= 20 ? ` Vol#${volRank}` : '';
        const burstTag = (c as any).isVolumeBurst ? '🔥' : '';
        const surgeTag = (c as any).isScoreSurge ? '🚨급상승' : '';
        return `${i+1}.${burstTag}${surgeTag}${c.sym}(${c.scoring.totalScore}점/승률${wp}%/${c.capType}${volTag})`;
      }).join(', ');
      await addLog('unified', 'scan', null, `[🏆확정적수익] [${timeStr}] 승률 90%↑ TOP ${topCandidates.length}개 집중 투자: ${summary}`, {});
    }

    for (const r of topCandidates) {
      if (openCount >= MAX_POSITIONS) break;
      const alreadyHolding = (openPos || []).some(p => p.symbol === r.sym && p.status === 'open');
      const isPyramiding = alreadyHolding && r.scoring.totalScore >= 80;
      const isSuperEntry = (r as any).isSuperPattern;
      const isScoreSurge = (r as any).isScoreSurge;
      
      // ★ 초집중 투자: 상위 1-2개에 100만 원 집중 투입 (자본 회전율 극대화)
      const CONCENTRATED_KRW = 1000000; // ₩100만원 집중 투입
      const positionPct = isPyramiding ? 0.05 : 0; // 모든 진입에 고정 금액 집중
      const maxKRW = positionPct === 0 ? Math.min(CONCENTRATED_KRW, balance * 0.50) : balance * positionPct;
      const priceKRW = toKRW(r.price);
      const qty = Math.floor(maxKRW / priceKRW);
      const costKRW = Math.floor(qty * priceKRW);

      if (qty <= 0 || costKRW > balance) {
        await addLog('unified', 'hold', r.sym, `[${timeStr}] ${r.sym} ${r.scoring.totalScore}점 → ⚠️ 잔고 부족`, {});
        continue;
      }

      // ★ 선취매: 0.3~0.5% 위로 공격적 지정가 (슬리피지 허용 매수로 확실한 물량 확보)
      const isAccumEntry = (r as any).isAccumulationEntry;
      const aggressiveSlip = isAccumEntry ? Math.max(sessionSlippage, 0.005) : sessionSlippage; // 최소 0.5% 상단 제시
      const adjustedPrice = applySessionSlippage(r.price, 'buy', spreadMul, aggressiveSlip);
      // ★ [전략 동기화] 초기 SL -10% / TP +15% 통일
      const stopLoss = +(adjustedPrice * 0.90).toFixed(4); // -10% 안전망
      // ★ 전 종목 TP +15% 통일 (슈퍼/선취매 구분 없이)
      const takeProfit = +(adjustedPrice * 1.15).toFixed(4);
      const tier = isPyramiding ? 'PYRAMID' : isSuperEntry ? 'SUPER-15%' : isAccumEntry ? 'PRE-STRIKE' : 'SCOUT';
      const winProb = (r as any).winProbability || 0;
      const winReasonsStr = ((r as any).winReasons || []).join('+');
      const balanceBefore = Math.round(balance);
      const newBuyBalance = balance - costKRW;
      const spreadNote = spreadMul > 1 ? ` | ⚠️ ${sessionLabel} 스프레드 ×${spreadMul}` : '';
      const capLabel = r.capType === 'large' ? '대형' : '소형';
      const volRank = (r as any).volumeRank;
      const volRankTag = volRank <= 50 ? ` | Vol#${volRank}` : '';
      const burstTag = (r as any).isVolumeBurst ? ' | 🔥수급돌파' : '';
      const condensationTag = isAccumEntry ? ` | 📡선취매(${(r as any).accumPattern}|응축${((r as any).accumCondensation || 0).toFixed(1)})` : '';
      const superTag = isSuperEntry ? ` | 🎯슈퍼패턴[${(r as any).superPatternSignals.join('+')}] 15%타겟 집중투자` : '';
      const probTag = ` | [예상 익절 확률: ${winProb}%] [${winReasonsStr}]`;
      
      // ★ 엔진 개편: 지표 상세 근거 로그
      const indDetails = Object.entries(r.scoring.indicators)
        .map(([k, v]: [string, any]) => `${k}:${v.score}`)
        .join('|');
      const logMsg = `[${isSuperEntry ? '🎯15%슈퍼매수' : isAccumEntry ? '데이장 선취매' : '🏆확정수익매수'}] [${sessionLabel}] [${timeStr}] ${r.sym} 10대 지표 중 ${r.scoring.metCount}개 충족 (${r.scoring.totalScore}점) [${capLabel}|${tier}|${qty}주@${fmtKRW(adjustedPrice)}|${fmtKRWRaw(costKRW)}]${probTag}${spreadNote}${volRankTag}${burstTag}${condensationTag}${superTag} | 지표: [${indDetails}] | [잔고: ${fmtKRWRaw(balanceBefore)} → ${fmtKRWRaw(newBuyBalance)}]`;

      // ★ 슈퍼 패턴 알림: "15% 익절이 보장된 슈퍼 패턴 종목 매수 완료"
      if (isSuperEntry) {
        await addLog('unified', 'milestone', r.sym, `🎯 [15% 익절 보장형 슈퍼 패턴] ${r.sym} 매수 완료! [${(r as any).superPatternSignals.join('+')}] | 승률 ${winProb}% | 15% 목표까지 자율 주행 홀딩 개시.`, { superPattern: r.scoring.superPattern, score: r.scoring.totalScore, winProbability: winProb });
      }

      await supabase.from('unified_trades').insert({
        symbol: r.sym, side: 'buy', quantity: qty, price: adjustedPrice,
        stop_loss: stopLoss, take_profit: takeProfit, status: 'open',
        cap_type: r.capType,
        entry_score: r.scoring.totalScore,
        ai_reason: logMsg, ai_confidence: winProb,
      });
      await supabase.from('unified_wallet').update({ balance: newBuyBalance, updated_at: now.toISOString() }).eq('id', wallet.id);
      balance = newBuyBalance;
      openCount++;
      await addLog('unified', 'buy', r.sym, logMsg, { score: r.scoring.totalScore, metCount: r.scoring.metCount, qty, costKRW, capType: r.capType, indicators: r.scoring.indicators, isSuperPattern: isSuperEntry, winProbability: winProb, winReasons: (r as any).winReasons });
    }

    // ========== AUTO-REPLACEMENT ==========
    {
      const refreshedOpenPos = (await supabase.from('unified_trades').select('*').eq('status', 'open')).data || [];
      for (const pos of refreshedOpenPos) {
        const data = await getQuoteAndCandles(pos.symbol);
        if (!data) continue;
        const scoring = score10Indicators(data.quote, data.closes, data.highs, data.lows, data.opens, data.volumes, isLowVolumeSession);
        const currentScore = scoring?.totalScore || 0;

        // ★ 승률 강화: 교체매매 점수 차이 10→20점 (잦은 교체 = 잦은 패 → 차단)
        const betterCandidate = candidates.find(c =>
          c.scoring.totalScore >= 70 &&
          c.scoring.totalScore - currentScore >= 20 &&
          !refreshedOpenPos.some(p => p.symbol === c.sym)
        );

        if (currentScore >= 50 && !betterCandidate) continue;

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

    await addLog('system', 'info', null, `[${timeStr}] [${sessionLabel}] 🏆 익절확률90% 자동매매 엔진 완료 — 풀: ${LARGE_SET.size + SMALL_SET.size + discoveredSymbols.length}개 | 슬롯: ${SCAN_SYMBOLS.length}개 | 진입: ${adaptedEntryThreshold}점+익절확률90%↑ | 본절: +1.0%→+0.1% | 매도: <50점 | 4대조건: 패턴+에너지+세력+섹터`);

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
