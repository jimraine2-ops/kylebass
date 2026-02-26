import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const AI_GATEWAY = 'https://ai.gateway.lovable.dev/v1/chat/completions';
const FINNHUB_BASE = 'https://finnhub.io/api/v1';
const KRW_RATE = 1350; // Fixed exchange rate: 1 USD = 1,350 KRW
const SLIPPAGE_BUY = 0.0002;  // +0.02%
const SLIPPAGE_SELL = 0.0002; // -0.02%

function applySlippage(price: number, side: 'buy' | 'sell'): number {
  if (side === 'buy') return +(price * (1 + SLIPPAGE_BUY)).toFixed(4);
  return +(price * (1 - SLIPPAGE_SELL)).toFixed(4);
}

function toKRW(usd: number): number {
  return usd * KRW_RATE;
}

function fmtKRW(usd: number): string {
  return `₩${toKRW(usd).toLocaleString('ko-KR', { maximumFractionDigits: 0 })}`;
}

function fmtKRWRaw(krw: number): string {
  return `₩${krw.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}`;
}

function getFinnhubToken(): string {
  return Deno.env.get('FINNHUB_API_KEY') || '';
}

async function finnhubFetch(path: string) {
  const token = getFinnhubToken();
  if (!token) return null;
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`${FINNHUB_BASE}${path}${sep}token=${token}`);
  if (!res.ok) return null;
  return res.json();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body = await req.json();
    const { action } = body;

    // Input validation: action must be a known string
    const ALLOWED_ACTIONS = ['analyze-and-trade', 'get-portfolio', 'reset-wallet', 'update-balance', 'scalping-analyze', 'get-scalping-portfolio', 'reset-scalping-wallet', 'quant-auto-trade'];
    if (!action || typeof action !== 'string' || !ALLOWED_ACTIONS.includes(action)) {
      return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Validate symbol if present
    if (body.symbol !== undefined) {
      if (typeof body.symbol !== 'string' || body.symbol.length > 10 || !/^[A-Z0-9.]+$/.test(body.symbol)) {
        return new Response(JSON.stringify({ error: 'Invalid symbol' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // Validate price if present
    if (body.price !== undefined) {
      if (typeof body.price !== 'number' || body.price <= 0 || body.price > 1000000 || !isFinite(body.price)) {
        return new Response(JSON.stringify({ error: 'Invalid price' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // Validate quantScore if present
    if (body.quantScore !== undefined) {
      if (typeof body.quantScore !== 'number' || body.quantScore < 0 || body.quantScore > 100 || !isFinite(body.quantScore)) {
        return new Response(JSON.stringify({ error: 'Invalid quantScore' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // Validate walletType if present
    if (body.walletType !== undefined) {
      if (typeof body.walletType !== 'string' || !['main', 'scalping'].includes(body.walletType)) {
        return new Response(JSON.stringify({ error: 'Invalid walletType' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // ==================== MAIN AI TRADING ====================
    if (action === 'analyze-and-trade') {
      const { symbol, price, chartData, quantScore, indicators } = body;
      const { data: wallet } = await supabase.from('ai_wallet').select('*').limit(1).single();
      if (!wallet) throw new Error('No wallet found');

      const { data: openPositions } = await supabase.from('ai_trades').select('*').eq('status', 'open');

      // Price in KRW for calculations
      const priceKRW = toKRW(price);

      const closedTrades: any[] = [];
      for (const pos of (openPositions || [])) {
        let shouldClose = false;
        let closeReason = '';
        let newStatus = 'closed';

        if (pos.stop_loss && price <= pos.stop_loss && pos.symbol === symbol) {
          shouldClose = true;
          closeReason = `손절가 ${fmtKRW(pos.stop_loss)} 도달 (즉시 전량 매도)`;
          newStatus = 'stopped';
        } else if (pos.take_profit && price >= pos.take_profit && pos.symbol === symbol) {
          shouldClose = true;
          closeReason = `목표가 ${fmtKRW(pos.take_profit)} 도달 (추격 익절)`;
          newStatus = 'profit_taken';
        } else if (quantScore !== undefined && quantScore < 40 && pos.symbol === symbol) {
          shouldClose = true;
          closeReason = `지표 점수 ${quantScore}점 (<40) 매수 근거 소멸 - 즉시 전량 매도`;
          newStatus = 'score_exit';
        }

        if (shouldClose && pos.symbol === symbol) {
          const sellPrice = applySlippage(price, 'sell');
          const pnlRaw = toKRW((sellPrice - pos.price) * pos.quantity);
          const pnl = Math.round(pnlRaw);
          const investmentKRW = Math.round(toKRW(pos.price * pos.quantity));
          const pnlPct = ((sellPrice - pos.price) / pos.price * 100).toFixed(2);
          const balanceBefore = Math.round(wallet.balance);
          const balanceAfter = Math.round(wallet.balance + investmentKRW + pnl);
          await supabase.from('ai_trades').update({
            status: newStatus, close_price: sellPrice, pnl,
            closed_at: new Date().toISOString(),
            ai_reason: `${closeReason} | [API가격: ${fmtKRW(price)} → 슬리피지적용가: ${fmtKRW(sellPrice)}] | 수익률: ${pnlPct}% | [수익 실현 완료] ${fmtKRWRaw(pnl)} 입금 → 잔고 업데이트 | [잔고 변동: ${fmtKRWRaw(balanceBefore)} → ${fmtKRWRaw(balanceAfter)}]`,
          }).eq('id', pos.id);

          await supabase.from('ai_wallet').update({
            balance: balanceAfter,
            updated_at: new Date().toISOString(),
          }).eq('id', wallet.id);

          wallet.balance = balanceAfter;
          closedTrades.push({ ...pos, pnl, closeReason, balanceBefore, balanceAfter });
        }
      }

      const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
      if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

      const alreadyHolding = (openPositions || []).some(p => p.symbol === symbol && p.status === 'open');
      const openCount = (openPositions || []).filter(p => p.status === 'open').length;
      const availableBalance = wallet.balance; // KRW

      const meetsScoreThreshold = quantScore !== undefined ? quantScore >= 50 : false;
      let positionSizePct = 0;
      let entryTier = 'NONE';
      if (quantScore !== undefined && quantScore >= 50) {
        positionSizePct = 0.10;
        entryTier = quantScore >= 80 ? 'PYRAMID_READY' : 'SCOUT';
      }

      let isPyramiding = false;
      if (alreadyHolding && quantScore !== undefined && quantScore >= 80) {
        isPyramiding = true;
        positionSizePct = 0.10;
        entryTier = 'PYRAMID_ADD';
      }

      const sentimentPositive = indicators?.sentiment?.score > 0;
      const rvolAbove = indicators?.rvol?.rvol >= 1.2;
      const aboveVwap = indicators?.confluence?.vwapCross || indicators?.confluence?.score >= 5;
      const basicConditionsMet = sentimentPositive && rvolAbove && aboveVwap;
      const trailingMultiplier = 1.5;

      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

      const prompt = `You are an AI quant trading analyst operating in AGGRESSIVE MODE (Low Threshold: 50pts).
Analyze this stock and decide whether to BUY, SELL, or HOLD.

Symbol: ${symbol}
Current Price: ${fmtKRW(price)} (USD $${price})
Available Balance: ${fmtKRWRaw(availableBalance)}
Already Holding: ${alreadyHolding ? 'Yes' : 'No'}
Pyramiding Eligible: ${isPyramiding ? 'Yes' : 'No'}
Open Positions: ${openCount}/5
Quant Score: ${quantScore || 'N/A'}/100
Entry Tier: ${entryTier} (Position Size: ${(positionSizePct * 100).toFixed(0)}%)
Score Threshold Met (>=50): ${meetsScoreThreshold}
Basic Conditions Met: ${basicConditionsMet ? 'Yes' : 'No'}
Trailing Stop Multiplier: ATR × ${trailingMultiplier}
Indicator Details: ${JSON.stringify(indicators || {})}

Respond with JSON ONLY:
{"action": "BUY"|"SELL"|"HOLD", "confidence": 0-100, "reason": "specific explanation", "quantity": number, "stopLoss": number, "takeProfit": number}`;

      const aiResponse = await fetch(AI_GATEWAY, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'google/gemini-3-flash-preview', messages: [{ role: 'user', content: prompt }] }),
      });

      if (!aiResponse.ok) {
        const status = aiResponse.status;
        if (status === 429) return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        if (status === 402) return new Response(JSON.stringify({ error: 'Payment required' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        throw new Error(`AI error: ${status}`);
      }

      const aiData = await aiResponse.json();
      let content = aiData.choices?.[0]?.message?.content || '';
      content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      let decision;
      try { decision = JSON.parse(content); }
      catch { decision = { action: 'HOLD', confidence: 0, reason: 'AI 응답 파싱 실패', quantity: 0 }; }

      let trade = null;
      const canBuy = (!alreadyHolding || isPyramiding) && openCount < 5 && meetsScoreThreshold && basicConditionsMet;

      if (decision.action === 'BUY' && decision.confidence >= 40 && canBuy) {
        const buyPrice = applySlippage(price, 'buy');
        const buyPriceKRW = toKRW(buyPrice);
        const maxInvestmentKRW = availableBalance * positionSizePct;
        const qty = Math.min(decision.quantity || Math.floor(maxInvestmentKRW / buyPriceKRW), Math.floor(maxInvestmentKRW / buyPriceKRW));
        const costKRW = Math.round(qty * buyPriceKRW);
        if (qty > 0 && costKRW <= availableBalance) {
          const stopLoss = decision.stopLoss || +(buyPrice * 0.95).toFixed(4);
          const takeProfit = decision.takeProfit || +(buyPrice * 1.08).toFixed(4);
          const logPrefix = isPyramiding ? 'PYRAMID' : 'SCOUT';
          const newBal = Math.round(availableBalance - costKRW);
          const { data: newTrade } = await supabase.from('ai_trades').insert({
            symbol, side: 'buy', quantity: qty, price: buyPrice,
            stop_loss: stopLoss, take_profit: takeProfit, status: 'open',
            ai_reason: `[Main] [${logPrefix}|Score:${quantScore || 'N/A'}|${(positionSizePct*100).toFixed(0)}%] [${timeStr}] ${symbol} ${fmtKRWRaw(costKRW)} 매수 집행 | [API가격: ${fmtKRW(price)} → 슬리피지적용가: ${fmtKRW(buyPrice)}] (점수: ${quantScore}점 / 근거: ${decision.reason}) | [잔고 차감: ${fmtKRWRaw(Math.round(availableBalance))} → ${fmtKRWRaw(newBal)}]`,
            ai_confidence: decision.confidence,
          }).select().single();

          await supabase.from('ai_wallet').update({
            balance: newBal, updated_at: new Date().toISOString(),
          }).eq('id', wallet.id);
          trade = newTrade;
        }
      }

      return new Response(JSON.stringify({
        decision, trade, closedTrades,
        wallet: { ...wallet, balance: trade ? availableBalance - (trade.quantity * priceKRW) : wallet.balance },
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'get-portfolio') {
      const { data: wallet } = await supabase.from('ai_wallet').select('*').limit(1).single();
      const { data: openPositions } = await supabase.from('ai_trades').select('*').eq('status', 'open').order('opened_at', { ascending: false });
      const { data: allTrades } = await supabase.from('ai_trades').select('*').neq('status', 'open').order('closed_at', { ascending: false }).limit(50);

      const openSymbols = [...new Set((openPositions || []).map((p: any) => p.symbol))];
      const realTimePrices: Record<string, number> = {};
      for (const sym of openSymbols) {
        try {
          const quoteData = await finnhubFetch(`/quote?symbol=${sym}`);
          if (quoteData?.c) realTimePrices[sym] = quoteData.c;
        } catch { /* skip */ }
      }

      const enrichedPositions = (openPositions || []).map((pos: any) => {
        const currentPrice = realTimePrices[pos.symbol] || pos.price;
        const unrealizedPnl = toKRW((currentPrice - pos.price) * pos.quantity);
        const unrealizedPnlPct = ((currentPrice - pos.price) / pos.price) * 100;
        return { ...pos, currentPrice, unrealizedPnl: +unrealizedPnl.toFixed(0), unrealizedPnlPct: +unrealizedPnlPct.toFixed(2), priceKRW: toKRW(pos.price), currentPriceKRW: toKRW(currentPrice) };
      });

      const closedTrades = allTrades || [];
      const wins = closedTrades.filter(t => (t.pnl || 0) > 0).length;
      const losses = closedTrades.filter(t => (t.pnl || 0) <= 0).length;
      const totalClosed = closedTrades.length;
      const winRate = totalClosed > 0 ? (wins / totalClosed) * 100 : 0;
      const totalPnl = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
      const grossProfit = closedTrades.filter(t => (t.pnl || 0) > 0).reduce((s, t) => s + t.pnl, 0);
      const grossLoss = Math.abs(closedTrades.filter(t => (t.pnl || 0) < 0).reduce((s, t) => s + t.pnl, 0));
      const profitFactor = grossLoss > 0 ? +(grossProfit / grossLoss).toFixed(2) : grossProfit > 0 ? 999 : 0;
      const totalUnrealizedPnl = enrichedPositions.reduce((sum, p) => sum + p.unrealizedPnl, 0);
      const avgHoldTime = closedTrades.length > 0
        ? closedTrades.reduce((sum, t) => {
            if (t.opened_at && t.closed_at) return sum + (new Date(t.closed_at).getTime() - new Date(t.opened_at).getTime());
            return sum;
          }, 0) / closedTrades.length / 60000
        : 0;
      const bestTrade = closedTrades.reduce((best, t) => (!best || (t.pnl || 0) > (best.pnl || 0)) ? t : best, null as any);

      const realizedPnl = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);

      return new Response(JSON.stringify({
        wallet, openPositions: enrichedPositions, closedTrades,
        stats: {
          winRate: +winRate.toFixed(1), totalPnl: +totalPnl.toFixed(0), totalUnrealizedPnl: +totalUnrealizedPnl.toFixed(0),
          totalTrades: totalClosed, wins, losses, profitFactor, avgHoldTimeMinutes: +avgHoldTime.toFixed(1), bestTrade,
          cumulativeReturn: wallet ? +((realizedPnl) / wallet.initial_balance * 100).toFixed(2) : 0,
        }
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'reset-wallet') {
      await supabase.from('ai_trades').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('ai_wallet').update({ balance: 10000000, initial_balance: 10000000, updated_at: new Date().toISOString() }).not('id', 'is', null);
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ==================== UPDATE WALLET BALANCE (Manual Edit) ====================
    if (action === 'update-balance') {
      const { walletType, newBalance } = body;
      if (typeof newBalance !== 'number' || newBalance < 0 || newBalance > 999999999) {
        return new Response(JSON.stringify({ error: 'Invalid balance value' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const table = walletType === 'scalping' ? 'scalping_wallet' : 'ai_wallet';
      const roundedBalance = Math.round(newBalance);
      
      // Only update balance, NOT initial_balance (to preserve accounting integrity)
      const { error } = await supabase.from(table).update({
        balance: roundedBalance,
        updated_at: new Date().toISOString()
      }).not('id', 'is', null);

      if (error) throw error;
      return new Response(JSON.stringify({ success: true, balance: roundedBalance }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ==================== SCALPING ENGINE (INSTANT EXECUTION) ====================
    if (action === 'scalping-analyze') {
      const { symbol, price, quantScore, indicators } = body;

      const { data: wallet } = await supabase.from('scalping_wallet').select('*').limit(1).single();
      if (!wallet) throw new Error('No scalping wallet found');

      const { data: openPositions } = await supabase.from('scalping_trades').select('*').eq('status', 'open');

      const priceKRW = toKRW(price);

      // === Exit checks for open scalping positions ===
      const closedTrades: any[] = [];
      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

      for (const pos of (openPositions || [])) {
        if (pos.symbol !== symbol) continue;

        let shouldClose = false;
        let closeReason = '';
        let newStatus = 'closed';
        const pnlPct = ((price - pos.price) / pos.price) * 100;

        // -2% hard stop
        if (pnlPct <= -2) {
          shouldClose = true;
          closeReason = `[${timeStr}] 청산 사유: [손절] 실행 - ${symbol} 강제 손절 (-2% 도달: ${pnlPct.toFixed(2)}%)`;
          newStatus = 'stopped';
        }
        // 15-min time-cut
        else if (pos.time_limit_at && now >= new Date(pos.time_limit_at) && pnlPct <= 0.5) {
          shouldClose = true;
          closeReason = `[${timeStr}] 청산 사유: [타임컷] 실행 - ${symbol} 15분 타임컷 본전 청산 (수익: ${pnlPct.toFixed(2)}%)`;
          newStatus = 'time_cut';
        }
        // Trailing stop
        else if (pos.stop_loss && price <= pos.stop_loss) {
          shouldClose = true;
          closeReason = `[${timeStr}] 청산 사유: [추격익절] 실행 - ${symbol} ATR 추격 손절 터치 (${fmtKRW(pos.stop_loss)})`;
          newStatus = 'stopped';
        }
        // Take profit
        else if (pos.take_profit && price >= pos.take_profit) {
          shouldClose = true;
          closeReason = `[${timeStr}] 청산 사유: [익절] 실행 - ${symbol} 목표가 도달 (${fmtKRW(pos.take_profit)})`;
          newStatus = 'profit_taken';
        }

        // Partial exit: 2-3% profit → sell 50%
        if (!shouldClose && pnlPct >= 2) {
          const partialExits = pos.partial_exits || [];
          const hasFirstPartial = partialExits.some((e: any) => e.type === 'first_partial');
          if (!hasFirstPartial) {
            const sellQty = Math.floor(pos.quantity * 0.5);
            if (sellQty > 0) {
              const partialPnlKRW = toKRW((price - pos.price) * sellQty);
              const sellValueKRW = toKRW(sellQty * price);
              partialExits.push({ type: 'first_partial', qty: sellQty, price, pnl: +partialPnlKRW.toFixed(0), at: now.toISOString() });

              const atr = indicators?.atr?.atr || price * 0.02;
              const newTrailingStop = +(price - 2.0 * atr).toFixed(4);

              await supabase.from('scalping_trades').update({
                quantity: pos.quantity - sellQty,
                partial_exits: partialExits,
                stop_loss: Math.max(newTrailingStop, pos.stop_loss || 0),
              }).eq('id', pos.id);
              await supabase.from('scalping_wallet').update({
                balance: wallet.balance + sellValueKRW,
                updated_at: now.toISOString(),
              }).eq('id', wallet.id);
              wallet.balance += sellValueKRW;
              closedTrades.push({ symbol: pos.symbol, type: 'partial', pnl: +partialPnlKRW.toFixed(0), reason: `[${timeStr}] ${symbol} 1차 익절 50% (수익률: ${pnlPct.toFixed(1)}%)` });
            }
          } else if (pnlPct >= 3) {
            const atr = indicators?.atr?.atr || price * 0.02;
            const newTrailingStop = +(price - 2.0 * atr).toFixed(4);
            if (newTrailingStop > (pos.stop_loss || 0)) {
              await supabase.from('scalping_trades').update({
                stop_loss: newTrailingStop,
              }).eq('id', pos.id);
            }
          }
        }

        if (shouldClose) {
          const pnlKRW = toKRW((price - pos.price) * pos.quantity);
          const investmentKRW = toKRW(pos.price * pos.quantity);
          await supabase.from('scalping_trades').update({
            status: newStatus, close_price: price, pnl: +pnlKRW.toFixed(0),
            closed_at: now.toISOString(), ai_reason: closeReason,
          }).eq('id', pos.id);
          await supabase.from('scalping_wallet').update({
            balance: wallet.balance + investmentKRW + pnlKRW,
            updated_at: now.toISOString(),
          }).eq('id', wallet.id);
          wallet.balance += investmentKRW + pnlKRW;
          closedTrades.push({ ...pos, pnl: +pnlKRW.toFixed(0), closeReason });
        }
      }

      // === INSTANT ENTRY ===
      if (price >= 10) {
        return new Response(JSON.stringify({
          decision: { action: 'SKIP', reason: '주가 $10 이상: 스캘핑 대상 외' },
          trade: null, closedTrades, wallet,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const alreadyHolding = (openPositions || []).some(p => p.symbol === symbol && p.status === 'open');
      const openCount = (openPositions || []).filter(p => p.status === 'open').length;

      const canEnter = !alreadyHolding && openCount < 10;

      let trade = null;
      let decision = { action: 'HOLD', confidence: 0, reason: '이미 보유 중이거나 포지션 한도 초과', quantity: 0 };

      if (canEnter) {
        // Position size: 10% of scalping wallet (KRW)
        const maxInvestmentKRW = wallet.balance * 0.10;
        const qty = Math.floor(maxInvestmentKRW / priceKRW);
        const costKRW = qty * priceKRW;

        if (qty > 0 && costKRW <= wallet.balance) {
          const stopLoss = +(price * 0.98).toFixed(4);
          const takeProfit = +(price * 1.05).toFixed(4);
          const timeLimitAt = new Date(now.getTime() + 15 * 60 * 1000).toISOString();

          const { data: newTrade } = await supabase.from('scalping_trades').insert({
            symbol, side: 'buy', quantity: qty, price,
            stop_loss: stopLoss, take_profit: takeProfit, status: 'open',
            entry_score: quantScore || 0,
            time_limit_at: timeLimitAt,
            ai_reason: `[Scalp] [INSTANT] [${timeStr}] TOP 10 신규 포착: ${symbol} 즉시 매수 집행 (${fmtKRWRaw(costKRW)}, 수량: ${qty}주)`,
            ai_confidence: 100,
          }).select().single();

          await supabase.from('scalping_wallet').update({
            balance: wallet.balance - costKRW, updated_at: now.toISOString(),
          }).eq('id', wallet.id);

          trade = newTrade;
          decision = { action: 'BUY', confidence: 100, reason: `[Scalp] TOP 10 신규 포착: ${symbol} 즉시 매수 집행`, quantity: qty };
        }
      }

      return new Response(JSON.stringify({ decision, trade, closedTrades, wallet }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'get-scalping-portfolio') {
      const { data: wallet } = await supabase.from('scalping_wallet').select('*').limit(1).single();
      const { data: openPositions } = await supabase.from('scalping_trades').select('*').eq('status', 'open').order('opened_at', { ascending: false });
      const { data: allTrades } = await supabase.from('scalping_trades').select('*').neq('status', 'open').order('closed_at', { ascending: false }).limit(100);

      const openSymbols = [...new Set((openPositions || []).map((p: any) => p.symbol))];
      const realTimePrices: Record<string, number> = {};
      for (const sym of openSymbols) {
        try {
          const quoteData = await finnhubFetch(`/quote?symbol=${sym}`);
          if (quoteData?.c) realTimePrices[sym] = quoteData.c;
        } catch { /* skip */ }
      }

      const enrichedPositions = (openPositions || []).map((pos: any) => {
        const currentPrice = realTimePrices[pos.symbol] || pos.price;
        const unrealizedPnl = toKRW((currentPrice - pos.price) * pos.quantity);
        const unrealizedPnlPct = ((currentPrice - pos.price) / pos.price) * 100;
        const timeElapsed = pos.opened_at ? Math.round((Date.now() - new Date(pos.opened_at).getTime()) / 60000) : 0;
        return { ...pos, currentPrice, unrealizedPnl: +unrealizedPnl.toFixed(0), unrealizedPnlPct: +unrealizedPnlPct.toFixed(2), timeElapsedMin: timeElapsed, priceKRW: toKRW(pos.price), currentPriceKRW: toKRW(currentPrice) };
      });

      const closedTrades = allTrades || [];
      const wins = closedTrades.filter(t => (t.pnl || 0) > 0).length;
      const losses = closedTrades.filter(t => (t.pnl || 0) <= 0).length;
      const totalClosed = closedTrades.length;
      const winRate = totalClosed > 0 ? (wins / totalClosed) * 100 : 0;
      const totalPnl = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
      const grossProfit = closedTrades.filter(t => (t.pnl || 0) > 0).reduce((s, t) => s + t.pnl, 0);
      const grossLoss = Math.abs(closedTrades.filter(t => (t.pnl || 0) < 0).reduce((s, t) => s + t.pnl, 0));
      const profitFactor = grossLoss > 0 ? +(grossProfit / grossLoss).toFixed(2) : grossProfit > 0 ? 999 : 0;
      const totalUnrealizedPnl = enrichedPositions.reduce((sum, p) => sum + p.unrealizedPnl, 0);
      const avgHoldTime = closedTrades.length > 0
        ? closedTrades.reduce((sum, t) => {
            if (t.opened_at && t.closed_at) return sum + (new Date(t.closed_at).getTime() - new Date(t.opened_at).getTime());
            return sum;
          }, 0) / closedTrades.length / 60000
        : 0;

      return new Response(JSON.stringify({
        wallet, openPositions: enrichedPositions, closedTrades,
        stats: {
          winRate: +winRate.toFixed(1), totalPnl: +totalPnl.toFixed(0), totalUnrealizedPnl: +totalUnrealizedPnl.toFixed(0),
          totalTrades: totalClosed, wins, losses, profitFactor, avgHoldTimeMinutes: +avgHoldTime.toFixed(1),
          cumulativeReturn: wallet ? +((wallet.balance - wallet.initial_balance) / wallet.initial_balance * 100).toFixed(4) : 0,
        }
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'reset-scalping-wallet') {
      await supabase.from('scalping_trades').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('scalping_wallet').update({ balance: 1000000, initial_balance: 1000000, updated_at: new Date().toISOString() }).not('id', 'is', null);
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ==================== QUANT 10-INDICATOR AUTO TRADING (Uses Main Wallet) ====================
    if (action === 'quant-auto-trade') {
      const { symbol, price, quantScore, indicators } = body;
      
      const { data: wallet } = await supabase.from('ai_wallet').select('*').limit(1).single();
      if (!wallet) throw new Error('No wallet found');

      const { data: openPositions } = await supabase.from('ai_trades').select('*').eq('status', 'open');
      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      const priceKRW = toKRW(price);

      // === EXIT CHECKS (on ai_trades) ===
      const closedTrades: any[] = [];
      const logs: string[] = [];

      for (const pos of (openPositions || [])) {
        if (pos.symbol !== symbol) continue;

        let shouldClose = false;
        let closeReason = '';
        let newStatus = 'closed';
        const pnlPct = ((price - pos.price) / pos.price) * 100;

        // -2.5% hard stop
        if (pnlPct <= -2.5) {
          shouldClose = true;
          closeReason = `[Quant] [${timeStr}] [${symbol}] 손절 실행 (-2.5% 도달: ${pnlPct.toFixed(2)}%)`;
          newStatus = 'stopped';
        }
        // Score < 40
        else if (quantScore !== undefined && quantScore < 40) {
          shouldClose = true;
          closeReason = `[Quant] [${timeStr}] [${symbol}] 매수 근거 소멸 (점수 ${quantScore}점 < 40)`;
          newStatus = 'score_exit';
        }
        // Take profit
        else if (pos.take_profit && price >= pos.take_profit) {
          if (!pos.ai_reason?.startsWith('[Quant]')) continue;
          shouldClose = true;
          closeReason = `[Quant] [${timeStr}] [${symbol}] 목표가 도달 익절`;
          newStatus = 'profit_taken';
        }
        // Trailing stop
        else if (pos.stop_loss && price <= pos.stop_loss && pos.ai_reason?.startsWith('[Quant]')) {
          shouldClose = true;
          closeReason = `[Quant] [${timeStr}] [${symbol}] ATR×2 추격 익절 터치 (${fmtKRW(pos.stop_loss)})`;
          newStatus = 'trailing_stop';
        }

        if (shouldClose) {
          const pnlKRW = toKRW((price - pos.price) * pos.quantity);
          const investmentKRW = toKRW(pos.price * pos.quantity);
          await supabase.from('ai_trades').update({
            status: newStatus, close_price: price, pnl: +pnlKRW.toFixed(0),
            closed_at: now.toISOString(), ai_reason: closeReason,
          }).eq('id', pos.id);
          await supabase.from('ai_wallet').update({
            balance: wallet.balance + investmentKRW + pnlKRW, updated_at: now.toISOString(),
          }).eq('id', wallet.id);
          wallet.balance += investmentKRW + pnlKRW;
          logs.push(closeReason);
          closedTrades.push({ ...pos, pnl: +pnlKRW.toFixed(0), closeReason });
        }
      }

      // === ENTRY LOGIC ===
      const alreadyHolding = (openPositions || []).some(p => p.symbol === symbol && p.status === 'open');
      const openCount = (openPositions || []).filter(p => p.status === 'open').length;

      const sentimentPositive = (indicators?.sentiment?.score || 0) > 0;
      const rvolAbove = (indicators?.rvol?.rvol || 0) >= 1.5;
      const aboveVwap = (indicators?.candle?.score || 0) >= 4;
      const meetsScore = (quantScore || 0) >= 50;
      const allConditionsMet = sentimentPositive && rvolAbove && aboveVwap && meetsScore;

      let isPyramiding = false;
      if (alreadyHolding && (quantScore || 0) >= 80) {
        isPyramiding = true;
      }

      let trade = null;
      let decision = { action: 'HOLD', confidence: 0, reason: '조건 미충족', quantity: 0 };

      const canEnter = (!alreadyHolding || isPyramiding) && openCount < 10 && allConditionsMet;

      if (canEnter) {
        const positionPct = isPyramiding ? 0.10 : 0.15;
        const maxInvestmentKRW = wallet.balance * positionPct;
        const qty = Math.floor(maxInvestmentKRW / priceKRW);
        const costKRW = qty * priceKRW;

        if (qty > 0 && costKRW <= wallet.balance) {
          const stopLoss = +(price * 0.975).toFixed(4);
          const takeProfit = +(price * 1.06).toFixed(4);
          const tier = isPyramiding ? 'PYRAMID' : 'SCOUT';

          const logMsg = `[Quant] 10대지표 퀀트엔진: [${symbol}] ${quantScore}점 포착 및 자율 매수 완료 [${tier}|${(positionPct*100).toFixed(0)}%|${qty}주@${fmtKRW(price)}|총${fmtKRWRaw(costKRW)}]`;

          const { data: newTrade } = await supabase.from('ai_trades').insert({
            symbol, side: 'buy', quantity: qty, price,
            stop_loss: stopLoss, take_profit: takeProfit, status: 'open',
            ai_reason: `[Quant] [${timeStr}] ${logMsg}`,
            ai_confidence: quantScore || 0,
          }).select().single();

          await supabase.from('ai_wallet').update({
            balance: wallet.balance - costKRW, updated_at: now.toISOString(),
          }).eq('id', wallet.id);

          trade = newTrade;
          decision = { action: 'BUY', confidence: quantScore || 0, reason: logMsg, quantity: qty };
          logs.push(logMsg);
        }
      } else if (!allConditionsMet && meetsScore) {
        const missing: string[] = [];
        if (!sentimentPositive) missing.push('호재스코어≤0');
        if (!rvolAbove) missing.push('RVOL<1.5');
        if (!aboveVwap) missing.push('VWAP하단');
        decision = { action: 'HOLD', confidence: quantScore || 0, reason: `점수 ${quantScore}점 충족, 중첩조건 미달: ${missing.join(', ')}`, quantity: 0 };
      }

      return new Response(JSON.stringify({
        decision, trade, closedTrades, logs, wallet,
        conditions: { sentimentPositive, rvolAbove, aboveVwap, meetsScore, isPyramiding, allConditionsMet },
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('AI Trading error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
