import { supabase } from "@/integrations/supabase/client";

const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;

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

// AI Trading
export async function aiAnalyzeAndTrade(symbol: string, price: number, chartData?: any[]) {
  const { data, error } = await supabase.functions.invoke('ai-trading', {
    body: { action: 'analyze-and-trade', symbol, price, chartData },
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

// Mock news headlines (Yahoo Finance news API requires paid access)
export function getMockNewsHeadlines(symbol: string): string[] {
  const headlines: Record<string, string[]> = {
    AAPL: [
      "Apple reports record quarterly revenue driven by iPhone sales",
      "Apple Vision Pro sales exceed expectations in Asian markets",
      "Analysts raise Apple price target following AI integration announcement",
      "Apple supply chain faces challenges amid geopolitical tensions",
      "Apple expands services division with new subscription offerings",
    ],
    MSFT: [
      "Microsoft Azure cloud revenue grows 35% year-over-year",
      "Microsoft Copilot AI adoption accelerates across enterprise clients",
      "Microsoft announces new partnership with OpenAI for enterprise AI",
      "Microsoft stock hits all-time high on strong earnings beat",
      "Regulatory concerns loom over Microsoft's gaming division expansion",
    ],
    NVDA: [
      "NVIDIA's AI chip demand continues to outpace supply",
      "NVIDIA announces next-gen GPU architecture at tech conference",
      "NVIDIA revenue doubles as data center spending surges",
      "Competition heats up as AMD launches rival AI chips",
      "NVIDIA expands into autonomous vehicle computing platform",
    ],
  };
  
  return headlines[symbol] || [
    `${symbol} reports better-than-expected quarterly earnings`,
    `Analysts maintain buy rating on ${symbol} stock`,
    `${symbol} announces strategic partnership in key market`,
    `Market uncertainty affects ${symbol} short-term outlook`,
    `${symbol} expands operations in emerging markets`,
  ];
}
