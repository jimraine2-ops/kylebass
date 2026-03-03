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
  const news = data?.news || [];
  
  // Translate news to Korean
  if (news.length > 0) {
    try {
      const { data: translated, error: transErr } = await supabase.functions.invoke('translate-news', {
        body: { articles: news },
      });
      if (!transErr && translated?.translated) {
        return translated.translated;
      }
    } catch (e) {
      console.warn('Translation fallback to original:', e);
    }
  }
  return news;
}

// Penny stocks
export async function scanPennyStocks() {
  const { data, error } = await supabase.functions.invoke('penny-stocks', {
    body: { action: 'top50' },
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

// Scalping
export async function getScalpingPortfolio() {
  const { data, error } = await supabase.functions.invoke('ai-trading', {
    body: { action: 'get-scalping-portfolio' },
  });
  if (error) throw error;
  return data;
}

export async function resetScalpingWallet() {
  const { data, error } = await supabase.functions.invoke('ai-trading', {
    body: { action: 'reset-scalping-wallet' },
  });
  if (error) throw error;
  return data;
}

export async function scalpingAnalyze(symbol: string, price: number, quantScore?: number, indicators?: any) {
  const { data, error } = await supabase.functions.invoke('ai-trading', {
    body: { action: 'scalping-analyze', symbol, price, quantScore, indicators },
  });
  if (error) throw error;
  return data;
}

// Quant 10-Indicator Auto Trading (uses Main wallet)
export async function quantAutoTrade(symbol: string, price: number, quantScore: number, indicators: any) {
  const { data, error } = await supabase.functions.invoke('ai-trading', {
    body: { action: 'quant-auto-trade', symbol, price, quantScore, indicators },
  });
  if (error) throw error;
  return data;
}

// Update wallet balance
export async function updateWalletBalance(walletType: 'main' | 'scalping', newBalance: number) {
  const { data, error } = await supabase.functions.invoke('ai-trading', {
    body: { action: 'update-balance', walletType, newBalance },
  });
  if (error) throw error;
  return data;
}

