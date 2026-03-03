import { useQuery } from "@tanstack/react-query";
import { fetchStockQuote, fetchChartData, searchStocks, scanPennyStocks, getAIPortfolio, fetchQuantSignals, fetchCompanyNews, getScalpingPortfolio } from "@/lib/api";

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
    queryKey: ['penny-stocks-top10'],
    queryFn: () => scanPennyStocks(),
    refetchInterval: 30000,
    retry: 3,
    staleTime: 10000,
    refetchOnWindowFocus: false,
  });
}

export function useAIPortfolio() {
  return useQuery({
    queryKey: ['ai-portfolio'],
    queryFn: () => getAIPortfolio(),
    refetchInterval: 10000,
    retry: 2,
  });
}

export function useScalpingPortfolio() {
  return useQuery({
    queryKey: ['scalping-portfolio'],
    queryFn: () => getScalpingPortfolio(),
    refetchInterval: 5000,
    retry: 2,
  });
}

export function useQuantSignals(symbols?: string[]) {
  return useQuery({
    queryKey: ['quant-signals', symbols?.join(',')],
    queryFn: () => fetchQuantSignals(symbols),
    staleTime: 10000,
    refetchInterval: 30000,
    retry: 1,
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
