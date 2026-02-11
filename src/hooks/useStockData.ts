import { useQuery } from "@tanstack/react-query";
import { fetchStockQuote, fetchChartData, fetchTechnicalAnalysis, fetchSentimentAnalysis, searchStocks, getMockNewsHeadlines } from "@/lib/api";

export function useStockQuotes(symbols: string[], enabled = true) {
  return useQuery({
    queryKey: ['stock-quotes', symbols.join(',')],
    queryFn: () => fetchStockQuote(symbols),
    refetchInterval: 60000, // 1 minute
    enabled: enabled && symbols.length > 0,
    retry: 2,
  });
}

export function useChartData(symbol: string, enabled = true) {
  return useQuery({
    queryKey: ['chart-data', symbol],
    queryFn: () => fetchChartData(symbol),
    enabled: enabled && !!symbol,
    staleTime: 5 * 60 * 1000, // 5 minutes
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
