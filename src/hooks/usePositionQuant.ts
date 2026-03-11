import { useQuery } from "@tanstack/react-query";
import { fetchQuantSignals } from "@/lib/api";

/**
 * Fetches real-time quant indicator data for a single symbol.
 * Auto-refetches every 30s while enabled (modal open).
 */
export function usePositionQuant(symbol: string | null) {
  return useQuery({
    queryKey: ['position-quant', symbol],
    queryFn: async () => {
      if (!symbol) return null;
      const data = await fetchQuantSignals([symbol]);
      const all = [...(data?.results || []), ...(data?.premium || []), ...(data?.penny || [])];
      return all.find((s: any) => s.symbol === symbol) || null;
    },
    enabled: !!symbol,
    refetchInterval: 30000,
    staleTime: 15000,
    retry: 2,
  });
}
