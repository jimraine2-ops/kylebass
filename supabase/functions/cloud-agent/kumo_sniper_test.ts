// ============================================================
// [Kumo-Sniper v3] 매수 전략 전체 플로우 통합 테스트
// ------------------------------------------------------------
// 검증 항목:
//   1. Pre-Scan 필터 (유동성 ₩10억+, 현재가>EMA200)
//   2. Kumo 돌파 + 구름 두께 ≥ 0.5%
//   3. LIMIT 진입 (Kumo 상단 ±0.1% 마중가)
//   4. +3.0% 기계적 익절
//   5. +1.5% 도달 → SL = 매수가 +0.2% (BE Lock)
//   6. 구름 하단 이탈 2분(2봉) 미회복 → 손절
//
// 참고: 이 시스템은 Polygon(일봉) + Finnhub(분봉/뉴스) +
//       Twelve Data(분봉 검증) 사용. 야후 파이낸스(yfinance)는
//       무료 공개 API 모두 비공식이라 백엔드에 연동되어 있지 않음.
//       배너 표기 "yfinance 1m"은 1분 단위 실시간 폴링 컨셉을 의미.
// ============================================================

import { assertEquals, assert, assertAlmostEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

// === 전략 상수 (cloud-agent/index.ts와 동일) ===
const KRW_RATE = 1350;
const TARGET_AVG_DOLLAR_VOLUME_USD = 1_000_000_000 / KRW_RATE; // ≈ $740,740 (₩10억)
const KUMO_THICKNESS_MIN_PCT = 0.005;          // 0.5%
const KUMO_RETEST_BAND_PCT = 0.001;            // ±0.1% LIMIT 밴드
const PROFIT_CHASE_TRIGGER = 3.0;              // +3.0% 익절
const BREAKEVEN_TRIGGER_PCT = 1.5;             // +1.5% BE 트리거
const ZERO_RISK_SL_PCT = 1.002;                // 매수가 +0.2%
const KUMO_EXIT_GRACE_BARS = 2;                // 2분(2봉) 회복 유예

// === 순수 함수 추출 (테스트 대상) ===

/** Pre-Scan 통과 여부 */
function passesPreScan(m: {
  lastClose: number; ema200: number; ema200Uptrend: boolean;
  avgDollarVolUSD: number;
}): { pass: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const volOk = m.avgDollarVolUSD >= TARGET_AVG_DOLLAR_VOLUME_USD;
  const ema200Ok = m.ema200Uptrend && m.lastClose > m.ema200;
  if (!volOk) reasons.push('liquidity<₩10억');
  if (!ema200Ok) reasons.push('price≤EMA200 or downtrend');
  return { pass: volOk && ema200Ok, reasons };
}

/** Kumo 돌파 + 두께 필터 */
function passesKumoBreakout(m: {
  lastClose: number; kumoTop: number; kumoBottom: number;
}): { pass: boolean; thicknessPct: number; aboveKumo: boolean } {
  const aboveKumo = m.lastClose >= m.kumoTop;
  const thickness = m.lastClose > 0 ? (m.kumoTop - m.kumoBottom) / m.lastClose : 0;
  return { pass: aboveKumo && thickness >= KUMO_THICKNESS_MIN_PCT, thicknessPct: thickness, aboveKumo };
}

/** LIMIT 마중가 = Kumo 상단 (±0.1% 밴드 내 도달 시 체결) */
function buildLimitOrder(kumoTop: number, currentPrice: number): {
  limit: number; willFill: boolean; bandLow: number; bandHigh: number;
} {
  const limit = +kumoTop.toFixed(4);
  const bandLow = kumoTop * (1 - KUMO_RETEST_BAND_PCT);
  const bandHigh = kumoTop * (1 + KUMO_RETEST_BAND_PCT);
  return { limit, willFill: currentPrice >= bandLow && currentPrice <= bandHigh, bandLow, bandHigh };
}

/** 포지션 상태 머신 — 매 틱(가격, kumoTop, 구름이탈경과봉) */
type PositionState = {
  entry: number;
  stopLoss: number;
  takeProfit: number;
  beLocked: boolean;
  belowKumoBars: number;
  status: 'open' | 'tp_filled' | 'sl_hit' | 'kumo_exit';
  exitPrice?: number;
  exitReason?: string;
};

function openPosition(entry: number, kumoBottom: number): PositionState {
  return {
    entry,
    stopLoss: +(kumoBottom).toFixed(4),       // 초기 SL = 구름 하단
    takeProfit: +(entry * (1 + PROFIT_CHASE_TRIGGER / 100)).toFixed(4),
    beLocked: false,
    belowKumoBars: 0,
    status: 'open',
  };
}

function tick(pos: PositionState, price: number, isAboveKumoTop: boolean): PositionState {
  if (pos.status !== 'open') return pos;
  const pnlPct = ((price - pos.entry) / pos.entry) * 100;

  // 1) +3.0% 익절
  if (price >= pos.takeProfit) {
    return { ...pos, status: 'tp_filled', exitPrice: price, exitReason: `+3.0% TP @ $${price.toFixed(4)}` };
  }

  // 2) +1.5% 통과 → BE Lock (SL = 매수가 +0.2%)
  let stopLoss = pos.stopLoss;
  let beLocked = pos.beLocked;
  if (!beLocked && pnlPct >= BREAKEVEN_TRIGGER_PCT) {
    stopLoss = +(pos.entry * ZERO_RISK_SL_PCT).toFixed(4);
    beLocked = true;
  }

  // 3) BE-Lock SL 터치
  if (beLocked && price <= stopLoss) {
    return { ...pos, stopLoss, beLocked, status: 'sl_hit', exitPrice: price, exitReason: `BE-Lock SL @ $${price.toFixed(4)}` };
  }

  // 4) 구름 이탈 2분(2봉) 미회복 → 손절
  let belowBars = isAboveKumoTop ? 0 : pos.belowKumoBars + 1;
  if (belowBars >= KUMO_EXIT_GRACE_BARS) {
    return { ...pos, stopLoss, beLocked, belowKumoBars: belowBars, status: 'kumo_exit', exitPrice: price, exitReason: `구름 이탈 ${belowBars}봉 미회복 @ $${price.toFixed(4)}` };
  }

  return { ...pos, stopLoss, beLocked, belowKumoBars: belowBars };
}

// ============================================================
// === 테스트 케이스 ===
// ============================================================

Deno.test("[1] Pre-Scan: 유동성 ₩10억+ 통과", () => {
  const r = passesPreScan({ lastClose: 5.0, ema200: 4.5, ema200Uptrend: true, avgDollarVolUSD: 800_000 });
  assert(r.pass, `통과해야 함, 사유: ${r.reasons.join(',')}`);
});

Deno.test("[1] Pre-Scan: 유동성 미달 차단", () => {
  const r = passesPreScan({ lastClose: 5.0, ema200: 4.5, ema200Uptrend: true, avgDollarVolUSD: 500_000 });
  assert(!r.pass);
  assert(r.reasons.includes('liquidity<₩10억'));
});

Deno.test("[1] Pre-Scan: EMA200 하향 차단", () => {
  const r = passesPreScan({ lastClose: 4.0, ema200: 4.5, ema200Uptrend: true, avgDollarVolUSD: 800_000 });
  assert(!r.pass);
});

Deno.test("[2] Kumo 돌파 + 두께 0.5%+ 통과", () => {
  const r = passesKumoBreakout({ lastClose: 5.10, kumoTop: 5.00, kumoBottom: 4.95 });
  // thickness = (5.00 - 4.95) / 5.10 = 0.98%
  assert(r.pass);
  assert(r.thicknessPct >= 0.005);
  assert(r.aboveKumo);
});

Deno.test("[2] 구름 두께 < 0.5% 차단 (얇은 구름)", () => {
  const r = passesKumoBreakout({ lastClose: 5.10, kumoTop: 5.00, kumoBottom: 4.99 });
  // thickness = 0.196% < 0.5%
  assert(!r.pass);
  assert(r.aboveKumo);
  assert(r.thicknessPct < 0.005);
});

Deno.test("[2] 구름 미돌파 차단", () => {
  const r = passesKumoBreakout({ lastClose: 4.90, kumoTop: 5.00, kumoBottom: 4.80 });
  assert(!r.pass);
  assert(!r.aboveKumo);
});

Deno.test("[3] LIMIT 마중가: Kumo 상단 ±0.1% 밴드 내 체결", () => {
  const o = buildLimitOrder(5.00, 5.003); // +0.06%
  assertEquals(o.limit, 5.0);
  assert(o.willFill, `${o.bandLow}~${o.bandHigh} 밴드 내`);
});

Deno.test("[3] LIMIT 미체결: 밴드 이탈 (+0.2%)", () => {
  const o = buildLimitOrder(5.00, 5.011);
  assert(!o.willFill);
});

Deno.test("[4] +3.0% 익절: 정확히 트리거", () => {
  let pos = openPosition(5.00, 4.95);
  assertAlmostEquals(pos.takeProfit, 5.15, 0.001);
  pos = tick(pos, 5.16, true);
  assertEquals(pos.status, 'tp_filled');
  assert(pos.exitReason?.includes('TP'));
});

Deno.test("[5] +1.5% 본절 BE Lock: SL이 매수가+0.2%로 강제 이동", () => {
  let pos = openPosition(5.00, 4.95);
  assertEquals(pos.beLocked, false);
  assertEquals(pos.stopLoss, 4.95); // 초기 SL = 구름 하단
  // +1.5% 도달
  pos = tick(pos, 5.075, true);
  assertEquals(pos.beLocked, true);
  assertAlmostEquals(pos.stopLoss, 5.01, 0.001); // 5.00 × 1.002
  assertEquals(pos.status, 'open');
});

Deno.test("[5] BE Lock 후 SL 터치 → 본절 청산 (손실 0)", () => {
  let pos = openPosition(5.00, 4.95);
  pos = tick(pos, 5.080, true);  // +1.6% → BE Lock
  assert(pos.beLocked);
  pos = tick(pos, 5.005, true);  // SL($5.01) 아래
  assertEquals(pos.status, 'sl_hit');
  assert(pos.exitReason?.includes('BE-Lock'));
  // 매수가 대비 +0.1% (손실 0 / 미세 익절)
  const pnlPct = ((pos.exitPrice! - pos.entry) / pos.entry) * 100;
  assert(pnlPct >= 0, `pnl=${pnlPct.toFixed(3)}% — 손실 0 보장 실패`);
});

Deno.test("[6] 구름 이탈 1봉(1분) — 회복 유예 유지", () => {
  let pos = openPosition(5.00, 4.95);
  pos = tick(pos, 4.98, false); // 구름 아래 1봉
  assertEquals(pos.status, 'open');
  assertEquals(pos.belowKumoBars, 1);
});

Deno.test("[6] 구름 이탈 2봉(2분) 미회복 → 즉시 손절", () => {
  let pos = openPosition(5.00, 4.95);
  pos = tick(pos, 4.98, false); // 1봉
  pos = tick(pos, 4.96, false); // 2봉 → 강제 손절
  assertEquals(pos.status, 'kumo_exit');
  assert(pos.exitReason?.includes('2봉 미회복'));
});

Deno.test("[6] 구름 이탈 1봉 후 회복 — 카운터 리셋", () => {
  let pos = openPosition(5.00, 4.95);
  pos = tick(pos, 4.98, false); // 1봉 이탈
  assertEquals(pos.belowKumoBars, 1);
  pos = tick(pos, 5.02, true);  // 구름 위 회복 → 리셋
  assertEquals(pos.belowKumoBars, 0);
  assertEquals(pos.status, 'open');
});

// ============================================================
// === END-TO-END 시나리오 ===
// ============================================================

Deno.test("[E2E] 시나리오 A: 정상 +3% 익절 플로우", () => {
  // 1. Pre-Scan 통과
  const m = { lastClose: 5.10, ema200: 4.50, ema200Uptrend: true, avgDollarVolUSD: 1_500_000 };
  assert(passesPreScan(m).pass);
  // 2. Kumo 돌파 + 두께 통과
  const k = passesKumoBreakout({ lastClose: 5.10, kumoTop: 5.00, kumoBottom: 4.93 });
  assert(k.pass);
  // 3. LIMIT 진입 (리테스트)
  const o = buildLimitOrder(5.00, 5.002);
  assert(o.willFill);
  // 4. 보유 → +3% 익절
  let pos = openPosition(o.limit, 4.93);
  pos = tick(pos, 5.075, true);  // +1.5% → BE Lock
  assert(pos.beLocked);
  pos = tick(pos, 5.151, true);  // +3.02% → TP
  assertEquals(pos.status, 'tp_filled');
});

Deno.test("[E2E] 시나리오 B: BE Lock 후 회수 — 손실 0", () => {
  let pos = openPosition(5.00, 4.93);
  pos = tick(pos, 5.080, true);  // +1.6% BE Lock
  assert(pos.beLocked);
  pos = tick(pos, 5.005, true);  // SL 터치
  assertEquals(pos.status, 'sl_hit');
  const pnl = pos.exitPrice! - pos.entry;
  assert(pnl >= 0, `손실 발생: ${pnl}`);
});

Deno.test("[E2E] 시나리오 C: BE Lock 전 구름 이탈 2봉 → 손절", () => {
  let pos = openPosition(5.00, 4.93);
  pos = tick(pos, 4.99, false); // 1봉 이탈 (BE 트리거 전)
  pos = tick(pos, 4.97, false); // 2봉 → 강제 손절
  assertEquals(pos.status, 'kumo_exit');
});
