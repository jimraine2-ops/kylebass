import { useQuery } from "@tanstack/react-query";
import { fetchStockQuote, fetchChartData, searchStocks, scanPennyStocks, getUnifiedPortfolio, fetchQuantSignals, fetchCompanyNews, fetchSuperScan, fetchEarningsWatch } from "@/lib/api";

export function useStockQuotes(symbols: string[], enabled = true) {
  return useQuery({
    queryKey: ['stock-quotes', symbols.join(',')],
    queryFn: () => fetchStockQuote(symbols),
    refetchInterval: 60000,
    enabled: enabled && symbols.length > 0,
    retry: 2,
  });
}

export function useRealtimeStockQuotes(symbols: string[], enabled = true) {
  return useQuery({
    queryKey: ['realtime-stock-quotes', symbols.join(',')],
    queryFn: () => fetchStockQuote(symbols),
    refetchInterval: 5000,
    enabled: enabled && symbols.length > 0,
    retry: 2,
  });
}

export function useChartData(symbol: string, enabled = true) {
  return useQuery({
    queryKey: ['chart-data', symbol],
    queryFn: () => fetchChartData(symbol),
    enabled: enabled && !!symbol,
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
}

export function useStockSearch(query: string) {
  return useQuery({
    queryKey: ['stock-search', query],
    queryFn: () => searchStocks(query),
    enabled: query.length >= 1,
    staleTime: 30 * 1000,
  });
}

export function usePennyStocks() {
  return useQuery({
    queryKey: ['penny-stocks-top50'],
    queryFn: () => scanPennyStocks(),
    refetchInterval: 10000,
    retry: 3,
    staleTime: 8000,
    refetchOnWindowFocus: false,
  });
}

// ★ 통합 포트폴리오 (기존 대형주/소형주 통합)
export function useUnifiedPortfolio() {
  return useQuery({
    queryKey: ['unified-portfolio'],
    queryFn: () => getUnifiedPortfolio(),
    refetchInterval: 8000,
    retry: 2,
  });
}

// Legacy aliases → unified
export function useAIPortfolio() {
  return useUnifiedPortfolio();
}

export function useScalpingPortfolio() {
  return useUnifiedPortfolio();
}

export function useQuantSignals(symbols?: string[]) {
  return useQuery({
    queryKey: ['quant-signals', symbols?.join(',')],
    queryFn: async () => {
      const data = await fetchQuantSignals(symbols);
      if (symbols && symbols.length > 0 && (!data?.results || data.results.length === 0)) {
        throw new Error('Rate limited - retrying');
      }
      return data;
    },
    staleTime: 60000,
    gcTime: 5 * 60 * 1000,
    refetchInterval: 60000,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(2000 * (attemptIndex + 1), 8000),
  });
}

export function useCompanyNews(symbol: string) {
  return useQuery({
    queryKey: ['company-news', symbol],
    queryFn: () => fetchCompanyNews(symbol),
    enabled: !!symbol,
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
}

export function useSuperScan() {
  return useQuery({
    queryKey: ['super-scan'],
    queryFn: () => fetchSuperScan(),
    refetchInterval: 60000,
    staleTime: 50000,
    retry: 2,
  });
}
