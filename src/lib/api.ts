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

// ==================== UNIFIED PORTFOLIO ====================
export async function getUnifiedPortfolio() {
  try {
    const { data, error } = await supabase.functions.invoke('ai-trading', {
      body: { action: 'get-unified-portfolio' },
    });
    if (error) {
      console.warn('[getUnifiedPortfolio] ai-trading unavailable, using safe fallback:', error.message ?? error);
      return { wallet: null, openPositions: [], closedTrades: [], stats: {}, fallback: true };
    }
    return data ?? { wallet: null, openPositions: [], closedTrades: [], stats: {}, fallback: true };
  } catch (error) {
    console.warn('[getUnifiedPortfolio] request failed, using safe fallback:', error);
    return { wallet: null, openPositions: [], closedTrades: [], stats: {}, fallback: true };
  }
}

export async function resetUnifiedWallet() {
  const { data, error } = await supabase.functions.invoke('ai-trading', {
    body: { action: 'reset-unified-wallet' },
  });
  if (error) throw error;
  return data;
}

export async function updateUnifiedBalance(newBalance: number) {
  const { data, error } = await supabase.functions.invoke('ai-trading', {
    body: { action: 'update-balance', newBalance },
  });
  if (error) throw error;
  return data;
}

// Legacy - redirect to unified
export async function getAIPortfolio() {
  return getUnifiedPortfolio();
}

export async function getScalpingPortfolio() {
  return getUnifiedPortfolio();
}

export async function resetAIWallet() {
  return resetUnifiedWallet();
}

export async function resetScalpingWallet() {
  return resetUnifiedWallet();
}

export async function updateWalletBalance(_walletType: 'main' | 'scalping', newBalance: number) {
  return updateUnifiedBalance(newBalance);
}

// Super Scanner - Full market 10-indicator scan
export async function fetchSuperScan() {
  const { data, error } = await supabase.functions.invoke('quant-signals', {
    body: { action: 'super-scan' },
  });
  if (error) throw error;
  return data;
}

// Fetch basic financials for value filter
export async function fetchBasicFinancials(symbol: string) {
  const { data, error } = await supabase.functions.invoke('stock-data', {
    body: { action: 'basic-financials', symbol },
  });
  if (error) throw error;
  return data;
}

// Legacy no-ops
export async function aiAnalyzeAndTrade(symbol: string, price: number, chartData?: any[], quantScore?: number, indicators?: any):Promise<any> {
  return { decision: { action: 'HOLD', reason: '통합 엔진으로 이관됨' }, trade: null };
}

export async function scalpingAnalyze(symbol: string, price: number, quantScore?: number, indicators?: any):Promise<any> {
  return { decision: { action: 'HOLD', reason: '통합 엔진으로 이관됨' }, trade: null };
}

export async function quantAutoTrade(symbol: string, price: number, quantScore: number, indicators: any):Promise<any> {
  return { decision: { action: 'HOLD', reason: '통합 엔진으로 이관됨' }, trade: null };
}
