import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const FINNHUB_BASE = 'https://finnhub.io/api/v1';
const AI_GATEWAY = 'https://ai.gateway.lovable.dev/v1/chat/completions';
const KRW_RATE = 1350;
const MIN_PRICE_KRW = 1000;
const MIN_PRICE_USD = MIN_PRICE_KRW / KRW_RATE;

function toKRW(usd: number): number { return usd * KRW_RATE; }
function fmtKRW(usd: number): string { return `₩${toKRW(usd).toLocaleString('ko-KR', { maximumFractionDigits: 0 })}`; }
function fmtKRWRaw(krw: number): string { return `₩${krw.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}`; }

function getToken(): string { return Deno.env.get('FINNHUB_API_KEY') || ''; }

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

// ===== 10-Indicator Scoring =====
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
  const totalScore = sentimentScore + rvolScore + candleScore + atrScore + gapScore + squeezeScore + positionScore + sectorScore + aggrScore + preMarketScore;

  return {
    totalScore, trailingStop, rvol,
    indicators: {
      sentiment: { score: sentimentScore },
      rvol: { score: rvolScore, rvol },
      candle: { score: candleScore, vwapCross: closes[n] > vwap },
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

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

    // ========== PHASE 1: QUANT STRATEGY (Premium Stocks) ==========
    const QUANT_SYMBOLS = ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'GOOGL', 'AMZN', 'META', 'AMD', 'PLTR', 'COIN', 'SOFI', 'HOOD', 'RIVN', 'NIO', 'MARA'];

    const { data: mainWallet } = await supabase.from('ai_wallet').select('*').limit(1).single();
    const { data: scalpWallet } = await supabase.from('scalping_wallet').select('*').limit(1).single();
    if (!mainWallet) throw new Error('No main wallet');

    const { data: mainOpenPos } = await supabase.from('ai_trades').select('*').eq('status', 'open');
    const { data: scalpOpenPos } = await supabase.from('scalping_trades').select('*').eq('status', 'open');

    let mainBalance = mainWallet.balance;
    let scalpBalance = scalpWallet?.balance || 1000000;

    // ★ [자금 관리] 확정 잔고 = DB의 wallet.balance (매도 완료 시에만 갱신됨)
    // 매수 가능 금액(Buying Power) = 확정 잔고 그 자체 (평가액 불포함)
    const mainInitialBalance = mainWallet.initial_balance || mainBalance;
    const scalpInitialBalance = scalpWallet?.initial_balance || scalpBalance;

    // 자금 운용률 계산
    const mainInvested = (mainOpenPos || []).reduce((sum: number, p: any) => sum + Math.round(toKRW(p.price * p.quantity)), 0);
    const mainUtilization = mainInitialBalance > 0 ? ((mainInitialBalance - mainBalance) / mainInitialBalance) * 100 : 0;
    const scalpInvested = (scalpOpenPos || []).reduce((sum: number, p: any) => sum + Math.round(toKRW(p.price * p.quantity)), 0);
    const scalpUtilization = scalpInitialBalance > 0 ? ((scalpInitialBalance - scalpBalance) / scalpInitialBalance) * 100 : 0;

    await addLog('system', 'scan', null, `[${timeStr}] Cloud Agent 사이클 시작 — 대형주 ${QUANT_SYMBOLS.length}개 + 소형주 스캔 | [자금현황] 대형주 확정잔고: ${fmtKRWRaw(Math.round(mainBalance))} (운용률 ${mainUtilization.toFixed(1)}%) | 소형주 확정잔고: ${fmtKRWRaw(Math.round(scalpBalance))} (운용률 ${scalpUtilization.toFixed(1)}%)`);

    // ★ 자금 운용률 90% 이상 경고
    if (mainUtilization >= 90) {
      await addLog('quant', 'warning', null, `[자금경고] ⚠️ 대형주 자금 운용률 ${mainUtilization.toFixed(1)}% — 임계점 도달! 확정 잔고: ${fmtKRWRaw(Math.round(mainBalance))}`, { utilization: mainUtilization });
    }
    if (scalpUtilization >= 90) {
      await addLog('scalping', 'warning', null, `[자금경고] ⚠️ 소형주 자금 운용률 ${scalpUtilization.toFixed(1)}% — 임계점 도달! 확정 잔고: ${fmtKRWRaw(Math.round(scalpBalance))}`, { utilization: scalpUtilization });
    }

    // --- QUANT: Exit checks for all open positions ---
    const mainSymbolsToCheck = [...new Set((mainOpenPos || []).map((p: any) => p.symbol))];
    for (const sym of mainSymbolsToCheck) {
      const data = await getQuoteAndCandles(sym);
      if (!data) continue;
      const price = data.quote.c;
      const scoring = score10Indicators(data.quote, data.closes, data.highs, data.lows, data.opens, data.volumes);
      const quantScore = scoring?.totalScore || 0;

      for (const pos of (mainOpenPos || []).filter((p: any) => p.symbol === sym && p.status === 'open')) {
        const pnlPct = ((price - pos.price) / pos.price) * 100;
        let shouldClose = false;
        let closeReason = '';
        let newStatus = 'closed';

        if (pnlPct <= -2.5) {
          shouldClose = true;
          closeReason = `[Cloud] [${timeStr}] [${sym}] 손절 실행 (-2.5% 도달: ${pnlPct.toFixed(2)}%)`;
          newStatus = 'stopped';
        } else if (quantScore < 40) {
          shouldClose = true;
          closeReason = `[Cloud] [${timeStr}] [${sym}] 매수 근거 소멸 (점수 ${quantScore}점 < 40)`;
          newStatus = 'score_exit';
        } else if (pos.take_profit && price >= pos.take_profit) {
          shouldClose = true;
          closeReason = `[Cloud] [${timeStr}] [${sym}] 목표가 도달 익절`;
          newStatus = 'profit_taken';
        } else if (pos.stop_loss && price <= pos.stop_loss) {
          shouldClose = true;
          closeReason = `[Cloud] [${timeStr}] [${sym}] 추격 손절 터치`;
          newStatus = 'trailing_stop';
        }

        if (shouldClose) {
          const pnlKRW = Math.round(toKRW((price - pos.price) * pos.quantity));
          const investmentKRW = Math.round(toKRW(pos.price * pos.quantity));
          const balanceBefore = Math.round(mainBalance);
          // ★ 매도 완료 시에만 확정 잔고 복구: 원금 + 손익
          const saleProceeds = investmentKRW + pnlKRW;
          const newBalance = Math.round(mainBalance + saleProceeds);
          await supabase.from('ai_trades').update({
            status: newStatus, close_price: price, pnl: pnlKRW,
            closed_at: now.toISOString(),
            ai_reason: `${closeReason} | [수익 실현 완료] ${fmtKRWRaw(pnlKRW)} → [잔고 변동: ${fmtKRWRaw(balanceBefore)} → ${fmtKRWRaw(newBalance)}] [확정잔고 복구]`,
          }).eq('id', pos.id);
          await supabase.from('ai_wallet').update({
            balance: newBalance, updated_at: now.toISOString(),
          }).eq('id', mainWallet.id);
          mainBalance = newBalance;
          await addLog('quant', 'exit', sym, `${closeReason} | [수익 실현 완료] ${fmtKRWRaw(pnlKRW)} → [잔고: ${fmtKRWRaw(balanceBefore)} → ${fmtKRWRaw(newBalance)}] [확정잔고 복구]`, { pnl: pnlKRW, pnlPct: +pnlPct.toFixed(2) });
        }
      }
      await new Promise(r => setTimeout(r, 200));
    }

    // --- QUANT: Scan for new entries ---
    // ★ Collect all candidates first, then sort by score (highest first) for priority allocation
    const mainOpenCount = (mainOpenPos || []).filter(p => p.status === 'open').length;
    const quantCandidates: { sym: string; price: number; scoring: any }[] = [];

    for (let i = 0; i < QUANT_SYMBOLS.length; i += 3) {
      const batch = QUANT_SYMBOLS.slice(i, i + 3);
      const results = await Promise.all(batch.map(async (sym) => {
        try {
          const data = await getQuoteAndCandles(sym);
          if (!data) return null;
          const scoring = score10Indicators(data.quote, data.closes, data.highs, data.lows, data.opens, data.volumes);
          if (!scoring) return null;
          return { sym, price: data.quote.c, scoring };
        } catch { return null; }
      }));

      for (const r of results) {
        if (!r || r.scoring.totalScore < 50) continue;
        const alreadyHolding = (mainOpenPos || []).some(p => p.symbol === r.sym && p.status === 'open');
        const isPyramiding = alreadyHolding && r.scoring.totalScore >= 80;
        if (alreadyHolding && !isPyramiding) continue;
        if (mainOpenCount >= 10) continue;
        const sentimentOk = (r.scoring.indicators.sentiment.score || 0) > 0;
        const rvolOk = (r.scoring.indicators.rvol.rvol || 0) >= 1.5;
        const vwapOk = (r.scoring.indicators.candle.score || 0) >= 4;
        if (!sentimentOk || !rvolOk || !vwapOk) continue;
        quantCandidates.push(r);
      }
      if (i + 3 < QUANT_SYMBOLS.length) await new Promise(r => setTimeout(r, 200));
    }

    // ★ 점수 높은 종목 우선 배분 (Priority Allocation)
    quantCandidates.sort((a, b) => b.scoring.totalScore - a.scoring.totalScore);

    for (const r of quantCandidates) {
      const alreadyHolding = (mainOpenPos || []).some(p => p.symbol === r.sym && p.status === 'open');
      const isPyramiding = alreadyHolding && r.scoring.totalScore >= 80;
      const positionPct = isPyramiding ? 0.10 : 0.15;

      // ★ [확정 잔고 기반] 매수 가능 금액 = 현재 확정 잔고 × 비중
      const maxKRW = mainBalance * positionPct;
      const priceKRW = toKRW(r.price);
      const qty = Math.floor(maxKRW / priceKRW);
      const costKRW = Math.round(qty * priceKRW);

      // ★ [Hard Stop] 잔고 부족 시 진입 보류
      if (qty <= 0 || costKRW > mainBalance) {
        const tier = isPyramiding ? 'PYRAMID' : 'SCOUT';
        await addLog('quant', 'hold', r.sym, `[Cloud-Quant] [${timeStr}] ${r.sym} ${r.scoring.totalScore}점 매수 신호 발생 → ⚠️ 잔고 부족으로 인한 진입 보류 [${tier}] | 필요: ${fmtKRWRaw(costKRW)} | 확정 잔고: ${fmtKRWRaw(Math.round(mainBalance))}`, { score: r.scoring.totalScore, needed: costKRW, available: Math.round(mainBalance) });
        continue;
      }

      const stopLoss = +(r.price * 0.975).toFixed(4);
      const takeProfit = +(r.price * 1.06).toFixed(4);
      const tier = isPyramiding ? 'PYRAMID' : 'SCOUT';
      const balanceBefore = Math.round(mainBalance);
      // ★ 매수 즉시 확정 잔고 차감
      const newBuyBalance = Math.round(mainBalance - costKRW);
      const logMsg = `[Cloud-Quant] [${timeStr}] ${r.sym} ${r.scoring.totalScore}점 자율 매수 [${tier}|${qty}주@${fmtKRW(r.price)}|${fmtKRWRaw(costKRW)}] | [확정잔고 차감: ${fmtKRWRaw(balanceBefore)} → ${fmtKRWRaw(newBuyBalance)}]`;

      await supabase.from('ai_trades').insert({
        symbol: r.sym, side: 'buy', quantity: qty, price: r.price,
        stop_loss: stopLoss, take_profit: takeProfit, status: 'open',
        ai_reason: logMsg, ai_confidence: r.scoring.totalScore,
      });
      await supabase.from('ai_wallet').update({
        balance: newBuyBalance, updated_at: now.toISOString(),
      }).eq('id', mainWallet.id);
      mainBalance = newBuyBalance;
      await addLog('quant', 'buy', r.sym, logMsg, { score: r.scoring.totalScore, qty, costKRW });
    }

    // ========== PHASE 2: SCALPING STRATEGY (Penny Stocks) ==========
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
        await addLog('scalping', 'learn', null, `[AI-Learn] 진입 금지 블랙리스트: ${[...blacklistSymbols].join(', ')} (3회+ 손절)`, {});
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

      await addLog('scalping', 'learn', null, `[AI-Learn] 최근 승률 ${recentWinRate.toFixed(1)}% → 동적 진입 기준: +${dynamicEntryThreshold}%`, {});

      // Exit checks
      const scalpSymbolsToCheck = [...new Set((scalpOpenPos || []).map((p: any) => p.symbol))];
      for (const sym of scalpSymbolsToCheck) {
        const quoteData = await finnhubFetch(`/quote?symbol=${sym}`);
        if (!quoteData?.c) continue;
        const price = quoteData.c;

        if (price < MIN_PRICE_USD) {
          await addLog('scalping', 'warning', sym, `[Cloud-Scalp] [${timeStr}] ⚠️ ${sym} 초저가 경고: ${fmtKRW(price)} (₩1,000 미만) — 즉시 정리 필요`, { price, priceKRW: Math.round(toKRW(price)) });
        }

        for (const pos of (scalpOpenPos || []).filter((p: any) => p.symbol === sym && p.status === 'open')) {
          const pnlPct = ((price - pos.price) / pos.price) * 100;
          let shouldClose = false;
          let closeReason = '';
          let newStatus = 'closed';

          const peakPrice = Math.max(pos.peak_price || pos.price, price);
          if (price > (pos.peak_price || pos.price)) {
            await supabase.from('scalping_trades').update({ peak_price: peakPrice }).eq('id', pos.id);
          }

          if (pnlPct <= -2.5) {
            shouldClose = true;
            closeReason = `[Cloud-Scalp] [${timeStr}] ${sym} 손절 (-2.5% 도달: ${pnlPct.toFixed(2)}%)`;
            newStatus = 'stopped';
          } else if (peakPrice >= pos.price * 1.10) {
            const dropFromPeak = ((peakPrice - price) / peakPrice) * 100;
            if (dropFromPeak >= 5) {
              const lockedPnlPct = ((price - pos.price) / pos.price * 100).toFixed(2);
              shouldClose = true;
              closeReason = `[Cloud-Scalp] [${timeStr}] ${sym} 추격익절 (고점 ${fmtKRW(peakPrice)} 대비 -${dropFromPeak.toFixed(1)}% → 수익 ${lockedPnlPct}% 확정)`;
              newStatus = 'trailing_profit';
            }
          } else if (pos.stop_loss && price <= pos.stop_loss) {
            shouldClose = true;
            closeReason = `[Cloud-Scalp] [${timeStr}] ${sym} 추격 손절 터치 (${fmtKRW(pos.stop_loss)})`;
            newStatus = 'stopped';
          } else if (pos.take_profit && price >= pos.take_profit) {
            shouldClose = true;
            closeReason = `[Cloud-Scalp] [${timeStr}] ${sym} 익절 도달 (+5%)`;
            newStatus = 'profit_taken';
          } else if (blacklistSymbols.has(sym) && pnlPct <= 0.2 && pnlPct >= -1.0) {
            shouldClose = true;
            closeReason = `[Cloud-Scalp] [${timeStr}] ${sym} 지능형 조기 대응 — 블랙리스트 종목 본절 탈출 (${pnlPct.toFixed(2)}%)`;
            newStatus = 'early_exit';
          }

          // Partial exit at 2%
          if (!shouldClose && pnlPct >= 2) {
            const partialExits = pos.partial_exits || [];
            const hasFirst = partialExits.some((e: any) => e.type === 'first_partial');
            if (!hasFirst) {
              const sellQty = Math.floor(pos.quantity * 0.5);
              if (sellQty > 0) {
                const partialPnl = Math.round(toKRW((price - pos.price) * sellQty));
                const sellValue = Math.round(toKRW(sellQty * price));
                partialExits.push({ type: 'first_partial', qty: sellQty, price, pnl: partialPnl, at: now.toISOString() });
                await supabase.from('scalping_trades').update({
                  quantity: pos.quantity - sellQty, partial_exits: partialExits,
                  stop_loss: Math.max(+(price - 2.0 * (price * 0.02)).toFixed(4), pos.stop_loss || 0),
                }).eq('id', pos.id);
                // ★ 부분 매도 확정 → 확정 잔고에 매도 대금 복구
                const newPartialBal = Math.round(scalpBalance + sellValue);
                await supabase.from('scalping_wallet').update({
                  balance: newPartialBal, updated_at: now.toISOString(),
                }).eq('id', scalpWallet.id);
                scalpBalance = newPartialBal;
                await addLog('scalping', 'exit', sym, `[Cloud-Scalp] ${sym} 1차 50% 익절 (${pnlPct.toFixed(1)}%) | [확정잔고 복구] ${fmtKRWRaw(sellValue)} 입금`, { pnl: partialPnl });
              }
            }
          }

          if (shouldClose) {
            const pnlKRW = Math.round(toKRW((price - pos.price) * pos.quantity));
            const investmentKRW = Math.round(toKRW(pos.price * pos.quantity));
            const balanceBefore = Math.round(scalpBalance);
            // ★ 매도 완료 → 원금 + 손익을 확정 잔고에 복구
            const newScalpBal = Math.round(scalpBalance + investmentKRW + pnlKRW);
            await supabase.from('scalping_trades').update({
              status: newStatus, close_price: price, pnl: pnlKRW,
              closed_at: now.toISOString(), ai_reason: `${closeReason} | [수익 실현 완료] ${fmtKRWRaw(pnlKRW)} → [확정잔고 복구: ${fmtKRWRaw(balanceBefore)} → ${fmtKRWRaw(newScalpBal)}]`,
            }).eq('id', pos.id);
            await supabase.from('scalping_wallet').update({
              balance: newScalpBal, updated_at: now.toISOString(),
            }).eq('id', scalpWallet.id);
            scalpBalance = newScalpBal;
            await addLog('scalping', 'exit', sym, `${closeReason} | [확정잔고 복구] ${fmtKRWRaw(pnlKRW)} → [잔고: ${fmtKRWRaw(balanceBefore)} → ${fmtKRWRaw(newScalpBal)}]`, { pnl: pnlKRW, balanceBefore, balanceAfter: newScalpBal });
          }
        }
        await new Promise(r => setTimeout(r, 200));
      }

      // Penny stock scanning with priority allocation
      const PENNY_GROUPS = [
        ['NIO', 'LCID', 'GOEV', 'FFIE', 'MULN', 'WKHS', 'NKLA', 'CHPT', 'FCEL', 'PLUG',
         'SNDL', 'TLRY', 'ACB', 'CGC', 'MNMD', 'SENS', 'GNUS', 'BNGO', 'CLVS', 'DNA', 'ME', 'SDC', 'SOFI', 'HOOD', 'PSFE'],
        ['WISH', 'SKLZ', 'OPEN', 'LMND', 'BYND', 'IONQ', 'QS', 'SIRI', 'NOK', 'BB',
         'TELL', 'CLOV', 'ASTS', 'RKLB', 'LUNR', 'RGTI', 'QUBT', 'BTG', 'FSM', 'GPL', 'GATO', 'USAS', 'MARA', 'RIOT', 'BITF'],
        ['HUT', 'CLSK', 'AFRM', 'BKKT', 'CENN', 'EVGO', 'GSAT', 'HIMS', 'IBRX', 'JOBY',
         'KULR', 'LIDR', 'MVIS', 'NNDM', 'ORGN', 'PAYO', 'QBTS', 'RDW', 'STEM', 'TPIC', 'UEC', 'VLD', 'WULF', 'XOS', 'YEXT'],
        ['ZETA', 'AEVA', 'AMPX', 'ARVL', 'BEEM', 'BLNK', 'CANO', 'DM', 'EOSE', 'FLNC',
         'GLS', 'HYLN', 'KORE', 'LAZR', 'MAPS', 'NUVB', 'OUST', 'SHLS', 'TRMR', 'UPST', 'VNET', 'WRAP', 'XPEV', 'ARQQ', 'ENVX'],
      ];
      const cycleCount = (await supabase.from('agent_status').select('total_cycles').limit(1).single()).data?.total_cycles || 0;
      const pennyGroupIdx = cycleCount % PENNY_GROUPS.length;
      const pennyTickers = PENNY_GROUPS[pennyGroupIdx];
      let scalpOpenCount = (scalpOpenPos || []).filter(p => p.status === 'open').length;

      await addLog('scalping', 'scan', null, `[Cloud-Scalp] [${timeStr}] 소형주 그룹 ${pennyGroupIdx + 1}/4 스캔 시작 (${pennyTickers.length}개 종목) | 확정잔고: ${fmtKRWRaw(Math.round(scalpBalance))}`, {});

      // ★ Collect all candidates first, then sort by changePct (highest first)
      const scalpCandidates: { sym: string; price: number; changePct: number }[] = [];

      for (let bi = 0; bi < pennyTickers.length; bi += 5) {
        const batch = pennyTickers.slice(bi, bi + 5);
        const batchResults = await Promise.all(batch.map(async (sym) => {
          try {
            const alreadyHolding = (scalpOpenPos || []).some(p => p.symbol === sym && p.status === 'open');
            if (alreadyHolding) return null;
            if (blacklistSymbols.has(sym)) {
              return { sym, price: 0, changePct: 0, filtered: true, reason: 'blacklist' };
            }
            const quoteData = await finnhubFetch(`/quote?symbol=${sym}`);
            if (!quoteData?.c || quoteData.c >= 10) return null;
            if (quoteData.c < MIN_PRICE_USD) {
              return { sym, price: quoteData.c, changePct: 0, filtered: true, reason: 'low_price' };
            }
            const changePct = quoteData.dp || 0;
            if (changePct < dynamicEntryThreshold) return null;
            return { sym, price: quoteData.c, changePct, filtered: false };
          } catch { return null; }
        }));

        const filteredStocks = batchResults.filter((r: any) => r?.filtered);
        for (const f of filteredStocks) {
          const reason = f.reason === 'blacklist'
            ? `[AI-Learn] ${f.sym}: 블랙리스트 종목 → 진입 차단`
            : `[Cloud-Scalp] ${f.sym}: ${fmtKRW(f.price)} (₩1,000 미만 → 거래 차단)`;
          await addLog('scalping', 'filter', f.sym, reason, { price: f.price, reason: f.reason });
        }

        const validResults = batchResults.filter((r: any) => r && !r.filtered && r.changePct > 0);
        for (const r of validResults) {
          if (r) scalpCandidates.push({ sym: r.sym, price: r.price, changePct: r.changePct });
        }
        if (bi + 5 < pennyTickers.length) await new Promise(r => setTimeout(r, 200));
      }

      // ★ 상승률 높은 종목 우선 배분 (Priority Allocation)
      scalpCandidates.sort((a, b) => b.changePct - a.changePct);

      for (const r of scalpCandidates) {
        if (scalpOpenCount >= 10) break;
        const { sym, price, changePct } = r;
        const priceKRW = toKRW(price);
        // ★ [확정 잔고 기반] 매수 금액 = 현재 확정 잔고 × 10%
        const maxKRW = scalpBalance * 0.10;
        const qty = Math.floor(maxKRW / priceKRW);
        const costKRW = Math.round(qty * priceKRW);

        // ★ [Hard Stop] 잔고 부족 시 진입 보류
        if (qty <= 0 || costKRW > scalpBalance) {
          await addLog('scalping', 'hold', sym, `[Cloud-Scalp] [${timeStr}] ${sym} +${changePct.toFixed(1)}% 매수 신호 → ⚠️ 잔고 부족으로 인한 진입 보류 | 필요: ${fmtKRWRaw(costKRW)} | 확정잔고: ${fmtKRWRaw(Math.round(scalpBalance))}`, { changePct, needed: costKRW, available: Math.round(scalpBalance) });
          continue;
        }

        if (price < MIN_PRICE_USD) {
          await addLog('scalping', 'filter', sym, `[Cloud-Scalp] [${timeStr}] ${sym} 저가주 필터링으로 인한 진입 취소 (${fmtKRW(price)} < ₩1,000)`, { price });
          continue;
        }

        const stopLoss = +(price * 0.975).toFixed(4);
        const takeProfit = +(price * 1.05).toFixed(4);
        const balanceBefore = Math.round(scalpBalance);
        // ★ 매수 즉시 확정 잔고에서 차감
        const newScalpBuyBal = Math.round(scalpBalance - costKRW);
        const logMsg = `[Cloud-Scalp] [${timeStr}] ${sym} +${changePct.toFixed(1)}% 급등 포착 즉시 매수 (${qty}주@${fmtKRW(price)}) | 손절 -2.5% / 익절 +5% / 추격익절 고점-5% | [확정잔고 차감: ${fmtKRWRaw(balanceBefore)} → ${fmtKRWRaw(newScalpBuyBal)}]`;

        await supabase.from('scalping_trades').insert({
          symbol: sym, side: 'buy', quantity: qty, price,
          stop_loss: stopLoss, take_profit: takeProfit, status: 'open',
          entry_score: Math.round(changePct), time_limit_at: null,
          ai_reason: logMsg, ai_confidence: 100,
        });
        await supabase.from('scalping_wallet').update({
          balance: newScalpBuyBal, updated_at: now.toISOString(),
        }).eq('id', scalpWallet.id);
        scalpBalance = newScalpBuyBal;
        scalpOpenCount++;
        await addLog('scalping', 'buy', sym, logMsg, { changePct: +changePct.toFixed(1), qty, costKRW: +costKRW.toFixed(0), balanceBefore, balanceAfter: newScalpBuyBal });
      }
    }

    // Update cycle count
    await supabase.from('agent_status').update({
      last_cycle_at: now.toISOString(),
      total_cycles: mainWallet ? (await supabase.from('agent_status').select('total_cycles').limit(1).single()).data?.total_cycles + 1 || 1 : 1,
    }).not('id', 'is', null);

    await addLog('system', 'info', null, `[${timeStr}] Cloud Agent 사이클 완료`);

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
