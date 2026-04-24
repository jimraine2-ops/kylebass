import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ExchangeRateData {
  rate: number;
  timestamp: number;
  fallback?: boolean;
}

const FALLBACK_RATE = 1380;

async function fetchExchangeRate(): Promise<ExchangeRateData> {
  try {
    const { data, error } = await supabase.functions.invoke('exchange-rate', { body: {} });

    // Edge runtime 503/SUPABASE_EDGE_RUNTIME_ERROR — degrade gracefully, never throw.
    if (error) {
      console.warn('[useExchangeRate] edge function unavailable, using fallback:', error?.message ?? error);
      return { rate: FALLBACK_RATE, timestamp: Date.now(), fallback: true };
    }

    const rate = typeof data?.rate === 'number' && data.rate > 0 ? data.rate : FALLBACK_RATE;
    return { rate, timestamp: data?.timestamp ?? Date.now(), fallback: !!data?.fallback };
  } catch (e) {
    console.warn('[useExchangeRate] fetch threw, using fallback:', e);
    return { rate: FALLBACK_RATE, timestamp: Date.now(), fallback: true };
  }
}

export function useExchangeRate() {
  const { data, isLoading } = useQuery({
    queryKey: ['exchange-rate'],
    queryFn: fetchExchangeRate,
    refetchInterval: 60000,
    staleTime: 30000,
    retry: 1,
    // Always resolve — fetcher never throws now, so no error state can blank UI.
  });

  const rate = data?.rate ?? FALLBACK_RATE;
  const toKRW = (usd: number): number => Math.round(usd * rate);

  return {
    rate,
    toKRW,
    isLoading,
    isLive: !!data && !data.fallback,
    lastUpdate: data?.timestamp ?? null,
  };
}
