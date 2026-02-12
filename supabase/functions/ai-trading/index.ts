import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const AI_GATEWAY = 'https://ai.gateway.lovable.dev/v1/chat/completions';
const FINNHUB_BASE = 'https://finnhub.io/api/v1';

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

    // ==================== MAIN AI TRADING ====================
    if (action === 'analyze-and-trade') {
      const { symbol, price, chartData, quantScore, indicators } = body;
      const { data: wallet } = await supabase.from('ai_wallet').select('*').limit(1).single();
      if (!wallet) throw new Error('No wallet found');

      const { data: openPositions } = await supabase.from('ai_trades').select('*').eq('status', 'open');

      const closedTrades: any[] = [];
      for (const pos of (openPositions || [])) {
        let shouldClose = false;
        let closeReason = '';
        let newStatus = 'closed';

        if (pos.stop_loss && price <= pos.stop_loss && pos.symbol === symbol) {
          shouldClose = true;
          closeReason = `손절가 $${pos.stop_loss} 도달 (즉시 전량 매도)`;
          newStatus = 'stopped';
        } else if (pos.take_profit && price >= pos.take_profit && pos.symbol === symbol) {
          shouldClose = true;
          closeReason = `목표가 $${pos.take_profit} 도달 (추격 익절)`;
          newStatus = 'profit_taken';
        } else if (quantScore !== undefined && quantScore < 40 && pos.symbol === symbol) {
          shouldClose = true;
          closeReason = `지표 점수 ${quantScore}점 (<40) 매수 근거 소멸 - 즉시 전량 매도`;
          newStatus = 'score_exit';
        }

        if (shouldClose && pos.symbol === symbol) {
          const pnl = (price - pos.price) * pos.quantity;
          await supabase.from('ai_trades').update({
            status: newStatus, close_price: price, pnl,
            closed_at: new Date().toISOString(), ai_reason: closeReason,
          }).eq('id', pos.id);

          await supabase.from('ai_wallet').update({
            balance: wallet.balance + (pos.price * pos.quantity) + pnl,
            updated_at: new Date().toISOString(),
          }).eq('id', wallet.id);

          wallet.balance += (pos.price * pos.quantity) + pnl;
          closedTrades.push({ ...pos, pnl, closeReason });
        }
      }

      const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
      if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

      const alreadyHolding = (openPositions || []).some(p => p.symbol === symbol && p.status === 'open');
      const openCount = (openPositions || []).filter(p => p.status === 'open').length;
      const availableBalance = wallet.balance;

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
Current Price: $${price}
Available Balance: $${availableBalance.toFixed(2)}
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
        const maxInvestment = availableBalance * positionSizePct;
        const qty = Math.min(decision.quantity || Math.floor(maxInvestment / price), Math.floor(maxInvestment / price));
        if (qty > 0 && qty * price <= availableBalance) {
          const stopLoss = decision.stopLoss || +(price * 0.95).toFixed(4);
          const takeProfit = decision.takeProfit || +(price * 1.08).toFixed(4);
          const logPrefix = isPyramiding ? 'PYRAMID' : 'SCOUT';
          const { data: newTrade } = await supabase.from('ai_trades').insert({
            symbol, side: 'buy', quantity: qty, price,
            stop_loss: stopLoss, take_profit: takeProfit, status: 'open',
            ai_reason: `[${logPrefix}|Score:${quantScore || 'N/A'}|${(positionSizePct*100).toFixed(0)}%] [${timeStr}] $${symbol} 매수 집행 (점수: ${quantScore}점 / 근거: ${decision.reason})`,
            ai_confidence: decision.confidence,
          }).select().single();

          await supabase.from('ai_wallet').update({
            balance: availableBalance - (qty * price), updated_at: new Date().toISOString(),
          }).eq('id', wallet.id);
          trade = newTrade;
        }
      }

      return new Response(JSON.stringify({
        decision, trade, closedTrades,
        wallet: { ...wallet, balance: trade ? availableBalance - (trade.quantity * trade.price) : wallet.balance },
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
        const unrealizedPnl = (currentPrice - pos.price) * pos.quantity;
        const unrealizedPnlPct = ((currentPrice - pos.price) / pos.price) * 100;
        return { ...pos, currentPrice, unrealizedPnl: +unrealizedPnl.toFixed(2), unrealizedPnlPct: +unrealizedPnlPct.toFixed(2) };
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

      return new Response(JSON.stringify({
        wallet, openPositions: enrichedPositions, closedTrades,
        stats: {
          winRate: +winRate.toFixed(1), totalPnl: +totalPnl.toFixed(2), totalUnrealizedPnl: +totalUnrealizedPnl.toFixed(2),
          totalTrades: totalClosed, wins, losses, profitFactor, avgHoldTimeMinutes: +avgHoldTime.toFixed(1), bestTrade,
          cumulativeReturn: wallet ? +((wallet.balance - wallet.initial_balance) / wallet.initial_balance * 100).toFixed(2) : 0,
        }
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'reset-wallet') {
      await supabase.from('ai_trades').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('ai_wallet').update({ balance: 10000, initial_balance: 10000, updated_at: new Date().toISOString() }).not('id', 'is', null);
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ==================== SCALPING ENGINE ====================
    if (action === 'scalping-analyze') {
      const { symbol, price, quantScore, indicators } = body;
      const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
      if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

      const { data: wallet } = await supabase.from('scalping_wallet').select('*').limit(1).single();
      if (!wallet) throw new Error('No scalping wallet found');

      const { data: openPositions } = await supabase.from('scalping_trades').select('*').eq('status', 'open');

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

        // Tight stop: -2% immediate full exit
        if (pnlPct <= -2) {
          shouldClose = true;
          closeReason = `[${timeStr}] $${symbol} 강제 손절 (-2% 도달: ${pnlPct.toFixed(2)}%)`;
          newStatus = 'stopped';
        }
        // Score-based exit: score < 60
        else if (quantScore !== undefined && quantScore < 60) {
          shouldClose = true;
          closeReason = `[${timeStr}] $${symbol} 점수 급락 청산 (점수: ${quantScore} < 60)`;
          newStatus = 'score_exit';
        }
        // Time-cut: 15 minutes without profit
        else if (pos.time_limit_at && now >= new Date(pos.time_limit_at) && pnlPct <= 0.5) {
          shouldClose = true;
          closeReason = `[${timeStr}] $${symbol} 15분 타임컷 (수익 미달: ${pnlPct.toFixed(2)}%)`;
          newStatus = 'time_cut';
        }
        // Trailing stop
        else if (pos.stop_loss && price <= pos.stop_loss) {
          shouldClose = true;
          closeReason = `[${timeStr}] $${symbol} 추격 손절 터치 ($${pos.stop_loss})`;
          newStatus = 'stopped';
        }
        // Take profit
        else if (pos.take_profit && price >= pos.take_profit) {
          shouldClose = true;
          closeReason = `[${timeStr}] $${symbol} 목표가 도달 ($${pos.take_profit})`;
          newStatus = 'profit_taken';
        }

        // Partial exit: 2-3% profit → sell 30%
        if (!shouldClose && pnlPct >= 2) {
          const partialExits = pos.partial_exits || [];
          const hasFirstPartial = partialExits.some((e: any) => e.type === 'first_partial');
          if (!hasFirstPartial) {
            const sellQty = Math.floor(pos.quantity * 0.3);
            if (sellQty > 0) {
              const partialPnl = (price - pos.price) * sellQty;
              partialExits.push({ type: 'first_partial', qty: sellQty, price, pnl: +partialPnl.toFixed(2), at: now.toISOString() });
              await supabase.from('scalping_trades').update({
                quantity: pos.quantity - sellQty,
                partial_exits: partialExits,
              }).eq('id', pos.id);
              await supabase.from('scalping_wallet').update({
                balance: wallet.balance + (sellQty * price),
                updated_at: now.toISOString(),
              }).eq('id', wallet.id);
              wallet.balance += sellQty * price;
              closedTrades.push({ symbol: pos.symbol, type: 'partial', pnl: partialPnl, reason: `[${timeStr}] $${symbol} 선제 익절 30% (수익률: ${pnlPct.toFixed(1)}%)` });
            }
          }
        }

        if (shouldClose) {
          const pnl = (price - pos.price) * pos.quantity;
          await supabase.from('scalping_trades').update({
            status: newStatus, close_price: price, pnl: +pnl.toFixed(2),
            closed_at: now.toISOString(), ai_reason: closeReason,
          }).eq('id', pos.id);
          await supabase.from('scalping_wallet').update({
            balance: wallet.balance + (pos.price * pos.quantity) + pnl,
            updated_at: now.toISOString(),
          }).eq('id', wallet.id);
          wallet.balance += (pos.price * pos.quantity) + pnl;
          closedTrades.push({ ...pos, pnl: +pnl.toFixed(2), closeReason });
        }
      }

      // === Entry: only for < $10 stocks ===
      if (price >= 10) {
        return new Response(JSON.stringify({
          decision: { action: 'SKIP', reason: '주가 $10 이상: 스캘핑 대상 외' },
          trade: null, closedTrades, wallet,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const alreadyHolding = (openPositions || []).some(p => p.symbol === symbol && p.status === 'open');
      const openCount = (openPositions || []).filter(p => p.status === 'open').length;

      // Conditions: score >= 50, RVOL > 2.0 (volume surge), above VWAP
      const meetsScore = quantScore !== undefined && quantScore >= 50;
      const rvolSurge = indicators?.rvol?.rvol >= 2.0;
      const aboveVwap = indicators?.candle?.score >= 4;
      const canEnter = meetsScore && rvolSurge && aboveVwap && !alreadyHolding && openCount < 10;

      let trade = null;
      let decision = { action: 'HOLD', confidence: 0, reason: '조건 미충족', quantity: 0 };

      if (canEnter) {
        // Position size: 10% of scalping wallet
        const maxInvestment = wallet.balance * 0.10;
        const qty = Math.floor(maxInvestment / price);

        if (qty > 0 && qty * price <= wallet.balance) {
          const atr = indicators?.atr?.atr || price * 0.02;
          const stopLoss = +(price * 0.98).toFixed(4); // -2% hard stop
          const takeProfit = +(price * 1.05).toFixed(4);
          const timeLimitAt = new Date(now.getTime() + 15 * 60 * 1000).toISOString(); // 15min time-cut

          const { data: newTrade } = await supabase.from('scalping_trades').insert({
            symbol, side: 'buy', quantity: qty, price,
            stop_loss: stopLoss, take_profit: takeProfit, status: 'open',
            entry_score: quantScore,
            time_limit_at: timeLimitAt,
            ai_reason: `[SCALP|Score:${quantScore}] [${timeStr}] $${symbol} 스캘핑 매수 (RVOL: ${indicators?.rvol?.rvol?.toFixed(1)}x, 근거: ${indicators?.rvol?.details || 'volume surge'})`,
            ai_confidence: quantScore || 50,
          }).select().single();

          await supabase.from('scalping_wallet').update({
            balance: wallet.balance - (qty * price), updated_at: now.toISOString(),
          }).eq('id', wallet.id);

          trade = newTrade;
          decision = { action: 'BUY', confidence: quantScore || 50, reason: `스캘핑 진입 (Score:${quantScore}, RVOL:${indicators?.rvol?.rvol?.toFixed(1)}x)`, quantity: qty };
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
        const unrealizedPnl = (currentPrice - pos.price) * pos.quantity;
        const unrealizedPnlPct = ((currentPrice - pos.price) / pos.price) * 100;
        const timeElapsed = pos.opened_at ? Math.round((Date.now() - new Date(pos.opened_at).getTime()) / 60000) : 0;
        return { ...pos, currentPrice, unrealizedPnl: +unrealizedPnl.toFixed(2), unrealizedPnlPct: +unrealizedPnlPct.toFixed(2), timeElapsedMin: timeElapsed };
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
          winRate: +winRate.toFixed(1), totalPnl: +totalPnl.toFixed(2), totalUnrealizedPnl: +totalUnrealizedPnl.toFixed(2),
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

    return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('AI Trading error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
