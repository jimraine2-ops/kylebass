import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

interface TodayProfitData {
  totalProfitKRW: number;
  roundNumber: number;
  bestTicker: string | null;
  bestPnlPct: number;
  winRate: number;
  totalTrades: number;
  winCount: number;
}

export function useTodayProfit(fxRate: number) {
  const milestonesHit = useRef<Set<number>>(new Set());

  const query = useQuery({
    queryKey: ['today-profit', fxRate],
    queryFn: async (): Promise<TodayProfitData> => {
      // Get today's start (KST = UTC+9)
      const now = new Date();
      const kstOffset = 9 * 60 * 60 * 1000;
      const kstNow = new Date(now.getTime() + kstOffset);
      const kstDateStr = kstNow.toISOString().slice(0, 10);
      const todayStartUTC = new Date(new Date(kstDateStr).getTime() - kstOffset).toISOString();

      // Fetch today's closed trades
      const { data: trades, error } = await supabase
        .from('unified_trades')
        .select('symbol, pnl, price, close_price, status, closed_at')
        .neq('status', 'open')
        .gte('closed_at', todayStartUTC)
        .order('closed_at', { ascending: false });

      if (error) throw error;

      const closedTrades = trades || [];
      let totalPnlUSD = 0;
      let bestTicker: string | null = null;
      let bestPnlPct = 0;
      let winCount = 0;

      for (const t of closedTrades) {
        const pnl = Number(t.pnl) || 0;
        totalPnlUSD += pnl;
        if (pnl > 0) winCount++;

        // Calculate pnl percentage
        if (t.price && t.close_price) {
          const pct = ((Number(t.close_price) - Number(t.price)) / Number(t.price)) * 100;
          if (pct > bestPnlPct) {
            bestPnlPct = pct;
            bestTicker = t.symbol;
          }
        }
      }

      // Detect round number from agent_logs
      const { data: roundLogs } = await supabase
        .from('agent_logs')
        .select('message')
        .like('message', '%Round%완료%')
        .gte('created_at', todayStartUTC)
        .order('created_at', { ascending: false })
        .limit(1);

      let roundNumber = 1;
      if (roundLogs && roundLogs.length > 0) {
        const match = roundLogs[0].message.match(/Round\s*(\d+)/i);
        if (match) {
          roundNumber = parseInt(match[1]) + 1; // Currently on next round
        }
      }

      const totalProfitKRW = Math.round(totalPnlUSD * fxRate);

      return {
        totalProfitKRW,
        roundNumber,
        bestTicker,
        bestPnlPct,
        winRate: closedTrades.length > 0 ? (winCount / closedTrades.length) * 100 : 100,
        totalTrades: closedTrades.length,
        winCount,
      };
    },
    refetchInterval: 8000,
    retry: 2,
    enabled: fxRate > 0,
  });

  // Milestone toasts
  useEffect(() => {
    const profit = query.data?.totalProfitKRW ?? 0;
    const milestones = [100000, 300000, 500000, 1000000, 2000000, 5000000];
    for (const m of milestones) {
      if (profit >= m && !milestonesHit.current.has(m)) {
        milestonesHit.current.add(m);
        toast.success(`🎉 누적 수익 ₩${m.toLocaleString('ko-KR')} 돌파!`, {
          description: `오늘 총 수익: ₩${profit.toLocaleString('ko-KR')}`,
          duration: 8000,
        });
      }
    }
  }, [query.data?.totalProfitKRW]);

  return query;
}
