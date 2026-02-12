import { useQuery } from "@tanstack/react-query";
import { fetchStockQuote, fetchChartData, fetchTechnicalAnalysis, fetchSentimentAnalysis, searchStocks, getMockNewsHeadlines, scanPennyStocks, getAIPortfolio } from "@/lib/api";

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
    refetchInterval: 3000, // 3 seconds
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

export function useTechnicalAnalysis(symbol: string, chartData: any[] | undefined) {
  return useQuery({
    queryKey: ['technical-analysis', symbol],
    queryFn: () => fetchTechnicalAnalysis(symbol, chartData!),
    enabled: !!symbol && !!chartData && chartData.length > 0,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export function useSentimentAnalysis(symbol: string) {
  const headlines = getMockNewsHeadlines(symbol);
  return useQuery({
    queryKey: ['sentiment-analysis', symbol],
    queryFn: () => fetchSentimentAnalysis(symbol, headlines),
    enabled: !!symbol,
    staleTime: 10 * 60 * 1000,
    retry: 1,
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

export function usePennyStocks(minPrice = 0.7, maxPrice = 1.5) {
  return useQuery({
    queryKey: ['penny-stocks', minPrice, maxPrice],
    queryFn: () => scanPennyStocks(minPrice, maxPrice),
    refetchInterval: 10000, // 10 seconds
    retry: 2,
  });
}

export function useAIPortfolio() {
  return useQuery({
    queryKey: ['ai-portfolio'],
    queryFn: () => getAIPortfolio(),
    refetchInterval: 5000,
    retry: 2,
  });
}
