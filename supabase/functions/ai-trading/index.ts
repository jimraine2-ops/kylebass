import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const FINNHUB_BASE = 'https://finnhub.io/api/v1';
const KRW_RATE = 1350;

function toKRW(usd: number): number { return usd * KRW_RATE; }
function fmtKRW(usd: number): string { return `₩${toKRW(usd).toLocaleString('ko-KR', { maximumFractionDigits: 0 })}`; }
function fmtKRWRaw(krw: number): string { return `₩${krw.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}`; }

function getFinnhubToken(): string { return Deno.env.get('FINNHUB_API_KEY') || ''; }

async function finnhubFetch(path: string) {
  const token = getFinnhubToken();
  if (!token) return null;
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`${FINNHUB_BASE}${path}${sep}token=${token}`);
  if (!res.ok) return null;
  return res.json();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body = await req.json();
    const { action } = body;

    const ALLOWED_ACTIONS = ['get-unified-portfolio', 'reset-unified-wallet', 'update-balance', 'manual-buy',
      // Legacy actions kept for backward compatibility during transition
      'get-portfolio', 'reset-wallet', 'get-scalping-portfolio', 'reset-scalping-wallet',
      'analyze-and-trade', 'scalping-analyze', 'quant-auto-trade'];
    if (!action || typeof action !== 'string' || !ALLOWED_ACTIONS.includes(action)) {
      return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ==================== UNIFIED PORTFOLIO ====================
    if (action === 'get-unified-portfolio') {
      const { data: wallet } = await supabase.from('unified_wallet').select('*').limit(1).single();
      const { data: openPositions } = await supabase.from('unified_trades').select('*').eq('status', 'open').order('opened_at', { ascending: false });
      const { data: allTrades } = await supabase.from('unified_trades').select('*').neq('status', 'open').order('closed_at', { ascending: false }).limit(100);

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
        return {
          ...pos, currentPrice,
          unrealizedPnl: +unrealizedPnl.toFixed(0),
          unrealizedPnlPct: +unrealizedPnlPct.toFixed(2),
          timeElapsedMin: timeElapsed,
          priceKRW: toKRW(pos.price),
          currentPriceKRW: toKRW(currentPrice),
        };
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

      // Per cap-type stats
      const largeTrades = closedTrades.filter(t => t.cap_type === 'large');
      const smallTrades = closedTrades.filter(t => t.cap_type === 'small');
      const largePositions = enrichedPositions.filter(p => p.cap_type === 'large');
      const smallPositions = enrichedPositions.filter(p => p.cap_type === 'small');

      return new Response(JSON.stringify({
        wallet, openPositions: enrichedPositions, closedTrades,
        stats: {
          winRate: +winRate.toFixed(1), totalPnl: +totalPnl.toFixed(0), totalUnrealizedPnl: +totalUnrealizedPnl.toFixed(0),
          totalTrades: totalClosed, wins, losses, profitFactor, avgHoldTimeMinutes: +avgHoldTime.toFixed(1), bestTrade,
          cumulativeReturn: wallet ? +((totalPnl) / wallet.initial_balance * 100).toFixed(2) : 0,
          largeCount: largePositions.length,
          smallCount: smallPositions.length,
          largePnl: largeTrades.reduce((s, t) => s + (t.pnl || 0), 0),
          smallPnl: smallTrades.reduce((s, t) => s + (t.pnl || 0), 0),
        }
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ==================== RESET UNIFIED WALLET ====================
    if (action === 'reset-unified-wallet') {
      await supabase.from('unified_trades').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('unified_wallet').update({
        balance: 1000000, initial_balance: 1000000, updated_at: new Date().toISOString()
      }).not('id', 'is', null);
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ==================== UPDATE WALLET BALANCE ====================
    if (action === 'update-balance') {
      const { newBalance } = body;
      if (typeof newBalance !== 'number' || newBalance < 0 || newBalance > 999999999) {
        return new Response(JSON.stringify({ error: 'Invalid balance value' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      const roundedBalance = Math.round(newBalance);
      const { error } = await supabase.from('unified_wallet').update({
        balance: roundedBalance, updated_at: new Date().toISOString()
      }).not('id', 'is', null);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, balance: roundedBalance }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ==================== LEGACY: get-portfolio (redirect to unified) ====================
    if (action === 'get-portfolio' || action === 'get-scalping-portfolio') {
      // Redirect to unified
      const { data: wallet } = await supabase.from('unified_wallet').select('*').limit(1).single();
      const { data: openPositions } = await supabase.from('unified_trades').select('*').eq('status', 'open').order('opened_at', { ascending: false });
      const { data: allTrades } = await supabase.from('unified_trades').select('*').neq('status', 'open').order('closed_at', { ascending: false }).limit(50);

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
        return { ...pos, currentPrice, unrealizedPnl: +unrealizedPnl.toFixed(0), unrealizedPnlPct: +unrealizedPnlPct.toFixed(2), timeElapsedMin: timeElapsed };
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

      return new Response(JSON.stringify({
        wallet, openPositions: enrichedPositions, closedTrades,
        stats: {
          winRate: +winRate.toFixed(1), totalPnl: +totalPnl.toFixed(0), totalUnrealizedPnl: +totalUnrealizedPnl.toFixed(0),
          totalTrades: totalClosed, wins, losses, profitFactor,
          cumulativeReturn: wallet ? +((totalPnl) / wallet.initial_balance * 100).toFixed(2) : 0,
        }
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'reset-wallet' || action === 'reset-scalping-wallet') {
      await supabase.from('unified_trades').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('unified_wallet').update({ balance: 1000000, initial_balance: 1000000, updated_at: new Date().toISOString() }).not('id', 'is', null);
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Legacy analyze actions - no-op since cloud-agent handles all trading
    if (action === 'analyze-and-trade' || action === 'scalping-analyze' || action === 'quant-auto-trade') {
      return new Response(JSON.stringify({
        decision: { action: 'HOLD', reason: '통합 엔진으로 이관됨 — Cloud Agent가 자율 매매 중', confidence: 0, quantity: 0 },
        trade: null, closedTrades: [], wallet: null,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('AI Trading error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
