import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const AI_GATEWAY = 'https://ai.gateway.lovable.dev/v1/chat/completions';
const KRW_RATE = 1350;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || 'report';

    // Fetch all scalping trades
    const { data: allTrades } = await supabase
      .from('scalping_trades')
      .select('*')
      .order('opened_at', { ascending: false })
      .limit(500);

    const trades = allTrades || [];
    const closedTrades = trades.filter(t => t.status !== 'open');
    const openTrades = trades.filter(t => t.status === 'open');

    // === Calculate analytics ===
    const wins = closedTrades.filter(t => (t.pnl || 0) > 0);
    const losses = closedTrades.filter(t => (t.pnl || 0) <= 0);
    const winRate = closedTrades.length > 0 ? +(wins.length / closedTrades.length * 100).toFixed(1) : 0;

    // Daily win rate breakdown (last 7 days)
    const dailyStats: Record<string, { wins: number; losses: number; pnl: number }> = {};
    for (const t of closedTrades) {
      const day = t.closed_at ? new Date(t.closed_at).toISOString().slice(0, 10) : 'unknown';
      if (!dailyStats[day]) dailyStats[day] = { wins: 0, losses: 0, pnl: 0 };
      if ((t.pnl || 0) > 0) dailyStats[day].wins++;
      else dailyStats[day].losses++;
      dailyStats[day].pnl += (t.pnl || 0);
    }

    const dailyChart = Object.entries(dailyStats)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-14)
      .map(([date, s]) => ({
        date: date.slice(5), // MM-DD
        winRate: s.wins + s.losses > 0 ? +((s.wins / (s.wins + s.losses)) * 100).toFixed(1) : 0,
        wins: s.wins,
        losses: s.losses,
        pnl: s.pnl,
      }));

    // === Loss pattern analysis ===
    const lossPatterns: Record<string, number> = {};
    const lossTrades = closedTrades.filter(t => (t.pnl || 0) < 0);
    for (const t of lossTrades) {
      // Categorize by status
      const cat = t.status || 'unknown';
      lossPatterns[cat] = (lossPatterns[cat] || 0) + 1;
    }

    // Sector/symbol frequency in losses
    const lossSymbols: Record<string, { count: number; totalLoss: number }> = {};
    for (const t of lossTrades) {
      if (!lossSymbols[t.symbol]) lossSymbols[t.symbol] = { count: 0, totalLoss: 0 };
      lossSymbols[t.symbol].count++;
      lossSymbols[t.symbol].totalLoss += (t.pnl || 0);
    }
    const worstSymbols = Object.entries(lossSymbols)
      .sort((a, b) => a[1].totalLoss - b[1].totalLoss)
      .slice(0, 5)
      .map(([sym, s]) => ({ symbol: sym, count: s.count, totalLoss: s.totalLoss }));

    // === Profit pattern analysis ===
    const profitSymbols: Record<string, { count: number; totalProfit: number }> = {};
    for (const t of wins) {
      if (!profitSymbols[t.symbol]) profitSymbols[t.symbol] = { count: 0, totalProfit: 0 };
      profitSymbols[t.symbol].count++;
      profitSymbols[t.symbol].totalProfit += (t.pnl || 0);
    }
    const bestSymbols = Object.entries(profitSymbols)
      .sort((a, b) => b[1].totalProfit - a[1].totalProfit)
      .slice(0, 5)
      .map(([sym, s]) => ({ symbol: sym, count: s.count, totalProfit: s.totalProfit }));

    // === Learning metrics ===
    const totalDataPoints = trades.length;
    const optimizationCycles = Math.floor(totalDataPoints / 10); // simulated
    const avgWinPnl = wins.length > 0 ? wins.reduce((s, t) => s + (t.pnl || 0), 0) / wins.length : 0;
    const avgLossPnl = losses.length > 0 ? losses.reduce((s, t) => s + (t.pnl || 0), 0) / losses.length : 0;
    const profitFactor = avgLossPnl !== 0 ? Math.abs(avgWinPnl / avgLossPnl) : 0;

    // === Dynamic threshold recommendation ===
    // If win rate is below 50%, tighten entry; if above 60%, loosen slightly
    let recommendedThreshold = 15; // default entry score
    if (winRate < 40) recommendedThreshold = 20;
    else if (winRate < 50) recommendedThreshold = 18;
    else if (winRate > 65) recommendedThreshold = 12;
    else if (winRate > 55) recommendedThreshold = 14;

    // Expected next trade return based on recent 20 trades
    const recent20 = closedTrades.slice(0, 20);
    const expectedReturn = recent20.length > 0
      ? +(recent20.reduce((s, t) => s + (t.pnl || 0), 0) / recent20.length).toFixed(0)
      : 0;

    // === AI comment generation ===
    let aiComment = '';
    if (action === 'report' && LOVABLE_API_KEY && closedTrades.length >= 3) {
      try {
        const summaryForAI = {
          totalTrades: closedTrades.length,
          winRate,
          profitFactor: +profitFactor.toFixed(2),
          worstSymbols: worstSymbols.slice(0, 3),
          bestSymbols: bestSymbols.slice(0, 3),
          avgWinPnl: Math.round(avgWinPnl),
          avgLossPnl: Math.round(avgLossPnl),
          recentDailyStats: dailyChart.slice(-5),
        };

        const aiRes = await fetch(AI_GATEWAY, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash-lite',
            messages: [
              {
                role: 'system',
                content: '당신은 소형주 초단타 전략 분석 전문가입니다. 간결한 한국어로 매매 데이터를 분석하고 개선 방안을 제시하세요. 3~5문장으로 핵심만 말하세요. 이모지를 활용하세요.',
              },
              {
                role: 'user',
                content: `소형주 스캘핑 매매 성과를 분석해주세요:\n${JSON.stringify(summaryForAI, null, 2)}\n\n1. 현재 성과 한줄 요약\n2. 가장 큰 손실 요인 분석\n3. 수익률 개선을 위한 구체적 제안 1가지`,
              },
            ],
          }),
        });

        if (aiRes.ok) {
          const aiData = await aiRes.json();
          aiComment = aiData.choices?.[0]?.message?.content || '';
        }
      } catch (e) {
        console.error('AI comment error:', e);
        aiComment = `📊 현재 승률 ${winRate}% | 최근 수익 패턴: ${bestSymbols[0]?.symbol || 'N/A'} 섹터 강세`;
      }
    }

    if (!aiComment) {
      aiComment = closedTrades.length < 3
        ? '📊 거래 데이터가 부족합니다. 최소 3건 이상의 완료된 거래가 필요합니다.'
        : `📊 현재 승률 ${winRate}% | 손익비 ${profitFactor.toFixed(2)} | 최적 종목: ${bestSymbols[0]?.symbol || 'N/A'}`;
    }

    // === Loss analysis (오답 노트) ===
    const lossNotes = lossTrades.slice(0, 10).map(t => ({
      symbol: t.symbol,
      entryPrice: t.price,
      exitPrice: t.close_price,
      pnl: t.pnl,
      pnlPct: t.price ? +((((t.close_price || t.price) - t.price) / t.price) * 100).toFixed(2) : 0,
      reason: t.ai_reason || '사유 없음',
      status: t.status,
      entryScore: t.entry_score,
      openedAt: t.opened_at,
      closedAt: t.closed_at,
    }));

    // === Blacklist (진입 금지 종목): symbols with 3+ losses ===
    const blacklist = Object.entries(lossSymbols)
      .filter(([_, s]) => s.count >= 3)
      .map(([sym, s]) => ({ symbol: sym, lossCount: s.count, totalLoss: s.totalLoss }));

    // === Sector weight recommendations ===
    const sectorPerformance: Record<string, { profit: number; trades: number }> = {};
    for (const t of closedTrades) {
      const sym = t.symbol;
      if (!sectorPerformance[sym]) sectorPerformance[sym] = { profit: 0, trades: 0 };
      sectorPerformance[sym].profit += (t.pnl || 0);
      sectorPerformance[sym].trades++;
    }
    const sectorWeights = Object.entries(sectorPerformance)
      .sort((a, b) => b[1].profit - a[1].profit)
      .slice(0, 8)
      .map(([sym, s]) => ({
        symbol: sym,
        avgPnl: +(s.profit / s.trades).toFixed(0),
        trades: s.trades,
        weight: s.profit > 0 ? 'HIGH' : s.profit > -5000 ? 'NORMAL' : 'LOW',
      }));

    return new Response(JSON.stringify({
      summary: {
        totalTrades: closedTrades.length,
        openTrades: openTrades.length,
        winRate,
        wins: wins.length,
        losses: losses.length,
        avgWinPnl: Math.round(avgWinPnl),
        avgLossPnl: Math.round(avgLossPnl),
        profitFactor: +profitFactor.toFixed(2),
        totalDataPoints,
        optimizationCycles,
        recommendedThreshold,
        expectedReturn,
      },
      dailyChart,
      aiComment,
      lossNotes,
      worstSymbols,
      bestSymbols,
      blacklist,
      sectorWeights,
      lossPatterns,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Learning report error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
