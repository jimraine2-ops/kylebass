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
    const { action, symbol, price, chartData, quantScore, indicators } = await req.json();

    if (action === 'analyze-and-trade') {
      const { data: wallet } = await supabase.from('ai_wallet').select('*').limit(1).single();
      if (!wallet) throw new Error('No wallet found');

      const { data: openPositions } = await supabase.from('ai_trades').select('*').eq('status', 'open');

      // === Exit Algorithm: Check stop-loss / take-profit / score-based exit ===
      const closedTrades: any[] = [];
      for (const pos of (openPositions || [])) {
        let shouldClose = false;
        let closeReason = '';
        let newStatus = 'closed';

        // Price-based stop-loss
        if (pos.stop_loss && price <= pos.stop_loss && pos.symbol === symbol) {
          shouldClose = true;
          closeReason = `손절가 $${pos.stop_loss} 도달 (0.1초 내 전량 매도)`;
          newStatus = 'stopped';
        }
        // Take-profit: 50% at first target
        else if (pos.take_profit && price >= pos.take_profit && pos.symbol === symbol) {
          shouldClose = true;
          closeReason = `1차 목표가 $${pos.take_profit} 도달 (익절)`;
          newStatus = 'profit_taken';
        }
        // Logic-based exit: score below 60
        else if (quantScore !== undefined && quantScore < 60 && pos.symbol === symbol) {
          shouldClose = true;
          closeReason = `지표 점수 ${quantScore}점 (<60) 급락 즉시 매도`;
          newStatus = 'score_exit';
        }

        if (shouldClose && pos.symbol === symbol) {
          const pnl = (price - pos.price) * pos.quantity;
          await supabase.from('ai_trades').update({
            status: newStatus,
            close_price: price,
            pnl,
            closed_at: new Date().toISOString(),
            ai_reason: closeReason,
          }).eq('id', pos.id);

          await supabase.from('ai_wallet').update({
            balance: wallet.balance + (pos.price * pos.quantity) + pnl,
            updated_at: new Date().toISOString(),
          }).eq('id', wallet.id);

          wallet.balance += (pos.price * pos.quantity) + pnl;
          closedTrades.push({ ...pos, pnl, closeReason });
        }
      }

      // === Entry Algorithm: Selective Aggression Strategy ===
      const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
      if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

      const alreadyHolding = (openPositions || []).some(p => p.symbol === symbol && p.status === 'open');
      const openCount = (openPositions || []).filter(p => p.status === 'open').length;
      const availableBalance = wallet.balance;

      // Entry threshold: quant score >= 85
      const meetsScoreThreshold = quantScore !== undefined ? quantScore >= 85 : true;
      // Check mandatory overlap conditions
      const sentimentTier1 = indicators?.sentiment?.score >= 7;
      const rvolAbove3 = indicators?.rvol?.rvol >= 3.0;
      const aggressionAbove80 = indicators?.aggression?.score >= 8;
      const mandatoryConditions = sentimentTier1 && rvolAbove3 && aggressionAbove80;

      const prompt = `You are an AI quant trading analyst. Analyze this stock and decide whether to BUY, SELL, or HOLD.

Symbol: ${symbol}
Current Price: $${price}
Available Balance: $${availableBalance.toFixed(2)}
Already Holding: ${alreadyHolding ? 'Yes' : 'No'}
Open Positions: ${openCount}/5
Quant Score: ${quantScore || 'N/A'}/100
Score Threshold Met (>=85): ${meetsScoreThreshold}
Mandatory Conditions Met: ${mandatoryConditions ? 'Yes' : 'No'}
Indicator Details: ${JSON.stringify(indicators || {})}
Recent Price Data: ${JSON.stringify(chartData?.slice(-10) || [])}

Rules:
- Only BUY if quant score >= 85 AND mandatory conditions met (sentiment Tier1 + RVOL>3 + aggression>80%)
- If score >= 95, allow up to 30% position size instead of 20%
- Maximum 5 simultaneous positions
- Stop loss: entry - 2*ATR or 5% below entry
- Take profit: 10% above entry (1st target)
- If already holding and score >= 80, consider pyramiding (additional buy)

Respond with JSON ONLY:
{"action": "BUY"|"SELL"|"HOLD", "confidence": 0-100, "reason": "specific indicator-based explanation", "quantity": number, "stopLoss": number, "takeProfit": number}`;

      const aiResponse = await fetch(AI_GATEWAY, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-3-flash-preview',
          messages: [{ role: 'user', content: prompt }],
        }),
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

      if (decision.action === 'BUY' && decision.confidence >= 50 && !alreadyHolding && openCount < 5 && meetsScoreThreshold) {
        // Position Sizing: 20% default, 30% if score >= 95
        const maxPct = (quantScore && quantScore >= 95) ? 0.30 : 0.20;
        const maxInvestment = availableBalance * maxPct;
        const qty = Math.min(decision.quantity || Math.floor(maxInvestment / price), Math.floor(maxInvestment / price));

        if (qty > 0 && qty * price <= availableBalance) {
          const stopLoss = decision.stopLoss || +(price * 0.95).toFixed(4);
          const takeProfit = decision.takeProfit || +(price * 1.10).toFixed(4);

          const { data: newTrade } = await supabase.from('ai_trades').insert({
            symbol,
            side: 'buy',
            quantity: qty,
            price,
            stop_loss: stopLoss,
            take_profit: takeProfit,
            status: 'open',
            ai_reason: `[Score:${quantScore || 'N/A'}] ${decision.reason}`,
            ai_confidence: decision.confidence,
          }).select().single();

          await supabase.from('ai_wallet').update({
            balance: availableBalance - (qty * price),
            updated_at: new Date().toISOString(),
          }).eq('id', wallet.id);

          trade = newTrade;
        }
      }

      return new Response(JSON.stringify({
        decision,
        trade,
        closedTrades,
        wallet: { ...wallet, balance: trade ? availableBalance - (trade.quantity * trade.price) : wallet.balance },
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'get-portfolio') {
      const { data: wallet } = await supabase.from('ai_wallet').select('*').limit(1).single();
      const { data: openPositions } = await supabase.from('ai_trades').select('*').eq('status', 'open').order('opened_at', { ascending: false });
      const { data: allTrades } = await supabase.from('ai_trades').select('*').neq('status', 'open').order('closed_at', { ascending: false }).limit(50);

      const closedTrades = allTrades || [];
      const wins = closedTrades.filter(t => (t.pnl || 0) > 0).length;
      const losses = closedTrades.filter(t => (t.pnl || 0) <= 0).length;
      const totalClosed = closedTrades.length;
      const winRate = totalClosed > 0 ? (wins / totalClosed) * 100 : 0;
      const totalPnl = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
      const grossProfit = closedTrades.filter(t => (t.pnl || 0) > 0).reduce((s, t) => s + t.pnl, 0);
      const grossLoss = Math.abs(closedTrades.filter(t => (t.pnl || 0) < 0).reduce((s, t) => s + t.pnl, 0));
      const profitFactor = grossLoss > 0 ? +(grossProfit / grossLoss).toFixed(2) : grossProfit > 0 ? 999 : 0;

      const avgHoldTime = closedTrades.length > 0
        ? closedTrades.reduce((sum, t) => {
            if (t.opened_at && t.closed_at) return sum + (new Date(t.closed_at).getTime() - new Date(t.opened_at).getTime());
            return sum;
          }, 0) / closedTrades.length / 60000
        : 0;

      const bestTrade = closedTrades.reduce((best, t) => (!best || (t.pnl || 0) > (best.pnl || 0)) ? t : best, null as any);

      return new Response(JSON.stringify({
        wallet,
        openPositions: openPositions || [],
        closedTrades,
        stats: {
          winRate: +winRate.toFixed(1),
          totalPnl: +totalPnl.toFixed(2),
          totalTrades: totalClosed,
          wins,
          losses,
          profitFactor,
          avgHoldTimeMinutes: +avgHoldTime.toFixed(1),
          bestTrade,
          cumulativeReturn: wallet ? +((wallet.balance - wallet.initial_balance) / wallet.initial_balance * 100).toFixed(2) : 0,
        }
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'reset-wallet') {
      await supabase.from('ai_trades').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('ai_wallet').update({ balance: 10000, initial_balance: 10000, updated_at: new Date().toISOString() }).not('id', 'is', null);
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('AI Trading error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
