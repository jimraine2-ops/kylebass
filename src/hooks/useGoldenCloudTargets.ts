import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface GoldenCloudTarget {
  symbol: string;
  price: number;
  ema25: number;
  ema200: number;
  kumoTop: number;
  kumoBottom: number;
  emaGapPct: number;
  avgDollarVolUSD: number;
  limitPriceUSD: number;
  capType: 'large' | 'small';
  newsBullishPct: number;
}

/**
 * Fetches the most recent [GoldenCloud] target log and returns a Map keyed by symbol.
 * Used by OpenPositionCard to render Kumo / EMA200 mini chart badges.
 */
export function useGoldenCloudTargets() {
  return useQuery({
    queryKey: ['golden-cloud-targets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agent_logs')
        .select('details')
        .like('message', '[GoldenCloud] ✅%')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      const targets = ((data?.details as any)?.targets || []) as GoldenCloudTarget[];
      const map = new Map<string, GoldenCloudTarget>();
      targets.forEach((t) => map.set(t.symbol, t));
      return map;
    },
    refetchInterval: 10000,
    staleTime: 8000,
  });
}
