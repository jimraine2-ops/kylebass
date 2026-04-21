import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface KumoRetestStats {
  totalLimitOrders: number;
  filledAtOrBelowKumo: number;
  fillAccuracyPct: number;
  avgSlippagePct: number;
  avgSlippageBps: number;
  avgFillVsLimitPct: number;
  recentSamples: Array<{
    symbol: string;
    limitPrice: number;
    fillPrice: number;
    kumoTop?: number;
    slippagePct: number;
    openedAt: string;
  }>;
}

/**
 * Parses unified_trades and agent_logs to compute Kumo-Retest LIMIT order
 * fill accuracy and average slippage vs marching-price (마중가).
 */
export function useKumoRetestStats() {
  return useQuery<KumoRetestStats>({
    queryKey: ["kumo-retest-stats"],
    queryFn: async () => {
      // 1) Pull recent Phase1 LIMIT entries from unified_trades
      const { data: trades } = await supabase
        .from("unified_trades")
        .select("symbol, price, ai_reason, opened_at")
        .ilike("ai_reason", "%마중가%")
        .order("opened_at", { ascending: false })
        .limit(50);

      // 2) Pull recent GoldenCloud target logs to map symbol → kumoTop
      const { data: logs } = await supabase
        .from("agent_logs")
        .select("details, created_at")
        .like("message", "%GoldenCloud%Top%")
        .order("created_at", { ascending: false })
        .limit(40);

      // Build symbol → most recent kumoTop map
      const kumoMap = new Map<string, number>();
      (logs || []).forEach((log: any) => {
        const targets = log?.details?.targets;
        if (!Array.isArray(targets)) return;
        targets.forEach((t: any) => {
          if (t?.symbol && typeof t?.kumoTop === "number" && !kumoMap.has(t.symbol)) {
            kumoMap.set(t.symbol, t.kumoTop);
          }
        });
      });

      const samples: KumoRetestStats["recentSamples"] = [];
      let filledOk = 0;
      const slippages: number[] = [];

      (trades || []).forEach((t: any) => {
        // Extract limit price from ai_reason e.g. "마중가:$1.66"
        const m = t.ai_reason?.match(/마중가:\$(\d+(?:\.\d+)?)/);
        if (!m) return;
        const limitPrice = parseFloat(m[1]);
        const fillPrice = Number(t.price);
        if (!limitPrice || !fillPrice) return;

        // Slippage vs limit (positive = paid more than limit, negative = better)
        const slippagePct = ((fillPrice - limitPrice) / limitPrice) * 100;
        slippages.push(slippagePct);

        const kumoTop = kumoMap.get(t.symbol);
        // Fill is "accurate" if executed at or below limit price (within +0.5% buffer)
        if (slippagePct <= 0.5) filledOk += 1;

        samples.push({
          symbol: t.symbol,
          limitPrice,
          fillPrice,
          kumoTop,
          slippagePct: +slippagePct.toFixed(3),
          openedAt: t.opened_at,
        });
      });

      const total = samples.length;
      const avgSlip = total ? slippages.reduce((s, v) => s + v, 0) / total : 0;
      const fillAcc = total ? (filledOk / total) * 100 : 0;

      return {
        totalLimitOrders: total,
        filledAtOrBelowKumo: filledOk,
        fillAccuracyPct: +fillAcc.toFixed(1),
        avgSlippagePct: +avgSlip.toFixed(3),
        avgSlippageBps: +(avgSlip * 100).toFixed(1),
        avgFillVsLimitPct: +avgSlip.toFixed(3),
        recentSamples: samples.slice(0, 8),
      };
    },
    refetchInterval: 15000,
    retry: 2,
  });
}
