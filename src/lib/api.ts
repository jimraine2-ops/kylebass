import { supabase } from "@/integrations/supabase/client";

export async function fetchStockQuote(symbols: string[]) {
  const { data, error } = await supabase.functions.invoke('stock-data', {
    body: { action: 'quote', symbols },
  });
  if (error) throw error;
  return data?.quotes || [];
}

export async function fetchChartData(symbol: string) {
  const { data, error } = await supabase.functions.invoke('stock-data', {
    body: { action: 'chart', symbol },
  });
  if (error) throw error;
  return data;
}

export async function searchStocks(query: string) {
  const { data, error } = await supabase.functions.invoke('stock-data', {
    body: { action: 'search', symbol: query },
  });
  if (error) throw error;
  return data?.results || [];
}

export async function fetchCompanyNews(symbol: string) {
  const { data, error } = await supabase.functions.invoke('stock-data', {
    body: { action: 'company-news', symbol },
  });
  if (error) throw error;
  return data?.news || [];
}

export async function fetchTechnicalAnalysis(symbol: string, chartData: any[]) {
  const { data, error } = await supabase.functions.invoke('ai-analysis', {
    body: { action: 'technical-analysis', symbol, chartData },
  });
  if (error) throw error;
  return data;
}

export async function fetchSentimentAnalysis(symbol: string, newsHeadlines: string[]) {
  const { data, error } = await supabase.functions.invoke('ai-analysis', {
    body: { action: 'sentiment-analysis', symbol, newsHeadlines },
  });
  if (error) throw error;
  return data;
}

// Penny stocks
export async function scanPennyStocks(minPrice = 0.7, maxPrice = 1.5, volumeMultiplier = 2.0) {
  const { data, error } = await supabase.functions.invoke('penny-stocks', {
    body: { action: 'scan', minPrice, maxPrice, volumeMultiplier },
  });
  if (error) throw error;
  return data;
}

// Quant Signals - 10 Indicator Recommendation
export async function fetchQuantSignals(symbols?: string[]) {
  const { data, error } = await supabase.functions.invoke('quant-signals', {
    body: { action: 'analyze', symbols },
  });
  if (error) throw error;
  return data;
}

// AI Trading
export async function aiAnalyzeAndTrade(symbol: string, price: number, chartData?: any[], quantScore?: number, indicators?: any) {
  const { data, error } = await supabase.functions.invoke('ai-trading', {
    body: { action: 'analyze-and-trade', symbol, price, chartData, quantScore, indicators },
  });
  if (error) throw error;
  return data;
}

export async function getAIPortfolio() {
  const { data, error } = await supabase.functions.invoke('ai-trading', {
    body: { action: 'get-portfolio' },
  });
  if (error) throw error;
  return data;
}

export async function resetAIWallet() {
  const { data, error } = await supabase.functions.invoke('ai-trading', {
    body: { action: 'reset-wallet' },
  });
  if (error) throw error;
  return data;
}

// Mock news headlines (fallback for sentiment analysis)
export function getMockNewsHeadlines(symbol: string): string[] {
  const headlines: Record<string, string[]> = {
    AAPL: [
      "Apple reports record quarterly revenue driven by iPhone sales",
      "Apple Vision Pro sales exceed expectations in Asian markets",
      "Analysts raise Apple price target following AI integration announcement",
    ],
    MSFT: [
      "Microsoft Azure cloud revenue grows 35% year-over-year",
      "Microsoft Copilot AI adoption accelerates across enterprise clients",
    ],
    NVDA: [
      "NVIDIA's AI chip demand continues to outpace supply",
      "NVIDIA revenue doubles as data center spending surges",
    ],
  };
  return headlines[symbol] || [
    `${symbol} reports better-than-expected quarterly earnings`,
    `Analysts maintain buy rating on ${symbol} stock`,
    `${symbol} announces strategic partnership in key market`,
  ];
}
