/**
 * 정밀 기술적 지표 연산 라이브러리
 * - TradingView 스크리너와 값이 어긋나지 않도록 최소 300봉 이상의 데이터로 계산
 * - EMA: SMA 시드 후 재귀 평활화 (TV 표준)
 * - Ichimoku: 기본 파라미터 (9, 26, 52, 26)
 */

export interface Candle {
  time: number;   // unix sec
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

/**
 * EMA — TradingView 표준 (첫 period 봉은 SMA로 시드)
 */
export function calcEMA(values: number[], period: number): number[] {
  const out: number[] = new Array(values.length).fill(NaN);
  if (values.length < period) return out;

  const k = 2 / (period + 1);
  // seed = SMA(period)
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

/**
 * Donchian 중심선 (high+low)/2 over `period`
 */
function midPrice(highs: number[], lows: number[], period: number, endIdx: number): number {
  if (endIdx + 1 < period) return NaN;
  let hh = -Infinity, ll = Infinity;
  for (let i = endIdx - period + 1; i <= endIdx; i++) {
    if (highs[i] > hh) hh = highs[i];
    if (lows[i] < ll) ll = lows[i];
  }
  return (hh + ll) / 2;
}

export interface IchimokuSnapshot {
  tenkan: number;         // 전환선 (9)
  kijun: number;          // 기준선 (26)
  spanA: number;          // 현재 시점의 선행스팬 A (26봉 전에 계산되어 현재로 투영된 값)
  spanB: number;          // 현재 시점의 선행스팬 B
  spanAFuture: number;    // 현재 캔들 기준으로 26봉 앞에 그려질 선행스팬 A
  spanBFuture: number;    // 현재 캔들 기준으로 26봉 앞에 그려질 선행스팬 B
  chikou: number;         // 후행스팬 (현재 close, 26봉 뒤에 표시)
}

/**
 * Ichimoku 일목균형표 (9, 26, 52, 26)
 *
 * 주의: 선행스팬은 "26봉 미래"로 plot 되므로,
 * 현재 캔들 위에 표시되는 구름은 (current_index - 26) 시점에 계산된 값이다.
 */
export function calcIchimoku(
  candles: Candle[],
  tenkanPeriod = 9,
  kijunPeriod = 26,
  spanBPeriod = 52,
  displacement = 26,
): IchimokuSnapshot | null {
  const n = candles.length;
  if (n < spanBPeriod + displacement) return null;

  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const last = n - 1;

  // 현재 캔들 기준 미래에 그려질 스팬
  const tenkanNow = midPrice(highs, lows, tenkanPeriod, last);
  const kijunNow = midPrice(highs, lows, kijunPeriod, last);
  const spanAFuture = (tenkanNow + kijunNow) / 2;
  const spanBFuture = midPrice(highs, lows, spanBPeriod, last);

  // 현재 위치에 표시되는 구름 = displacement 봉 전 시점에서 계산된 값
  const pastIdx = last - displacement;
  const tenkanPast = midPrice(highs, lows, tenkanPeriod, pastIdx);
  const kijunPast = midPrice(highs, lows, kijunPeriod, pastIdx);
  const spanA = (tenkanPast + kijunPast) / 2;
  const spanB = midPrice(highs, lows, spanBPeriod, pastIdx);

  const chikou = candles[last].close;

  return {
    tenkan: tenkanNow,
    kijun: kijunNow,
    spanA,
    spanB,
    spanAFuture,
    spanBFuture,
    chikou,
  };
}

export interface SignalContext {
  symbol: string;
  lastClose: number;
  lastOpen: number;
  ema200: number;
  ichimoku: IchimokuSnapshot;
  /** 양운 + 현재가가 구름 위 + Open > EMA200 */
  bullish: boolean;
  /** 실패 시 사유 */
  reason: string;
}

/**
 * 1분봉 마감 시점 매수 시그널 평가
 *  1) Open > EMA200
 *  2) spanA > spanB (양운)
 *  3) close > spanA && close > spanB (구름 상단 완전 돌파)
 *
 * 정확도를 위해 최소 300봉을 권장한다.
 */
export function evaluateBuySignal(symbol: string, candles: Candle[]): SignalContext | null {
  if (candles.length < 300) return null;

  const closes = candles.map(c => c.close);
  const emaArr = calcEMA(closes, 200);
  const last = candles.length - 1;
  const ema200 = emaArr[last];
  const ichi = calcIchimoku(candles);
  if (!ichi || !Number.isFinite(ema200)) return null;

  const lastCandle = candles[last];
  const openAboveEma = lastCandle.open > ema200;
  const bullishCloud = ichi.spanA > ichi.spanB;
  const aboveCloud = lastCandle.close > ichi.spanA && lastCandle.close > ichi.spanB;
  const bullish = openAboveEma && bullishCloud && aboveCloud;

  let reason = "✅ 매수 시그널";
  if (!openAboveEma) reason = `Open(${lastCandle.open.toFixed(4)}) ≤ EMA200(${ema200.toFixed(4)})`;
  else if (!bullishCloud) reason = `음운 (spanA ${ichi.spanA.toFixed(4)} ≤ spanB ${ichi.spanB.toFixed(4)})`;
  else if (!aboveCloud) reason = `구름 미돌파 (close ${lastCandle.close.toFixed(4)} vs A/B ${ichi.spanA.toFixed(4)}/${ichi.spanB.toFixed(4)})`;

  return {
    symbol,
    lastClose: lastCandle.close,
    lastOpen: lastCandle.open,
    ema200,
    ichimoku: ichi,
    bullish,
    reason,
  };
}

/** 매수/익절 가격 계산 */
export function buildOrderPlan(currentPrice: number) {
  const limitBuyPrice = +(currentPrice * 0.9905).toFixed(4); // 현재가 -0.95% (1% 미만 아래)
  const takeProfitPrice = +(limitBuyPrice * 1.015).toFixed(4); // 체결가 +1.5%
  return { limitBuyPrice, takeProfitPrice };
}
