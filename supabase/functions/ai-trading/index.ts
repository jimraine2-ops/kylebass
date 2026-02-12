import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { action, symbol, price, chartData } = await req.json();

    if (action === 'analyze-and-trade') {
      // Get wallet
      const { data: wallet } = await supabase.from('ai_wallet').select('*').limit(1).single();
      if (!wallet) throw new Error('No wallet found');

      // Get open positions
      const { data: openPositions } = await supabase
        .from('ai_trades')
        .select('*')
        .eq('status', 'open');

      // Check if we need to close any positions (stop-loss / take-profit)
      const closedTrades: any[] = [];
      for (const pos of (openPositions || [])) {
        const currentPrice = price;
        let shouldClose = false;
        let closeReason = '';
        let newStatus = 'closed';

        if (pos.stop_loss && currentPrice <= pos.stop_loss) {
          shouldClose = true;
          closeReason = `손절가 ${pos.stop_loss} 도달`;
          newStatus = 'stopped';
        } else if (pos.take_profit && currentPrice >= pos.take_profit) {
          shouldClose = true;
          closeReason = `익절가 ${pos.take_profit} 도달`;
          newStatus = 'profit_taken';
        }

        if (shouldClose && pos.symbol === symbol) {
          const pnl = (currentPrice - pos.price) * pos.quantity;
          await supabase.from('ai_trades').update({
            status: newStatus,
            close_price: currentPrice,
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

      // Use AI to decide whether to trade
      const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
      if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

      const alreadyHolding = (openPositions || []).some(p => p.symbol === symbol && p.status === 'open');
      const availableBalance = wallet.balance;

      const prompt = `You are an AI stock trading analyst. Analyze this penny stock and decide whether to BUY, SELL, or HOLD.

Symbol: ${symbol}
Current Price: $${price}
Available Balance: $${availableBalance.toFixed(2)}
Already Holding: ${alreadyHolding ? 'Yes' : 'No'}
Recent Price Data: ${JSON.stringify(chartData?.slice(-10) || [])}

Rules:
- Only recommend BUY if confidence is above 50%
- Set stop_loss at 5% below entry price
- Set take_profit at 10% above entry price
- Never risk more than 20% of available balance on a single trade
- Consider volume trends and price momentum

Respond with a JSON object ONLY (no markdown):
{"action": "BUY"|"SELL"|"HOLD", "confidence": 0-100, "reason": "brief explanation", "quantity": number_of_shares}`;

      const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
        if (status === 429) {
          return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
            status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        if (status === 402) {
          return new Response(JSON.stringify({ error: 'Payment required' }), {
            status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        throw new Error(`AI error: ${status}`);
      }

      const aiData = await aiResponse.json();
      let content = aiData.choices?.[0]?.message?.content || '';
      
      // Parse JSON from response
      content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      let decision;
      try {
        decision = JSON.parse(content);
      } catch {
        decision = { action: 'HOLD', confidence: 0, reason: 'Failed to parse AI response', quantity: 0 };
      }

      let trade = null;

      if (decision.action === 'BUY' && decision.confidence >= 50 && !alreadyHolding) {
        const maxInvestment = availableBalance * 0.2;
        const qty = Math.min(decision.quantity || Math.floor(maxInvestment / price), Math.floor(maxInvestment / price));
        
        if (qty > 0 && qty * price <= availableBalance) {
          const stopLoss = +(price * 0.95).toFixed(4);
          const takeProfit = +(price * 1.10).toFixed(4);
          
          const { data: newTrade } = await supabase.from('ai_trades').insert({
            symbol,
            side: 'buy',
            quantity: qty,
            price,
            stop_loss: stopLoss,
            take_profit: takeProfit,
            status: 'open',
            ai_reason: decision.reason,
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
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'get-portfolio') {
      const { data: wallet } = await supabase.from('ai_wallet').select('*').limit(1).single();
      const { data: openPositions } = await supabase.from('ai_trades').select('*').eq('status', 'open').order('opened_at', { ascending: false });
      const { data: allTrades } = await supabase.from('ai_trades').select('*').neq('status', 'open').order('closed_at', { ascending: false }).limit(50);
      
      // Stats
      const closedTrades = allTrades || [];
      const wins = closedTrades.filter(t => (t.pnl || 0) > 0).length;
      const totalClosed = closedTrades.length;
      const winRate = totalClosed > 0 ? (wins / totalClosed) * 100 : 0;
      const totalPnl = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
      const avgHoldTime = closedTrades.length > 0
        ? closedTrades.reduce((sum, t) => {
            if (t.opened_at && t.closed_at) {
              return sum + (new Date(t.closed_at).getTime() - new Date(t.opened_at).getTime());
            }
            return sum;
          }, 0) / closedTrades.length / 60000 // in minutes
        : 0;

      // Best performing
      const bestTrade = closedTrades.reduce((best, t) => (!best || (t.pnl || 0) > (best.pnl || 0)) ? t : best, null as any);

      return new Response(JSON.stringify({
        wallet,
        openPositions: openPositions || [],
        closedTrades,
        stats: {
          winRate: +winRate.toFixed(1),
          totalPnl: +totalPnl.toFixed(2),
          totalTrades: totalClosed,
          avgHoldTimeMinutes: +avgHoldTime.toFixed(1),
          bestTrade,
          cumulativeReturn: wallet ? +((wallet.balance - wallet.initial_balance) / wallet.initial_balance * 100).toFixed(2) : 0,
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'reset-wallet') {
      await supabase.from('ai_trades').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('ai_wallet').update({ balance: 10000, initial_balance: 10000, updated_at: new Date().toISOString() }).not('id', 'is', null);
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('AI Trading error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
