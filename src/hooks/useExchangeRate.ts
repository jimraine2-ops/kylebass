import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ExchangeRateData {
  rate: number;
  timestamp: number;
}

async function fetchExchangeRate(): Promise<ExchangeRateData> {
  const { data, error } = await supabase.functions.invoke('exchange-rate', { body: {} });
  if (error) throw error;
  return { rate: data.rate, timestamp: data.timestamp };
}

const FALLBACK_RATE = 1380;

export function useExchangeRate() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['exchange-rate'],
    queryFn: fetchExchangeRate,
    refetchInterval: 60000, // Refresh every 60s
    staleTime: 30000,
    retry: 2,
  });

  const rate = data?.rate ?? FALLBACK_RATE;

  const toKRW = (usd: number): number => Math.round(usd * rate);

  return {
    rate,
    toKRW,
    isLoading,
    isLive: !error && !!data,
    lastUpdate: data?.timestamp ?? null,
  };
}
