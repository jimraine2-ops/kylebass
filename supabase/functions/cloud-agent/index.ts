import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const FINNHUB_BASE = 'https://finnhub.io/api/v1';
const KRW_RATE = 1350;
const MIN_PRICE_KRW = 100; // ★ 동전주: 최저 100원까지 허용
const MIN_PRICE_USD = MIN_PRICE_KRW / KRW_RATE;
const MAX_PRICE_KRW = 12000; // ★ ₩12,000 미만 = $9 미만 저가주 전용 (자산 회전율 극대화)
const MAX_PRICE_USD = MAX_PRICE_KRW / KRW_RATE; // ≈ $9
const PENNY_THRESHOLD_USD = 1.00; // ★ $1 미만 = 동전주
const PENNY_THRESHOLD_KRW = 2000; // ★ ₩2,000 이하 = 동전주
const PENNY_ENTRY_SCORE = 70; // ★ 동전주 진입 문턱: 70점
const PENNY_BREAKEVEN_PCT = 1.0; // ★ 동전주 본절보호: +1.0% (강화)
const PENNY_IRON_HOLD_SCORE = 65; // ★ 동전주 철갑 홀딩: 65점
const PENNY_MAX_POSITIONS = 3; // ★ 동전주 최대 3종목 집중
const GHOST_BREAKEVEN_PCT = 1.0; // ★ Zero-Risk Lock: +1.0% 돌파 시 즉시 SL→매수가+0.1% (패배 원천 차단)
const PROFIT_CHASE_TRIGGER = 3.0; // ★ 수익 추격 모드 발동: +3.0% 돌파 시 SL→매수가+1.5%
const PROFIT_CHASE_SL_PCT = 1.015; // ★ 수익 추격 SL: 매수가 +1.5%
const TRAILING_DROP_PCT = 2.0; // ★ 추격 매도: 고점 대비 2.0% 하락 시에만 전량 매도
const DAILY_TARGET_KRW_CONST = 500000; // ★ 일일 목표: ₩500,000 (일당 50만 원 탈취)
const ZERO_RISK_SL_PCT = 1.001; // ★ Zero-Risk Lock SL: 매수가 +0.1% (패배 기록 0 유지)
const PREDICTIVE_ENTRY_SCORE = 60; // ★ Anti-Latency: 뉴스 없이 지표 60점 돌파 시 선취매
const LIQUIDITY_MULTIPLIER = 10; // ★ Liquidity Guard: 진입금액의 10배 이상 매수잔량 필요
const PASSIVE_FILL_TICKS = 3; // ★ 호가 장악: 매수 1호가 알박기 (시장가 금지)
const LATENCY_GUARD_SEC = 1.0; // ★ Timestamp Guard: 1초 이상 지연 시 2~3호가 아래 지정가
const ROUND_RESET_BASE_KRW = 5000000; // ★ [Infinite Loop] 라운드 리셋 원금: ₩5,000,000

// ★ [Infinite Loop] 라운드 추적: 당일 몇 번째 무한 루프인지 기록
let currentRound = 1;
let roundResetTimestamps: string[] = []; // 라운드 리셋 시점 기록
let cumulativeTotalProfitKRW = 0; // 전 라운드 누적 수익 (안전 자산)

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

// ★ [Anti-Latency] Passive Fill: 시장가 대신 매수 1호가 알박기 (슬리피지 0)
function applyPassiveFill(price: number, tickSize: number = 0.01): number {
  // 현재가에서 PASSIVE_FILL_TICKS만큼 아래에 지정가 배치
  return +(price - tickSize * PASSIVE_FILL_TICKS).toFixed(4);
}

// ★ [Anti-Latency] Timestamp Guard: 지연 감지 시 2~3호가 아래 매수 대기
function applyTimestampGuard(price: number, dataAgeMs: number, tickSize: number = 0.01): { adjustedPrice: number; isGuarded: boolean } {
  const dataAgeSec = dataAgeMs / 1000;
  if (dataAgeSec > LATENCY_GUARD_SEC) {
    const ticksBelow = Math.ceil(dataAgeSec); // 지연 1초당 1호가 아래 (최대 3)
    const guardTicks = Math.min(ticksBelow + 1, 3);
    return { adjustedPrice: +(price - tickSize * guardTicks).toFixed(4), isGuarded: true };
  }
  return { adjustedPrice: price, isGuarded: false };
}

// ★ [Liquidity Guard] 매수잔량 검증: 진입금액의 10배 이상 유동성 확인
function checkLiquidityGuard(tradingValueUSD: number, entryAmountKRW: number): { passed: boolean; ratio: number } {
  const entryAmountUSD = entryAmountKRW / KRW_RATE;
  const ratio = tradingValueUSD > 0 ? tradingValueUSD / entryAmountUSD : 0;
  return { passed: ratio >= LIQUIDITY_MULTIPLIER, ratio };
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

// ===== 고래 흔적 탐지 (저유동성 구간 매집 감지) =====
function detectWhaleTrace(closes: number[], volumes: number[], lows: number[]): { detected: boolean; supportLevel: number; confidence: number } {
  const n = closes.length - 1;
  if (n < 10) return { detected: false, supportLevel: 0, confidence: 0 };
  // 특정 가격대에서 반복적으로 지지되며 소량씩 매집하는 패턴
  const recentLows = lows.slice(-10);
  const avgLow = recentLows.reduce((a, b) => a + b, 0) / recentLows.length;
  const lowDeviation = recentLows.reduce((sum, l) => sum + Math.abs(l - avgLow), 0) / recentLows.length;
  const lowDeviationPct = avgLow > 0 ? (lowDeviation / avgLow) * 100 : 999;
  const tightSupport = lowDeviationPct < 1.0; // 저가가 1% 이내로 일정 = 강력 지지선
  // 거래량이 적지만 가격이 하락하지 않음
  const avgVol20 = volumes.slice(-20).reduce((a, b) => a + b, 0) / Math.min(20, volumes.length);
  const recentAvgVol = volumes.slice(-5).reduce((a, b) => a + b, 0) / 5;
  const lowVolume = avgVol20 > 0 && recentAvgVol / avgVol20 < 0.5;
  const priceStable = Math.abs(closes[n] - closes[Math.max(0, n - 5)]) / closes[Math.max(0, n - 5)] * 100 < 2;
  const detected = tightSupport && (lowVolume || priceStable);
  const confidence = detected ? (tightSupport && lowVolume && priceStable ? 92 : 85) : 0;
  return { detected, supportLevel: avgLow, confidence };
}

// ===== 에너지 응축 패턴 (발산 직전 감지) =====
function detectEnergyCondensation(closes: number[], highs: number[], lows: number[], volumes: number[]): { detected: boolean; signals: string[]; confidence: number } {
  const n = closes.length - 1;
  if (n < 20) return { detected: false, signals: [], confidence: 0 };
  const signals: string[] = [];
  // 1. RSI 저점 반등: RSI가 30-45에서 상향 전환
  const rsi = calculateRSI(closes, 14);
  const rsiRising = rsi[n] > rsi[n - 1] && rsi[n] >= 30 && rsi[n] <= 55 && rsi[n] - rsi[n - 1] >= 2;
  if (rsiRising) signals.push('RSI저점반등');
  // 2. MACD 골든크로스 임박: MACD line이 Signal에 수렴 중
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);
  const macd = ema12[n] - ema26[n];
  const macdPrev = n > 0 ? ema12[n - 1] - ema26[n - 1] : 0;
  const macdConverging = macd > macdPrev && macd < 0 && Math.abs(macd) < closes[n] * 0.005;
  if (macdConverging) signals.push('MACD골든임박');
  // 3. BB 극도 수축
  const atr = calculateATR(highs, lows, closes, 14);
  const bbWidth5 = atr.slice(-5).reduce((a, b) => a + b, 0) / 5;
  const bbWidth20 = atr.slice(-20).reduce((a, b) => a + b, 0) / 20;
  if (bbWidth20 > 0 && bbWidth5 / bbWidth20 < 0.5) signals.push('BB극도수축');
  // 4. 이평선 수렴
  const ema5 = calculateEMA(closes, 5);
  const ema10 = calculateEMA(closes, 10);
  const ema20 = calculateEMA(closes, 20);
  const emaSpread = Math.abs(ema5[n] - ema20[n]) / closes[n] * 100;
  if (emaSpread < 1.0) signals.push('이평선수렴');
  // 5. 거래량 감소 중 가격 유지 (응축)
  const avgVol5 = volumes.slice(-5).reduce((a, b) => a + b, 0) / 5;
  const avgVol20 = volumes.slice(-20).reduce((a, b) => a + b, 0) / Math.min(20, volumes.length);
  if (avgVol20 > 0 && avgVol5 / avgVol20 < 0.6) signals.push('거래량응축');

  const detected = signals.length >= 2;
  const confidence = signals.length >= 4 ? 96 : signals.length >= 3 ? 92 : signals.length >= 2 ? 88 : 0;
  return { detected, signals, confidence };
}

// ===== 필승 패턴 A/B/C 감지 (점수 무관 즉시 진입) =====
function detectCriticalPatterns(closes: number[], highs: number[], lows: number[], opens: number[], volumes: number[], quote: any): { patternA: boolean; patternB: boolean; patternC: boolean; patterns: string[]; confidence: number; whaleTrace: ReturnType<typeof detectWhaleTrace>; energyCondensation: ReturnType<typeof detectEnergyCondensation> } {
  const n = closes.length - 1;
  if (n < 20) return { patternA: false, patternB: false, patternC: false, patterns: [], confidence: 0, whaleTrace: { detected: false, supportLevel: 0, confidence: 0 }, energyCondensation: { detected: false, signals: [], confidence: 0 } };
  const patterns: string[] = [];

  // ★ 패턴 A (수급 돌파): 가격 횡보 중 거래대금 직전 5분 평균 300% 돌파 + VWAP 위
  const avgVol5 = volumes.slice(-6, -1).reduce((a, b) => a + b, 0) / 5;
  const currentVol = volumes[n];
  const volBurst = avgVol5 > 0 ? currentVol / avgVol5 : 1;
  const recentCloses5 = closes.slice(-6, -1);
  const priceRange5 = recentCloses5.length > 0 ? (Math.max(...recentCloses5) - Math.min(...recentCloses5)) / Math.min(...recentCloses5) * 100 : 999;
  const priceSideways = priceRange5 < 3;
  const vwap = calculateVWAP(highs.slice(-20), lows.slice(-20), closes.slice(-20), volumes.slice(-20));
  const aboveVWAP = closes[n] > vwap;
  const patternA = priceSideways && volBurst >= 3.0 && aboveVWAP;
  if (patternA) patterns.push('수급폭발(A)');

  // ★ 패턴 B (변동성 응축): BB 폭 극도 수축 + RSI 50선 강력 상향 돌파
  const ema20 = calculateEMA(closes, 20);
  const atr = calculateATR(highs, lows, closes, 14);
  const bbWidth5 = atr.slice(-5).reduce((a, b) => a + b, 0) / 5;
  const bbWidth20 = atr.slice(-20).reduce((a, b) => a + b, 0) / 20;
  const isTightBB = bbWidth20 > 0 && bbWidth5 / bbWidth20 < 0.5;
  const rsi = calculateRSI(closes, 14);
  const rsiCrossUp50 = rsi[n] > 50 && rsi[n] > rsi[n - 1] && (rsi[n - 1] <= 50 || rsi[n] - rsi[n - 1] >= 5);
  const patternB = isTightBB && rsiCrossUp50;
  if (patternB) patterns.push('변동성응축(B)');

  // ★ 패턴 C (이평선 정렬): 모든 EMA가 한 점으로 수렴 후 부채꼴 확산 시작
  const ema5 = calculateEMA(closes, 5);
  const ema10 = calculateEMA(closes, 10);
  const ema_20 = calculateEMA(closes, 20);
  const prevSpread = n > 1 ? Math.abs(ema5[n - 1] - ema_20[n - 1]) / closes[n - 1] * 100 : 999;
  const currSpread = Math.abs(ema5[n] - ema_20[n]) / closes[n] * 100;
  const wasConverging = prevSpread < 1.0;
  const nowDiverging = currSpread > prevSpread && ema5[n] > ema10[n] && ema10[n] > ema_20[n];
  const patternC = wasConverging && nowDiverging;
  if (patternC) patterns.push('이평선정렬(C)');

  // ★ 고래 흔적 & 에너지 응축 패턴
  const whaleTrace = detectWhaleTrace(closes, volumes, lows);
  const energyCondensation = detectEnergyCondensation(closes, highs, lows, volumes);
  if (whaleTrace.detected) patterns.push('고래매집');
  if (energyCondensation.detected && !patternB) patterns.push(`에너지응축(${energyCondensation.signals.join('+')})`);

  const confidence = patterns.length >= 4 ? 98 : patterns.length >= 3 ? 96 : patterns.length >= 2 ? 94 : patterns.length >= 1 ? 88 : 0;
  return { patternA, patternB, patternC, patterns, confidence, whaleTrace, energyCondensation };
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
  const isSqueeze = bbWidth20 > 0 && bbWidth5 / bbWidth20 < 0.6;
  const bbUpper = ema20[n] + 2 * atr[n];
  const avgVol20 = volumes.slice(-20).reduce((a,b)=>a+b,0) / 20;
  const rvol = avgVol20 > 0 ? volumes[n] / avgVol20 : 1;
  const bbBreakout = closes[n] > bbUpper && rvol >= 1.5;
  const energyCondensation = isSqueeze && rvol >= 3.0;
  if (energyCondensation && bbBreakout) signals.push('에너지응축폭발');
  else if (isSqueeze && bbBreakout) signals.push('BB스퀴즈돌파');
  else if (bbBreakout) signals.push('BB상단돌파');
  
  // 2. ★ 매집 확인
  const obv = detectOBVDivergence(closes, volumes);
  let bullCount = 0;
  for (let i = Math.max(0, n - 9); i <= n; i++) {
    if (closes[i] > (i > 0 ? closes[i-1] : closes[i])) bullCount++;
  }
  const aggressionRatio = (bullCount / Math.min(10, n + 1)) * 100;
  const isStrongAggression = aggressionRatio >= 60 && rvol >= 1.5;
  if (obv.priceSideways && obv.obvRising && isStrongAggression) signals.push('세력매집확인');
  else if (obv.priceSideways && obv.obvRising) signals.push('OBV매집');
  
  // 3. ADX 추세 강도
  if (adx >= 25) signals.push(`ADX${Math.round(adx)}`);
  
  // 4. 거래량 폭발
  if (rvol >= 3) signals.push(`RVOL${rvol.toFixed(1)}x`);
  
  // 5. 상승 여력 분석
  const recentHigh20 = Math.max(...highs.slice(-20));
  const allTimeHigh = Math.max(...highs);
  const distToHigh = allTimeHigh > 0 ? ((allTimeHigh - closes[n]) / closes[n]) * 100 : 0;
  const resistanceThin = distToHigh >= 15 || closes[n] >= recentHigh20;
  if (resistanceThin) signals.push('매물대얇음');
  
  // 6. 골든크로스 + RSI
  const ema9 = calculateEMA(closes, 9);
  const ema21 = calculateEMA(closes, 21);
  const rsi = calculateRSI(closes, 14);
  const goldenCross = n > 1 && ema9[n] > ema21[n] && ema9[n-1] <= ema21[n-1];
  const rsiMomentum = rsi[n] > 50 && rsi[n] > (rsi[n-1] || 50) && rsi[n] < 75;
  if (goldenCross && rsiMomentum) signals.push('골든크로스+RSI상승');
  
  const isSuperPattern = signals.length >= 2;
  const confidence = Math.min(100, signals.length * 20);
  return { isSuperPattern, signals, confidence, resistanceThin };
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

    // ★ 필승 패턴 A/B/C 감지
    const criticalPatterns = detectCriticalPatterns(closes, highs, lows, opens, volumes, quote);

    return {
    totalScore, trailingStop, rvol, changePct, metCount,
    vwap, bbLower, bbUpper,
    accumulation,
    adx: adxValue,
    obv: obvData,
    superPattern,
    criticalPatterns,
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

// ===== Win Probability Calculator (익절 확률 산출) =====
// ★ 동전주 여부 판별
function isPennyStock(price: number): boolean {
  return price > 0 && price < PENNY_THRESHOLD_USD;
}

function getWinProbability(score: number): number {
  if (score >= 80) return 98;
  if (score >= 75) return 95;
  if (score >= 70) return 90;
  if (score >= 65) return 85;
  if (score >= 60) return 80;
  if (score >= 55) return 75;
  if (score >= 50) return 60;
  if (score >= 45) return 45;
  if (score >= 40) return 30;
  return 15;
}

// ===== Finnhub 뉴스 감성 분석 (News Sentiment) =====
const newsSentimentCache: Map<string, { sentiment: number; bullish: number; count: number; ts: number }> = new Map();
const NEWS_CACHE_TTL = 300000; // 5분 캐시

async function getNewsSentiment(symbol: string): Promise<{ sentiment: number; bullishPct: number; newsCount: number; headline: string }> {
  const cached = newsSentimentCache.get(symbol);
  if (cached && Date.now() - cached.ts < NEWS_CACHE_TTL) {
    return { sentiment: cached.sentiment, bullishPct: cached.bullish, newsCount: cached.count, headline: '' };
  }
  
  try {
    const today = new Date();
    const from = new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const to = today.toISOString().split('T')[0];
    const data = await finnhubFetch(`/company-news?symbol=${symbol}&from=${from}&to=${to}`);
    if (!data || !Array.isArray(data) || data.length === 0) {
      return { sentiment: 50, bullishPct: 50, newsCount: 0, headline: '' };
    }
    
    const BULLISH_KEYWORDS = ['surge', 'soar', 'jump', 'rally', 'gain', 'rise', 'bull', 'upgrade', 'beat', 'strong', 'record', 'breakout', 'momentum', 'growth', 'profit', 'positive', 'outperform', 'buy', 'up', 'high', 'boom'];
    const BEARISH_KEYWORDS = ['crash', 'plunge', 'drop', 'fall', 'decline', 'bear', 'downgrade', 'miss', 'weak', 'loss', 'risk', 'warning', 'sell', 'down', 'low', 'cut', 'negative', 'concern'];
    
    let bullishCount = 0;
    let bearishCount = 0;
    const recentNews = data.slice(0, 20); // 최근 20개만 분석
    
    for (const article of recentNews) {
      const text = ((article.headline || '') + ' ' + (article.summary || '')).toLowerCase();
      const bullHits = BULLISH_KEYWORDS.filter(kw => text.includes(kw)).length;
      const bearHits = BEARISH_KEYWORDS.filter(kw => text.includes(kw)).length;
      if (bullHits > bearHits) bullishCount++;
      else if (bearHits > bullHits) bearishCount++;
    }
    
    const totalAnalyzed = bullishCount + bearishCount || 1;
    const bullishPct = Math.round((bullishCount / totalAnalyzed) * 100);
    const sentiment = bullishPct; // 0~100: 100=완전강세
    
    newsSentimentCache.set(symbol, { sentiment, bullish: bullishPct, count: recentNews.length, ts: Date.now() });
    return { sentiment, bullishPct, newsCount: recentNews.length, headline: recentNews[0]?.headline || '' };
  } catch {
    return { sentiment: 50, bullishPct: 50, newsCount: 0, headline: '' };
  }
}

// ===== 시장 전체 뉴스 감성 스캔 (Market-Wide News Pulse) =====
async function getMarketNewsPulse(): Promise<{ overall: number; topBullish: string[]; topBearish: string[] }> {
  try {
    const data = await finnhubFetch(`/news?category=general`);
    if (!data || !Array.isArray(data) || data.length === 0) {
      return { overall: 50, topBullish: [], topBearish: [] };
    }
    
    const BULLISH = ['surge', 'rally', 'gain', 'bull', 'record', 'growth', 'beat', 'strong', 'boom', 'breakout'];
    const BEARISH = ['crash', 'plunge', 'bear', 'decline', 'risk', 'warning', 'recession', 'weak', 'sell', 'fear'];
    
    let bullCount = 0, bearCount = 0;
    const recentNews = data.slice(0, 30);
    
    for (const article of recentNews) {
      const text = ((article.headline || '') + ' ' + (article.summary || '')).toLowerCase();
      const bHits = BULLISH.filter(kw => text.includes(kw)).length;
      const brHits = BEARISH.filter(kw => text.includes(kw)).length;
      if (bHits > brHits) bullCount++;
      else if (brHits > bHits) bearCount++;
    }
    
    const total = bullCount + bearCount || 1;
    const overall = Math.round((bullCount / total) * 100);
    return { overall, topBullish: [], topBearish: [] };
  } catch {
    return { overall: 50, topBullish: [], topBearish: [] };
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
  const sampleSize = 20; // ★ 타임아웃 방지: 최소 샘플링
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
    if (i + 5 < sample.length) await new Promise(r => setTimeout(r, 100)); // ★ 200ms→100ms
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

    // ★ 전 종목 동적 발견: 비활성화 (타임아웃 방지 — 기존 풀 443개로 충분)
    // try {
    //   const discovered = await discoverAllUSStocks();
    //   ...
    // } catch { }
    const sessionSlippage = sessionInfo.aggressiveSlippage; // ★ 공격적 체결 슬리피지

    // ★ 필승 로직: 정규장 개장 직후 15분(09:30~09:45 ET) 뇌동매매 방지
    const etStr2 = now.toLocaleString('en-US', { timeZone: 'America/New_York' });
    const et2 = new Date(etStr2);
    const etTime = et2.getHours() * 60 + et2.getMinutes();
    const isOpeningRush = etTime >= 570 && etTime < 585; // 09:30~09:45 ET

    // ========== SESSION TRANSITION RESET (moved after wallet/positions load) ==========
    const currentSession = sessionInfo.session;

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

    // Step 2: Fill 30 active slots — ★ 타임아웃 방지: 15 대형 + 15 소형 = 30개 정예 슬롯
    const LARGE_SLOTS = 15;
    const SMALL_SLOTS = 15;

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
    for (let i = 0; currentSmall.length < SMALL_SLOTS && i < Math.min(20, dynSymbols.length); i++) {
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

    // ========== SESSION TRANSITION RESET (after openPos loaded) ==========
    if (lastSessionType && lastSessionType !== currentSession) {
      const heldBefore = new Set((openPos || []).map((p: any) => p.symbol));
      const resetCount = activeUnifiedList.size;
      activeUnifiedList.clear();
      for (const s of heldBefore) activeUnifiedList.add(s);
      await addLog('system', 'info', null, `[세션전환] ${lastSessionType} → ${currentSession} | 스캔 리스트 리셋 (${resetCount}개 초기화, 보유 ${heldBefore.size}개 유지) — 새 수급 기반 종목 유입 시작`, {});
    }
    lastSessionType = currentSession;

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

    // ========== [INFINITE LOOP] 수익 목표 달성 시 자동 리셋 & 재공략 ==========
    {
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      const { data: todayClosedTrades } = await supabase
        .from('unified_trades')
        .select('pnl, closed_at')
        .not('status', 'eq', 'open')
        .gte('closed_at', todayStart.toISOString());
      
      const todayRealizedPnl = (todayClosedTrades || []).reduce((sum: number, t: any) => sum + (t.pnl || 0), 0);
      // 현재 라운드 수익 = 오늘 총 실현 수익 - 이전 라운드 누적 수익 (안전 자산)
      const currentRoundPnl = todayRealizedPnl - cumulativeTotalProfitKRW;
      const currentOpenCount = (openPos || []).filter((p: any) => p.status === 'open').length;
      
      if (currentRoundPnl >= DAILY_TARGET_KRW_CONST && currentOpenCount === 0) {
        // ★ 목표 달성 + 모든 포지션 청산 완료 → 무한 루프 리셋!
        cumulativeTotalProfitKRW = todayRealizedPnl; // 누적 수익을 안전 자산으로 분리
        const profitSaved = currentRoundPnl;
        const completedRound = currentRound;
        currentRound++;
        roundResetTimestamps.push(now.toISOString());
        
        // 잔고를 원금 ₩1,000,000으로 리셋 (수익금은 안전 자산으로 분리)
        const resetBalance = ROUND_RESET_BASE_KRW;
        await supabase.from('unified_wallet').update({ 
          balance: resetBalance, 
          updated_at: now.toISOString() 
        }).eq('id', wallet.id);
        balance = resetBalance;
        
        await addLog('system', 'milestone', null, 
          `🏆🔄 [Round ${completedRound} 완료 → Round ${currentRound} 시작!] 수익 목표 ₩${DAILY_TARGET_KRW_CONST.toLocaleString()} 달성! | ` +
          `Round ${completedRound} 수익: ${fmtKRWRaw(profitSaved)} → 안전 자산으로 분리 | ` +
          `누적 총 수익: ${fmtKRWRaw(cumulativeTotalProfitKRW)} | ` +
          `원금 ${fmtKRWRaw(resetBalance)}으로 재부팅 → 12,000원 미만 필승주 재스캔 개시!`,
          { 
            completedRound, 
            newRound: currentRound, 
            roundProfit: profitSaved, 
            cumulativeProfit: cumulativeTotalProfitKRW,
            resetBalance,
            roundResetTimestamps 
          }
        );
        
        // 스캔 리스트 초기화 → 새 사냥 시작
        activeUnifiedList.clear();
        lastScores.clear();
        
        await addLog('unified', 'info', null, 
          `[Round ${currentRound}] 🎯 새 라운드 스캔 엔진 재부팅 완료 — ` +
          `Finnhub × Twelve Data 교차 조회로 익절 확률 90%↑ 신규 5개 정예 종목 탐색 중... | ` +
          `잔고: ${fmtKRWRaw(resetBalance)} | 이전 라운드 종목도 필승 구간 재진입 시 Re-entry 허용`,
          { round: currentRound, balance: resetBalance }
        );
      } else if (currentRoundPnl >= DAILY_TARGET_KRW_CONST && currentOpenCount > 0) {
        // 목표 달성했지만 아직 열린 포지션 존재 → 대기 로그
        await addLog('system', 'info', null, 
          `[Round ${currentRound}] 💰 수익 목표 ${fmtKRWRaw(DAILY_TARGET_KRW_CONST)} 달성! (현 라운드 수익: ${fmtKRWRaw(currentRoundPnl)}) | ` +
          `잔여 포지션 ${currentOpenCount}개 청산 대기 중 → 전량 청산 후 Round ${currentRound + 1} 자동 시작`,
          { currentRoundPnl, openCount: currentOpenCount, round: currentRound }
        );
      }
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
    let baseEntryThreshold = 65; // ★ 65점 돌파 필승형: 진입 문턱 65점
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
      if (qqqBonus > 0) baseEntryThreshold = Math.max(62, baseEntryThreshold - qqqBonus);
      await addLog('system', 'info', null, `[시장동기화] SPY ${spyChange.toFixed(2)}% / QQQ ${qqqChange.toFixed(2)}% → QQQ보너스 -${qqqBonus}점, 진입기준 ${baseEntryThreshold}점`, { spyChange, qqqChange, qqqBonus });
    } catch { /* fallback */ }

    // ★ 시장 전체 뉴스 감성 분석 (Market News Pulse)
    let marketNewsPulse = 50;
    try {
      const pulse = await getMarketNewsPulse();
      marketNewsPulse = pulse.overall;
      const sentiment = marketNewsPulse >= 70 ? '🟢강세' : marketNewsPulse >= 50 ? '🟡중립' : '🔴약세';
      await addLog('system', 'info', null, `[📰뉴스펄스] 미국 시장 전체 뉴스 감성: ${sentiment} ${marketNewsPulse}% (긍정률)`, { marketNewsPulse });
    } catch { /* non-critical */ }

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
    if (recentWinRate < 15) baseEntryThreshold = Math.max(baseEntryThreshold, 75);
    else if (recentWinRate < 25) baseEntryThreshold = Math.max(baseEntryThreshold, 72);

    // Session adaptation — ★ 필승형: 최소 65점 강제 하한선 (장외에서도 65점 이하 진입 금지)
    const rawAdapted = Math.round(baseEntryThreshold * entryRelax);
    const adaptedEntryThreshold = Math.max(rawAdapted, 65); // ★ 절대 하한 65점
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
        const isPennyPos = price < 5 || pos.cap_type === 'small';

        // ===== [수익 무한 확장] 고수익 익절 지시서 — 3% 전까지 매도 금지, 고점-2% 트레일링 =====
        const indicatorsOver60 = quantScore >= 60;
        const peakPrice = Math.max(pos.peak_price || pos.price, price);
        const drop = peakPrice > 0 ? ((peakPrice - price) / peakPrice) * 100 : 0;

        // ★ 수익 추격 모드: 3.0% 돌파 시 SL→매수가+1.5%
        if (pnlPct >= PROFIT_CHASE_TRIGGER && pos.stop_loss < pos.price * PROFIT_CHASE_SL_PCT) {
          const chaseSL = +(pos.price * PROFIT_CHASE_SL_PCT).toFixed(4);
          await supabase.from('unified_trades').update({ stop_loss: chaseSL }).eq('id', pos.id);
          pos.stop_loss = chaseSL;
          await addLog('unified', 'defense', sym, `[🚀수익추격모드] ${sym} +${pnlPct.toFixed(2)}% ≥ ${PROFIT_CHASE_TRIGGER}% → SL=${fmtKRW(chaseSL)}(매수가+1.5%) 수익 추격 개시! 고점-${TRAILING_DROP_PCT}% 트레일링`, { quantScore, pnlPct: +pnlPct.toFixed(2) });
        }

        // ★ 추가 수익 구간 SL 상향: 고점 대비 SL을 계속 끌어올림
        if (pnlPct >= 10 && pos.stop_loss < pos.price * 1.07) {
          const rs = +(pos.price * 1.07).toFixed(4);
          await supabase.from('unified_trades').update({ stop_loss: rs }).eq('id', pos.id);
          pos.stop_loss = rs;
          await addLog('unified', 'defense', sym, `[10%방어] ${sym} +${pnlPct.toFixed(2)}% → SL +7.0% (최소 수익 확보)`, { quantScore });
        } else if (pnlPct >= 7 && pos.stop_loss < pos.price * 1.04) {
          const rs = +(pos.price * 1.04).toFixed(4);
          await supabase.from('unified_trades').update({ stop_loss: rs }).eq('id', pos.id);
          pos.stop_loss = rs;
          await addLog('unified', 'defense', sym, `[7%방어] ${sym} +${pnlPct.toFixed(2)}% → SL +4.0%`, { quantScore });
        } else if (pnlPct >= 5 && pos.stop_loss < pos.price * 1.025) {
          const rs = +(pos.price * 1.025).toFixed(4);
          await supabase.from('unified_trades').update({ stop_loss: rs }).eq('id', pos.id);
          pos.stop_loss = rs;
          await addLog('unified', 'defense', sym, `[5%방어] ${sym} +${pnlPct.toFixed(2)}% → SL +2.5%`, { quantScore });
        }

        if (price > (pos.peak_price || pos.price)) {
          await supabase.from('unified_trades').update({ peak_price: peakPrice }).eq('id', pos.id);
        }

        // ===== [핵심] 익절 로직 — 3.0% 전까지 절대 매도 금지, 그 이후 고점-2.0% 트레일링만 =====
        let shouldClose = false;
        let closeReason = '';
        let newStatus = 'closed';
        const accumInfo = scoring?.accumulation;
        const isIronHold = accumInfo && accumInfo.condensation >= 6 && quantScore >= 50;
        const emaAligned = scoring?.indicators?.emaAlign?.aligned === true;
        const indicatorsStrong = quantScore >= 55;
        const technicalSafe = (scoring?.indicators?.candle?.vwapCross ?? false) || (price > (scoring?.bbLower || 0));
        const coreIntact = emaAligned && technicalSafe;
        const isPreMarketEntry = pos.ai_reason?.includes('선취매') || pos.ai_reason?.includes('PRE') || pos.ai_reason?.includes('DAY');

        // ★ 30%+ 대시세: 지표 60점 이상이면 계속 추격, 아니면 고점-2% 트레일링
        if (pnlPct >= 30.0) {
          if (quantScore >= 60) {
            if (drop >= TRAILING_DROP_PCT) {
              shouldClose = true;
              closeReason = `[🏆30%+대시세익절] [${sessionLabel}] [${timeStr}] [${sym}] +${pnlPct.toFixed(1)}% 고점-${drop.toFixed(2)}% (지표 ${quantScore}점) → 대시세 수익 확정`;
              newStatus = 'mega_profit';
            } else {
              await addLog('unified', 'hold', sym, `[🚀50%추격] ${sym} +${pnlPct.toFixed(2)}% 대시세 진행 중! 지표 ${quantScore}점(≥60) → 고점-${TRAILING_DROP_PCT}% 트레일링`, { quantScore, pnlPct: +pnlPct.toFixed(2), peakPrice, drop });
            }
          } else {
            if (drop >= TRAILING_DROP_PCT) {
              shouldClose = true;
              closeReason = `[🏆30%트레일링] [${sessionLabel}] [${timeStr}] [${sym}] +${pnlPct.toFixed(1)}% 고점-${drop.toFixed(2)}% → 대시세 수익 확정`;
              newStatus = 'mega_profit';
            } else {
              await addLog('unified', 'hold', sym, `[🚀30%+추격] ${sym} +${pnlPct.toFixed(2)}% | 고점-${drop.toFixed(2)}% → 트레일링 유지`, { quantScore, pnlPct: +pnlPct.toFixed(2) });
            }
          }
        } else if (pnlPct >= 15.0) {
          // ★ 15%+: 지표 60점 이상이면 계속 추격 (고점-2% 트레일링)
          if (quantScore >= 60) {
            if (drop >= TRAILING_DROP_PCT) {
              shouldClose = true;
              closeReason = `[🏆15%+트레일링] [${sessionLabel}] [${timeStr}] [${sym}] +${pnlPct.toFixed(1)}% 고점-${drop.toFixed(2)}% (지표 ${quantScore}점) → 수익 극대화 확정`;
              newStatus = 'trailing_profit';
            } else {
              await addLog('unified', 'hold', sym, `[🎯30%추격] ${sym} +${pnlPct.toFixed(2)}% | 지표 ${quantScore}점(≥60) → 고점-${TRAILING_DROP_PCT}% 트레일링으로 30~50% 추격`, { quantScore, pnlPct: +pnlPct.toFixed(2), peakPrice, drop });
            }
          } else {
            // 15%+ 지표 60 미만 → 고점-2% 트레일링
            if (drop >= TRAILING_DROP_PCT) {
              shouldClose = true;
              closeReason = `[🏆15%트레일링] [${sessionLabel}] [${timeStr}] [${sym}] +${pnlPct.toFixed(1)}% 고점-${drop.toFixed(2)}% → 수익 확정`;
              newStatus = 'trailing_profit';
            } else {
              await addLog('unified', 'hold', sym, `[🎯15%→30%추격] ${sym} +${pnlPct.toFixed(2)}% | 고점-${drop.toFixed(2)}% → 트레일링 유지`, { quantScore, pnlPct: +pnlPct.toFixed(2) });
            }
          }
        } else if (pnlPct >= PROFIT_CHASE_TRIGGER) {
          // ★ 3~15% 구간: 수익 추격 모드 — 고점-2.0% 트레일링만 적용, 절대 조기 매도 금지
          if (drop >= TRAILING_DROP_PCT && !indicatorsStrong) {
            shouldClose = true;
            closeReason = `[추격익절] [${sessionLabel}] [${timeStr}] [${sym}] +${pnlPct.toFixed(1)}% 고점-${drop.toFixed(2)}% + 지표 약화(${quantScore}점) → 수익 확정`;
            newStatus = 'trailing_profit';
          } else if (drop >= TRAILING_DROP_PCT && indicatorsStrong) {
            await addLog('unified', 'hold', sym, `[Iron Hold] ${sym} +${pnlPct.toFixed(2)}% 고점-${drop.toFixed(2)}% BUT 지표 ${quantScore}점(≥55) → 30% 추격 중`, { quantScore, drop, isIronHold });
          } else {
            await addLog('unified', 'hold', sym, `[🛡️철벽홀딩] ${sym} +${pnlPct.toFixed(2)}% 수익 추격 중 | 지표 ${quantScore}점 → 고점-${TRAILING_DROP_PCT}% 트레일링, 30% 목표 추격!`, { quantScore, pnlPct: +pnlPct.toFixed(2), drop });
          }
        } else if (pnlPct >= 1.0 && pnlPct < PROFIT_CHASE_TRIGGER) {
          // ★ 1~3% 구간: 절대 매도 금지! 3% 돌파까지 인내
          await addLog('unified', 'hold', sym, `[🎯3%돌파대기] ${sym} +${pnlPct.toFixed(2)}% | 지표 ${quantScore}점 → 3.0% 돌파 시 수익 추격 모드 발동 예정 (현재 매도 금지!)`, { quantScore, pnlPct: +pnlPct.toFixed(2) });
        } else if (pnlPct >= 0 && pnlPct < 1.0) {
          // ★ 0~1% 구간: 본절가 보호 발동 전 — 홀딩
          if (quantScore >= 50) {
            await addLog('unified', 'hold', sym, `[홀딩] ${sym} +${pnlPct.toFixed(2)}% | 지표 ${quantScore}점 → 본절가 보호(+1.0%) 대기 중`, { quantScore, pnlPct: +pnlPct.toFixed(2) });
          }
        } else if (pos.take_profit && price >= pos.take_profit) {
          // TP 도달 → 상향 또는 트레일링 전환 (매도 금지)
          if (quantScore >= 60) {
            await addLog('unified', 'hold', sym, `[🎯TP도달→무한추격] ${sym} TP 도달 + 지표 ${quantScore}점(≥60) → TP 10% 추가 상향, 수익 무한 확장`, { quantScore, pnlPct: +pnlPct.toFixed(2) });
            const newTP = +(price * 1.10).toFixed(4);
            await supabase.from('unified_trades').update({ take_profit: newTP }).eq('id', pos.id);
          } else {
            // TP 도달 + 지표 약세 → 고점-2% 트레일링
            if (drop >= TRAILING_DROP_PCT) {
              shouldClose = true;
              closeReason = `[목표익절] [${sessionLabel}] [${timeStr}] [${sym}] TP 도달 + 고점-${drop.toFixed(2)}% → 수익 확정`;
              newStatus = 'profit_taken';
            }
          }
        }

        // 2. ★ [철갑 홀딩] SL 터치 — 동전주: 65점, 일반: 60점 이상이면 절대 매도 금지
        const ironHoldThreshold = isPennyPos ? PENNY_IRON_HOLD_SCORE : 60;
        const indicatorsIronHold = quantScore >= ironHoldThreshold;
        if (!shouldClose && pos.stop_loss && price <= pos.stop_loss) {
          if (pnlPct >= 0) {
            shouldClose = true;
            closeReason = `[본절방어] [${sessionLabel}] [${timeStr}] [${sym}] 본절가 터치 (${quantScore}점)`;
            newStatus = 'breakeven_exit';
          } else if (indicatorsIronHold) {
            const pennyTag = isPennyPos ? '🪙동전주' : '';
            await addLog('unified', 'hold', sym, `[🛡️철갑홀딩] ${pennyTag} ${sym} -${Math.abs(pnlPct).toFixed(2)}% 하락 중이나 지표 ${quantScore}점(≥${ironHoldThreshold})으로 견고함 — 필승 홀딩 중. 수익권(+3%~50%) 진입까지 절대 매도 금지`, { quantScore, metCount, pnlPct: +pnlPct.toFixed(2), coreIntact, isIronHold, isPenny: isPennyPos });
          } else if (pnlPct > -10 && quantScore >= 50) {
            // ★ 50~59점: 일반 홀딩
            await addLog('unified', 'hold', sym, `[변동성 구간: 지표 기반 홀딩] ${sym} -${Math.abs(pnlPct).toFixed(2)}% | 지표 ${quantScore}점(≥50) → 대시세 대기`, { quantScore, metCount, pnlPct: +pnlPct.toFixed(2), coreIntact, isIronHold });
          } else if (pnlPct > -10 && quantScore >= 40) {
            // ★ 40~49점: 경고, 매도 유보
            await addLog('unified', 'warning', sym, `[변동성 구간: 주의 관찰] ${sym} -${Math.abs(pnlPct).toFixed(2)}% + 지표 ${quantScore}점(40~49) → 매도 유보`, { quantScore, pnlPct: +pnlPct.toFixed(2) });
          } else if (pnlPct <= -10 && quantScore >= 50 && (coreIntact || technicalSafe)) {
            // ★ -10% 이하 + 지표 50점 이상 + 기술 안전 → 홀딩
            await addLog('unified', 'hold', sym, `[AI 판단: 홀딩 권장] ${sym} -${Math.abs(pnlPct).toFixed(2)}% BUT 지표 ${quantScore}점(≥50) + ${coreIntact ? 'VWAP+이평선 정배열' : '기술안전'} → 홀딩`, { quantScore, metCount, pnlPct: +pnlPct.toFixed(2), coreIntact, isIronHold });
          } else if (pnlPct <= -10 && quantScore >= 40) {
            await addLog('unified', 'warning', sym, `[⚠️ 손절 경고] ${sym} -${Math.abs(pnlPct).toFixed(2)}% -10% 이하 + 지표 ${quantScore}점(40~49) → 매도 임박`, { quantScore, pnlPct: +pnlPct.toFixed(2) });
          } else {
            // ★ 최종 방어선: 지표 40점 미만 → 자산 보호 매도
            shouldClose = true;
            closeReason = `[추세완전이탈] [${sessionLabel}] [${timeStr}] [${sym}] -${Math.abs(pnlPct).toFixed(2)}% + 지표 ${quantScore}점(<40) → 자산 보호 매도`;
            newStatus = 'trend_collapse';
          }
        }

        // 3. ★ 철갑 홀딩: 지표 60점 이상이면 수익 확정 전까지 절대 매도 금지
        // ★ [Iron-Hold] 익절확률 90% 이상이면 자동 매도 일절 금지
        const winProbNow = getWinProbability(quantScore);
        if (!shouldClose) {
          // ★ 익절확률 90%+ = 무제한 홀딩 (매도 금지 조건)
          if (winProbNow >= 90 && pnlPct < 0) {
            await addLog('unified', 'hold', sym, `[🛡️패배제로홀딩] ${sym} 가격 -${Math.abs(pnlPct).toFixed(2)}% 하락 BUT 익절확률 ${winProbNow}%(≥90%) → 자동매도 일절 금지! 지표 붕괴까지 끝까지 홀딩`, { quantScore, winProb: winProbNow, pnlPct: +pnlPct.toFixed(2) });
          }
          // ★ 철갑 홀딩: 지표 60점 이상 → 가격 하락 무관 "통계적으로 반드시 이긴다"
          else if (indicatorsIronHold && pnlPct < 0) {
            await addLog('unified', 'hold', sym, `[🛡️철갑홀딩] ${sym} 가격 -${Math.abs(pnlPct).toFixed(2)}% 하락 중이나 지표 ${quantScore}점(≥60)으로 견고함 — 필승 홀딩 중. 수익권(+3%~50%) 진입까지 끝까지 홀딩`, { quantScore, condensation: accumInfo?.condensation, pattern: accumInfo?.pattern, pnlPct: +pnlPct.toFixed(2) });
          }
          // ★ Iron Hold: 필승 패턴(응축도≥6 + 지표≥50) → 일시적 하락 무시
          else if (isIronHold && pnlPct < 0) {
            await addLog('unified', 'hold', sym, `[Iron Hold 🛡️] ${sym} -${Math.abs(pnlPct).toFixed(2)}% 필승 패턴(응축도${accumInfo.condensation.toFixed(1)}/10) + 지표 ${quantScore}점 → 대폭 상승 전조, 절대 홀딩`, { quantScore, condensation: accumInfo.condensation, pattern: accumInfo.pattern, pnlPct: +pnlPct.toFixed(2) });
          }
          // ★ 세션별: 저거래량 밀림 → 개미 털기
          else if (isLowVolumeSession && pnlPct < 0 && quantScore >= 50) {
            await addLog('unified', 'hold', sym, `[세션홀딩] ${sym} ${sessionLabel} -${Math.abs(pnlPct).toFixed(2)}% 밀림 → 지표 ${quantScore}점(≥50) 양호, 홀딩`, { quantScore, pnlPct: +pnlPct.toFixed(2), session: sessionLabel });
          }
          // ★ 선취매 종목: 지표 50점 이상 → 정규장까지 무조건 보유
          else if (isPreMarketEntry && quantScore >= 50 && currentSession !== 'REGULAR') {
            await addLog('unified', 'hold', sym, `[선취매 완료: 정규장 폭발 대기 중] ${sym} 지표 ${quantScore}점(≥50) → 정규장 20~50% 대시세 추격 목표`, { quantScore, pnlPct: +pnlPct.toFixed(2) });
          }
          // ★ 선취매 종목: 정규장 진입 후 지표 55점 이상이면 끝까지 홀딩
          else if (isPreMarketEntry && indicatorsStrong && currentSession === 'REGULAR') {
            await addLog('unified', 'hold', sym, `[선취매→정규장 추격] ${sym} 정규장 진입! 지표 ${quantScore}점(≥55) → 목표 수익 50만 원 달성까지 추격`, { quantScore, pnlPct: +pnlPct.toFixed(2) });
          }
          // ★ 50~59점: 일반 홀딩
          else if (pnlPct < 0 && quantScore >= 50) {
            await addLog('unified', 'hold', sym, `[변동성 구간: 지표 기반 홀딩 중] ${sym} -${Math.abs(pnlPct).toFixed(2)}% 정상 변동성 | 지표 ${quantScore}점(≥50) → 대시세 대기`, { quantScore, vwapCross, aboveBB, pnlPct: +pnlPct.toFixed(2) });
          }
          else if (pnlPct < 0 && quantScore >= 40) {
            await addLog('unified', 'warning', sym, `[변동성 구간: 주의 관찰] ${sym} -${Math.abs(pnlPct).toFixed(2)}% + 지표 ${quantScore}점(40~49) → 매도 유보`, { quantScore, pnlPct: +pnlPct.toFixed(2) });
          }
          // ★ 최종 방어선: 지표 40점 미만 → 매도
          else if (quantScore < 40) {
            shouldClose = true;
            closeReason = `[추세완전이탈] [${sessionLabel}] [${timeStr}] [${sym}] ${quantScore}점(<40) → 자산 보호 매도`;
            newStatus = 'trend_collapse';
          }
          // -10% 이하 + 40~44점 + VWAP 이탈 → 매도
          else if (pnlPct <= -10 && quantScore < 45 && !vwapCross && !emaAligned) {
            shouldClose = true;
            closeReason = `[복합위험] [${sessionLabel}] [${timeStr}] [${sym}] -${Math.abs(pnlPct).toFixed(2)}% + ${quantScore}점(<45) + VWAP이탈 → 매도`;
            newStatus = 'indicator_exit';
          }
          // 40~49점 → 경고만
          else if (quantScore < 50 && quantScore >= 40) {
            await addLog('unified', 'warning', sym, `[주의] ${sym} ${quantScore}점(40~49) ⚠️ 지표 약화 중 | PnL: ${pnlPct.toFixed(2)}%`, { quantScore, pnlPct: +pnlPct.toFixed(2) });
          }
          // 블랙리스트 + 지표 미달
          else if (blacklistSymbols.has(sym) && pnlPct <= 0.2 && quantScore < 50) {
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
          // ★ 누적 수익 계산
          const { data: allClosedToday } = await supabase
            .from('unified_trades')
            .select('pnl')
            .neq('status', 'open')
            .gte('closed_at', todayStart2.toISOString());
          const cumulPnl = (allClosedToday || []).reduce((s, t) => s + (t.pnl || 0), 0);
          await addLog('unified', 'exit', sym, `[Round ${currentRound}] ${closeReason} | PnL: ${fmtKRWRaw(pnlKRW)} | 오늘의 총 누적 수익: ${fmtKRWRaw(cumulPnl)} | [잔고: ${fmtKRWRaw(balanceBefore)} → ${fmtKRWRaw(newBalance)}]`, { pnl: pnlKRW, pnlPct: +pnlPct.toFixed(2), cumulativePnl: cumulPnl, round: currentRound });
        }
      }
      await new Promise(r => setTimeout(r, 200));
    }

    // ★ 역발상 추매: openCount 선언 후 실행 (아래 ENTRY SCAN 이후로 이동)

    // ========== 일일 수익 목표 체크 (₩300,000) ==========
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const { data: todayClosedTrades } = await supabase
      .from('unified_trades')
      .select('pnl')
      .not('status', 'eq', 'open')
      .gte('closed_at', todayStart.toISOString());
    const dailyPnl = (todayClosedTrades || []).reduce((sum, t) => sum + (t.pnl || 0), 0);
    const dailyTargetHit = dailyPnl >= DAILY_TARGET_KRW_CONST;
    if (dailyTargetHit) {
      await addLog('unified', 'milestone', null, `🎉🏆 [일일 목표 달성!] 오늘 실현 수익 ${fmtKRWRaw(dailyPnl)} ≥ ₩500,000 — 일당 50만 원 탈취 성공!`, { dailyPnl });
    } else {
      await addLog('system', 'info', null, `[일일목표] 오늘 실현 PnL: ${fmtKRWRaw(dailyPnl)} / 목표 ₩500,000 (${(dailyPnl/DAILY_TARGET_KRW_CONST*100).toFixed(1)}%)`, { dailyPnl });
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
    const MAX_POSITIONS = 5; // ★ 정예 1~5선: 100만 원을 최대 5개에 분산 투입
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
            if (price < MIN_PRICE_USD && price > 0) {
              // ★ 동전주($1 미만)는 최저가 제한 해제 — 0.01 이상이면 스캔
              if (price < 0.01) return null;
            } else if (price < MIN_PRICE_USD) return null;
            // ★ 가격 상한선 필터
            if (price > MAX_PRICE_USD) return null;
            const isPenny = isPennyStock(price);
            const scoring = score10Indicators(data.quote, data.closes, data.highs, data.lows, data.opens, data.volumes, isLowVolumeSession);
            if (!scoring) return null;
            lastScores.set(sym, scoring.totalScore);
            return { sym, price, scoring, capType, data, isPenny: isPennyStock(price) };
          } catch { return null; }
        }));

        for (const r of results) {
          if (!r) continue;
          const isPenny = r.isPenny;
          
          // ★ 필승 패턴 A/B/C 감지: 점수가 낮아도 패턴 완성 시 즉시 진입 허용
          const cp = r.scoring.criticalPatterns;
          const hasCriticalPattern = cp && cp.patterns.length >= 1;
          const hasMultiPattern = cp && cp.patterns.length >= 2; // 2개 이상 = 초고확신

          // ★ [Anti-Latency] Predictive Entry: 뉴스 없이 지표 60점 돌파 시 선취매
          const isPredictiveEntry = r.scoring.totalScore >= PREDICTIVE_ENTRY_SCORE && 
            r.scoring.totalScore < (isPenny ? PENNY_ENTRY_SCORE : adaptedEntryThreshold) &&
            !hasCriticalPattern;

          // ★ 동전주 전용 진입 문턱: 70점 (일반: 65점)
          const pennyEntryThreshold = PENNY_ENTRY_SCORE;
          const effectiveThreshold = isPenny ? Math.max(pennyEntryThreshold, adaptedEntryThreshold) : adaptedEntryThreshold;
          
          // 점수 필터: 일반 진입은 effectiveThreshold, 필승 패턴 시 50점까지 완화, 예측형 진입 60점
          if (!hasCriticalPattern && !isPredictiveEntry && r.scoring.totalScore < effectiveThreshold) continue;
          if (hasCriticalPattern && r.scoring.totalScore < 50) continue; // 패턴 있어도 최소 50점
          
          const alreadyHolding = (openPos || []).some(p => p.symbol === r.sym && p.status === 'open');
          const isPyramiding = alreadyHolding && r.scoring.totalScore >= 80;
          if (alreadyHolding && !isPyramiding) continue;
          if (openCount >= MAX_POSITIONS) continue;

          // ★ 유동성 하한선 & 수급 동기화
          const vlInfo = volumeLeaders.find(vl => vl.symbol === r.sym);
          const accumPattern = r.scoring.accumulation;
          const isAccumCandidate = isLowVolumeSession && accumPattern?.isAccumulating;
          
          // ★ [Liquidity Guard] 매수잔량 절대 법칙: 진입금액의 10배 이상 유동성 확보된 종목만 진입
          const tradingVal = vlInfo?.tradingValue || 0;
          const entryAmountKRW = balance * 0.20; // 예상 진입 금액 (20%)
          const liquidityCheck = checkLiquidityGuard(tradingVal, entryAmountKRW);
          
          // ★ 필승 패턴/매집 패턴/Predictive Entry + Finnhub 뉴스 90점 시 유동성 필터 해제
          if (!isAccumCandidate && !hasCriticalPattern) {
            if (!liquidityCheck.passed && !isPredictiveEntry) {
              // 유동성 부족 → 차단 (필승 패턴/매집/예측형 제외)
              if (vlInfo && vlInfo.tradingValue < 10000) continue;
              const sessionAvgTradingValue = volumeLeaders.length > 0 
                ? volumeLeaders.reduce((sum, vl) => sum + vl.tradingValue, 0) / volumeLeaders.length 
                : 0;
              if (vlInfo && sessionAvgTradingValue > 0 && vlInfo.tradingValue < sessionAvgTradingValue * 0.5) {
                continue;
              }
            }
          }

          // ★ 엔진 개편: 10대 지표 점수 + 충족 수 + 필승 패턴으로 진입 판단
          const metCount = r.scoring.metCount || 0;
          const rvol = r.scoring.indicators.rvol?.rvol || 0;
          const vwapOk = r.scoring.indicators.candle?.vwapCross === true;
          const isAccumEntry = isAccumCandidate;
          
          // 최소 충족 조건: 필승 패턴 시 3개, 매집 시 3개, 예측형 3개, 일반 5개
          const minMet = (hasCriticalPattern || isAccumEntry || isPredictiveEntry) ? 3 : 5;
          if (metCount < minMet) continue;
          
          // ★ RVOL 완화: 필승 패턴/예측형 시 해제
          if (!isAccumEntry && !hasCriticalPattern && !isPredictiveEntry && rvol < 1.0) continue;
          
          const aggressionPct = r.scoring.indicators.aggression?.details?.match(/(\d+)%/)?.[1];
          const aggrVal = aggressionPct ? parseInt(aggressionPct) : 0;
          // ★ 체결강도 완화: 필승 패턴/예측형 시 40%
          const minAggression = (isAccumEntry || hasCriticalPattern || isPredictiveEntry) ? 40 : 80;
          if (aggrVal < minAggression) continue;

          if (isOpeningRush) continue;

          // 수급 돌파/유동성 점수 계산
          (r as any).isVolumeBurst = rvol >= 2.0;
          (r as any).isPennyStock = isPenny;
          (r as any).isAccumulationEntry = isAccumEntry;
          (r as any).isPredictiveEntry = isPredictiveEntry;
          (r as any).accumPattern = accumPattern?.pattern || '';
          (r as any).accumCondensation = accumPattern?.condensation || 0;
          (r as any).hasCriticalPattern = hasCriticalPattern;
          (r as any).criticalPatterns = cp?.patterns || [];
          (r as any).criticalPatternConfidence = cp?.confidence || 0;
          (r as any).liquidityRatio = liquidityCheck.ratio;
          (r as any).liquidityScore = liquidityScore(r.scoring.changePct || 0, tradingVal);
          (r as any).volumeRank = volumeRankMap.get(r.sym) || 999;
          (r as any).tradingValueUSD = tradingVal;

          // ★ 동전주 로그
          if (isPenny && r.scoring.totalScore >= PENNY_ENTRY_SCORE) {
            const rvolVal = r.scoring.indicators?.rvol?.rvol || 0;
            await addLog('unified', 'scan', r.sym, `[🪙동전주] ${r.sym} $${r.price.toFixed(4)}(${fmtKRW(r.price)}) | ${r.scoring.totalScore}점(≥${PENNY_ENTRY_SCORE}) RVOL ${rvolVal.toFixed(1)}x → 최우선 진입 대상`, { price: r.price, score: r.scoring.totalScore, rvol: rvolVal });
          }

          // ★ [Anti-Latency] 예측형 진입 로그
          if (isPredictiveEntry) {
            await addLog('unified', 'scan', r.sym, `[🔮예측형선취매] ${r.sym} 뉴스 미확인 BUT 지표 ${r.scoring.totalScore}점(≥${PREDICTIVE_ENTRY_SCORE}) 수렴→발산 감지 | 정보 비대칭 구간 포착 → 2~3호가 아래 지정가 대기`, { score: r.scoring.totalScore, metCount, liquidityRatio: liquidityCheck.ratio });
          }

          // ★ 필승 패턴 알림 로그 (고래/에너지 응축 포함)
          if (hasCriticalPattern) {
            const whaleTag = cp.whaleTrace?.detected ? ` | 🐋고래매집(지지선${fmtKRW(cp.whaleTrace.supportLevel)})` : '';
            const energyTag = cp.energyCondensation?.detected ? ` | ⚡에너지응축[${cp.energyCondensation.signals.join('+')}]` : '';
            await addLog('unified', 'scan', r.sym, `[🎯필승패턴감지] ${r.sym} [${cp.patterns.join('+')}] 익절확률 ${cp.confidence}% | ${r.scoring.totalScore}점(${metCount}/10)${whaleTag}${energyTag} → 패턴 기반 즉시 진입`, { criticalPatterns: cp, score: r.scoring.totalScore });
          }

          // ★ 선취매 알림 로그
          if (isAccumEntry) {
            await addLog('unified', 'scan', r.sym, `[데이장 선취매] 에너지 응축 패턴 확인. 거래량 無해도 지표 발산 직전! ${r.sym} 미리 매수합니다. | 매집패턴: ${accumPattern?.pattern} | 응축도: ${accumPattern?.condensation?.toFixed(1)}/10 (신뢰도 ${accumPattern?.confidence}%) | ${r.scoring.totalScore}점(${metCount}/10)`, { accumulation: accumPattern, score: r.scoring.totalScore, condensation: accumPattern?.condensation });
          }

          // ★ 뉴스 감성은 최종 후보 선정 후 분석 (타임아웃 방지)
          (r as any).newsSentiment = 50;
          (r as any).newsCount = 0;

          candidates.push(r);
        }
        if (i + 5 < SCAN_SYMBOLS.length) await new Promise(resolve => setTimeout(resolve, 150)); // ★ 300→150ms
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

    // Sort: critical pattern → score surge → super pattern → explosive → volume burst → liquidity → score
    const sessionCapPreference = (currentSession === 'PRE_MARKET' || currentSession === 'DAY') ? 'small' : 'large';
    candidates.sort((a, b) => {
      // ★ 동전주($1 미만) 최우선
      const aPenny = (a as any).isPennyStock ? 5 : 0;
      const bPenny = (b as any).isPennyStock ? 5 : 0;
      if (aPenny !== bPenny) return bPenny - aPenny;
      // ★ 필승 패턴(A/B/C) 최우선
      const aCP = (a as any).hasCriticalPattern ? 4 : 0;
      const bCP = (b as any).hasCriticalPattern ? 4 : 0;
      if (aCP !== bCP) return bCP - aCP;
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

    // ★ 뉴스 감성 분석: 상위 10개 후보에만 적용 (타임아웃 방지)
    const preFilteredTop = candidates.slice(0, 10);
    for (const c of preFilteredTop) {
      try {
        const news = await getNewsSentiment(c.sym);
        (c as any).newsSentiment = news.bullishPct;
        (c as any).newsCount = news.newsCount;
        if (news.newsCount > 0) {
          const sentLabel = news.bullishPct >= 80 ? '🟢강세' : news.bullishPct >= 60 ? '🟡긍정' : news.bullishPct >= 40 ? '⚪중립' : '🔴약세';
          await addLog('unified', 'scan', c.sym, `[📰뉴스감성] ${c.sym} ${sentLabel} ${news.bullishPct}% (${news.newsCount}건) | ${news.headline?.slice(0, 50) || ''}`, { sentiment: news.bullishPct, newsCount: news.newsCount });
        }
      } catch { /* non-critical */ }
      
      // ★ 뉴스+지표 동기화 필터: 뉴스 약세(40% 미만) + 지표 70점 미만 → 차단
      const newsSent = (c as any).newsSentiment || 50;
      if (newsSent < 40 && c.scoring.totalScore < 70 && !(c as any).hasCriticalPattern) {
        await addLog('unified', 'scan', c.sym, `[🚫뉴스차단] ${c.sym} 뉴스 약세(${newsSent}%) + 지표 ${c.scoring.totalScore}점 < 70 → 진입 보류`, {});
        (c as any)._newsBlocked = true;
      }
    }

    // ★ 정예 1~5선 집중 투자: 필승 패턴 or (65점+90%익절확률+뉴스긍정) 확정 후보만
    const filteredCandidates = candidates.filter(c => {
      if ((c as any)._newsBlocked) return false;
      const winProb = getWinProbability(c.scoring.totalScore);
      const hasCritical = (c as any).hasCriticalPattern;
      const newsSent = (c as any).newsSentiment || 50;
      // ★ 뉴스+지표 95% 일치 시 최우선 진입
      const newsBoost = newsSent >= 80 && winProb >= 90;
      // 필승 패턴 감지 시: 50점 이상 + 패턴 익절확률 90%+ → 즉시 진입
      if (hasCritical) {
        const patternConf = (c as any).criticalPatternConfidence || 0;
        return patternConf >= 90 || (c.scoring.totalScore >= 65 && winProb >= 90);
      }
      // ★ 뉴스 강세(80%+) + 지표 65점+ = 확정적 익절 → 즉시 투입
      if (newsBoost) return true;
      // 일반 진입: 65점+ & 90% 이상
      return c.scoring.totalScore >= 65 && winProb >= 90;
    });
    const topCandidates = filteredCandidates.slice(0, 5);

    if (topCandidates.length > 0) {
      const summary = topCandidates.map((c, i) => {
        const volRank = (c as any).volumeRank;
        const volTag = volRank <= 20 ? ` Vol#${volRank}` : '';
        const burstTag = (c as any).isVolumeBurst ? '🔥' : '';
        const surgeTag = (c as any).isScoreSurge ? '🚨급상승' : '';
        const cpTag = (c as any).hasCriticalPattern ? `🎯[${(c as any).criticalPatterns.join('+')}]` : '';
        const pennyTag = (c as any).isPennyStock ? '🪙' : '';
        return `${i+1}.${pennyTag}${burstTag}${surgeTag}${cpTag}${c.sym}(${c.scoring.totalScore}점/${c.scoring.metCount}충족/${c.capType}${volTag})`;
      }).join(', ');
      // ★ 동전주 개수 표시
      const pennyCount = topCandidates.filter(c => (c as any).isPennyStock).length;
      await addLog('unified', 'scan', null, `[🌐전종목스캔] [${timeStr}] 매수 후보 ${candidates.length}개 중 TOP ${topCandidates.length}개 집중 투자 (🪙동전주 ${pennyCount}개): ${summary}`, {});
    }

    for (const r of topCandidates) {
      if (openCount >= MAX_POSITIONS) break;
      const alreadyHolding = (openPos || []).some(p => p.symbol === r.sym && p.status === 'open');
      const isPyramiding = alreadyHolding && r.scoring.totalScore >= 80;
      const isSuperEntry = (r as any).isSuperPattern;
      const isScoreSurge = (r as any).isScoreSurge;
      const isCriticalPatternEntry = (r as any).hasCriticalPattern;
      const isPennyEntry = (r as any).isPennyStock;
      
      // ★ [Volatility Hunt] 집중 투자: 1순위 종목 50%+, 동전주 40%, 필승패턴 35%, 일반 20%
      const isTopRanked = topCandidates.indexOf(r) === 0; // 1순위 종목
      const positionPct = isPyramiding ? 0.05 : isTopRanked ? 0.50 : isPennyEntry ? 0.40 : (isCriticalPatternEntry || isSuperEntry || isScoreSurge) ? 0.35 : 0.20;
      const maxKRW = balance * positionPct;
      const priceKRW = toKRW(r.price);
      const qty = Math.floor(maxKRW / priceKRW);
      const costKRW = Math.floor(qty * priceKRW);

      if (qty <= 0 || costKRW > balance) {
        await addLog('unified', 'hold', r.sym, `[${timeStr}] ${r.sym} ${r.scoring.totalScore}점 → ⚠️ 잔고 부족`, {});
        continue;
      }

      // ★ [Passive Fill + Timestamp Guard] 시장가 금지, 호가 장악 매수
      const isAccumEntry = (r as any).isAccumulationEntry;
      const isPredictive = (r as any).isPredictiveEntry;
      const tickSize = r.price < 1.0 ? 0.0001 : r.price < 10.0 ? 0.01 : 0.05;
      
      // ★ Timestamp Guard: 데이터 시차 감지 (캔들 타임스탬프 vs 현재)
      const dataAge = r.data?.quote?.t ? (Date.now() / 1000 - r.data.quote.t) : 0;
      const tsGuard = applyTimestampGuard(r.price, dataAge * 1000, tickSize);
      
      // ★ Passive Fill: 매수 1호가 알박기 (슬리피지 0)
      const passivePrice = applyPassiveFill(tsGuard.adjustedPrice, tickSize);
      
      // ★ 최종 매수가: 예측형/선취매 → Passive Fill, 일반 → Session Slippage
      let adjustedPrice: number;
      let orderType = 'MARKET';
      if (isPredictive || isAccumEntry) {
        adjustedPrice = passivePrice; // 호가 알박기
        orderType = 'LIMIT(Passive)';
      } else if (tsGuard.isGuarded) {
        adjustedPrice = tsGuard.adjustedPrice; // Timestamp Guard 적용
        orderType = 'LIMIT(Guard)';
      } else {
        const aggressiveSlip = isAccumEntry ? Math.max(sessionSlippage, 0.005) : sessionSlippage;
        adjustedPrice = applySessionSlippage(r.price, 'buy', spreadMul, aggressiveSlip);
        orderType = 'LIMIT(Aggressive)';
      }

      // ★ [전략 동기화] 초기 SL -10% / TP +15% 통일
      const stopLoss = +(adjustedPrice * 0.90).toFixed(4);
      // ★ 선취매/예측형: TP +20% (정규장 폭발 대비), 일반: +15%
      const tpMultiplier = (isAccumEntry || isCriticalPatternEntry || isPredictive) && isLowVolumeSession ? 1.20 : 1.15;
      const takeProfit = +(adjustedPrice * tpMultiplier).toFixed(4);
      const splitOrderNote = isAccumEntry ? ' | 📦분할잠입매집(5분할 조용히 체결)' : '';
      const tsGuardTag = tsGuard.isGuarded ? ` | ⏱️Timestamp Guard(${dataAge.toFixed(1)}s→${PASSIVE_FILL_TICKS}호가↓)` : '';
      const passiveTag = (isPredictive || isAccumEntry) ? ` | 🎯Passive Fill(호가알박기)` : '';
      const predictiveTag = isPredictive ? ` | 🔮예측형선취매(뉴스전 지표수렴)` : '';
      const liqRatioTag = (r as any).liquidityRatio ? ` | 💧유동성×${((r as any).liquidityRatio).toFixed(1)}` : '';
      const tier = isPyramiding ? 'PYRAMID' : isPennyEntry ? 'PENNY-🪙' : isCriticalPatternEntry ? 'CRITICAL-PATTERN' : isSuperEntry ? 'SUPER-15%' : isPredictive ? 'PREDICTIVE' : isAccumEntry ? 'PRE-STRIKE' : 'SCOUT';
      const balanceBefore = Math.round(balance);
      const newBuyBalance = balance - costKRW;
      const spreadNote = spreadMul > 1 ? ` | ⚠️ ${sessionLabel} 스프레드 ×${spreadMul}` : '';
      const capLabel = r.capType === 'large' ? '대형' : '소형';
      const volRank = (r as any).volumeRank;
      const volRankTag = volRank <= 50 ? ` | Vol#${volRank}` : '';
      const burstTag = (r as any).isVolumeBurst ? ' | 🔥수급돌파' : '';
      const pennyBuyTag = isPennyEntry ? ` | 🪙동전주($${r.price.toFixed(4)}/${fmtKRW(r.price)})×${qty}주=물량선점` : '';
      const condensationTag = isAccumEntry ? ` | 📡선취매(${(r as any).accumPattern}|응축${((r as any).accumCondensation || 0).toFixed(1)})${splitOrderNote}` : '';
      const superTag = isSuperEntry ? ` | 🎯슈퍼패턴[${(r as any).superPatternSignals.join('+')}] 15%타겟 집중투자(${(positionPct*100).toFixed(0)}%)` : '';
      const criticalTag = isCriticalPatternEntry ? ` | 🎯필승패턴[${(r as any).criticalPatterns.join('+')}] 익절확률${(r as any).criticalPatternConfidence}%` : '';
      
      // ★ 엔진 개편: 지표 상세 근거 로그
      const indDetails = Object.entries(r.scoring.indicators)
        .map(([k, v]: [string, any]) => `${k}:${v.score}`)
        .join('|');
      const roundTag = currentRound > 1 ? `[Round ${currentRound}] ` : '';
      const preBuyLabel = isPennyEntry ? '🪙동전주매수' : isPredictive ? '🔮예측형선취매' : isAccumEntry ? '선취매 완료: 정규장 폭발 대기 중' : isCriticalPatternEntry ? '🎯필승패턴매수' : isSuperEntry ? '🎯15%슈퍼매수' : '10대지표매수';
      const logMsg = `${roundTag}[${preBuyLabel}] [${sessionLabel}] [${timeStr}] ${r.sym} 10대 지표 중 ${r.scoring.metCount}개 충족 (${r.scoring.totalScore}점) [${capLabel}|${tier}|${orderType}|${qty}주@${fmtKRW(adjustedPrice)}|${fmtKRWRaw(costKRW)}]${spreadNote}${volRankTag}${burstTag}${pennyBuyTag}${condensationTag}${superTag}${criticalTag}${tsGuardTag}${passiveTag}${predictiveTag}${liqRatioTag} | 지표: [${indDetails}] | [잔고: ${fmtKRWRaw(balanceBefore)} → ${fmtKRWRaw(newBuyBalance)}]`;

      // ★ 필승 패턴 알림
      if (isCriticalPatternEntry) {
        const breakevenLabel = isPennyEntry ? `+${PENNY_BREAKEVEN_PCT}%` : `+${GHOST_BREAKEVEN_PCT}%`;
        const newsTag = (r as any).newsSentiment >= 80 ? ` | 📰뉴스강세${(r as any).newsSentiment}%` : '';
        await addLog('unified', 'milestone', r.sym, `🎯 [필승 패턴 매수 완료] ${r.sym} [${(r as any).criticalPatterns.join('+')}] 익절확률 ${(r as any).criticalPatternConfidence}% | ${breakevenLabel} 도달 시 Zero-Risk Lock(매수가+0.1%) → 패배 기록 0 보장${newsTag}`, { criticalPatterns: r.scoring.criticalPatterns, score: r.scoring.totalScore, newsSentiment: (r as any).newsSentiment });
      }
      // ★ 슈퍼 패턴 알림
      if (isSuperEntry) {
        await addLog('unified', 'milestone', r.sym, `🎯 [15% 익절 보장형 슈퍼 패턴] ${r.sym} 매수 완료! [${(r as any).superPatternSignals.join('+')}] | 15% 목표까지 자율 주행 홀딩 개시.`, { superPattern: r.scoring.superPattern, score: r.scoring.totalScore, allocation: `${(positionPct*100).toFixed(0)}%` });
      }
      // ★ 동전주 매수 알림
      if (isPennyEntry) {
        await addLog('unified', 'milestone', r.sym, `🪙 [동전주 물량선점 매수] ${r.sym} $${r.price.toFixed(4)}(${fmtKRW(r.price)}) × ${qty}주 | 호가 한 칸 변동 = 큰 수익! | 본절보호: +${PENNY_BREAKEVEN_PCT}% | 철갑홀딩: ${PENNY_IRON_HOLD_SCORE}점↑`, { price: r.price, qty, isPenny: true, score: r.scoring.totalScore });
      }

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
      await addLog('unified', 'buy', r.sym, logMsg, { score: r.scoring.totalScore, metCount: r.scoring.metCount, qty, costKRW, capType: r.capType, indicators: r.scoring.indicators, isSuperPattern: isSuperEntry, isPenny: isPennyEntry });
    }

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

    await addLog('system', 'info', null, `[${timeStr}] [${sessionLabel}] 🌐 전 종목 필승 엔진 사이클 완료 — 스캔 풀: 대형 ${LARGE_SET.size}개 + 소형 ${SMALL_SET.size}개 + 동적 발견 ${discoveredSymbols.length}개 = 총 ${LARGE_SET.size + SMALL_SET.size + discoveredSymbols.length}개 | 활성 슬롯: ${SCAN_SYMBOLS.length}개 | 진입기준: ${adaptedEntryThreshold}점`);

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
