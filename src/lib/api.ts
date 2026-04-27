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
const QUANT_SIGNALS_CACHE_TTL = 60_000;
const quantSignalsCache = new Map<string, { data: any; ts: number }>();
const quantSignalsInFlight = new Map<string, Promise<any>>();

function getQuantSignalsKey(symbols?: string[]) {
  if (!symbols?.length) return '__default__';
  return symbols.map((s) => String(s).trim().toUpperCase()).filter(Boolean).sort().join(',');
}

function emptyQuantSignals(symbols?: string[]) {
  return {
    premium: [],
    penny: [],
    recommendations: [],
    results: [],
    allScanned: symbols?.length ?? 0,
    fallback: true,
  };
}

export async function fetchQuantSignals(symbols?: string[]) {
  const key = getQuantSignalsKey(symbols);
  const cached = quantSignalsCache.get(key);
  if (cached && Date.now() - cached.ts < QUANT_SIGNALS_CACHE_TTL) return cached.data;

  const inFlight = quantSignalsInFlight.get(key);
  if (inFlight) return inFlight;

  const promise = supabase.functions.invoke('quant-signals', {
    body: { action: 'analyze', symbols: symbols?.slice(0, 12) },
  }).then(({ data, error }) => {
    if (error) throw error;
    const safeData = data || emptyQuantSignals(symbols);
    quantSignalsCache.set(key, { data: safeData, ts: Date.now() });
    return safeData;
  }).catch((error) => {
    console.warn('[fetchQuantSignals] using safe fallback:', error);
    return quantSignalsCache.get(key)?.data || emptyQuantSignals(symbols);
  }).finally(() => {
    quantSignalsInFlight.delete(key);
  });

  quantSignalsInFlight.set(key, promise);
  return promise;
}

// ==================== UNIFIED PORTFOLIO ====================
export async function getUnifiedPortfolio(): Promise<any> {
  try {
    const [{ data: wallet }, { data: openPositions }, { data: closedTrades }] = await Promise.all([
      supabase.from('unified_wallet').select('*').limit(1).maybeSingle(),
      supabase.from('unified_trades').select('*').eq('status', 'open').order('opened_at', { ascending: false }),
      supabase.from('unified_trades').select('*').neq('status', 'open').order('closed_at', { ascending: false }).limit(100),
    ]);

    const enrichedPositions = (openPositions || []).map((pos: any) => ({
      ...pos,
      currentPrice: pos.price,
      unrealizedPnl: 0,
      unrealizedPnlPct: 0,
      timeElapsedMin: pos.opened_at ? Math.round((Date.now() - new Date(pos.opened_at).getTime()) / 60000) : 0,
      priceKRW: pos.price * 1350,
      currentPriceKRW: pos.price * 1350,
    }));

    const closed = closedTrades || [];
    const wins = closed.filter((t: any) => (t.pnl || 0) > 0).length;
    const losses = closed.filter((t: any) => (t.pnl || 0) <= 0).length;
    const totalPnl = closed.reduce((sum: number, t: any) => sum + (t.pnl || 0), 0);
    const grossProfit = closed.filter((t: any) => (t.pnl || 0) > 0).reduce((sum: number, t: any) => sum + (t.pnl || 0), 0);
    const grossLoss = Math.abs(closed.filter((t: any) => (t.pnl || 0) < 0).reduce((sum: number, t: any) => sum + (t.pnl || 0), 0));
    const avgHoldTimeMinutes = closed.length > 0
      ? closed.reduce((sum: number, t: any) => {
          if (t.opened_at && t.closed_at) return sum + (new Date(t.closed_at).getTime() - new Date(t.opened_at).getTime());
          return sum;
        }, 0) / closed.length / 60000
      : 0;
    const largePnl = closed.filter((t: any) => t.cap_type === 'large').reduce((sum: number, t: any) => sum + (t.pnl || 0), 0);
    const smallPnl = closed.filter((t: any) => t.cap_type === 'small').reduce((sum: number, t: any) => sum + (t.pnl || 0), 0);

    return {
      wallet,
      openPositions: enrichedPositions,
      closedTrades: closed,
      stats: {
        winRate: closed.length > 0 ? +((wins / closed.length) * 100).toFixed(1) : 0,
        totalPnl: +totalPnl.toFixed(0),
        totalUnrealizedPnl: 0,
        totalTrades: closed.length,
        wins,
        losses,
        profitFactor: grossLoss > 0 ? +(grossProfit / grossLoss).toFixed(2) : grossProfit > 0 ? 999 : 0,
        avgHoldTimeMinutes: +avgHoldTimeMinutes.toFixed(1),
        cumulativeReturn: wallet ? +((totalPnl / wallet.initial_balance) * 100).toFixed(2) : 0,
        largeCount: enrichedPositions.filter((p: any) => p.cap_type === 'large').length,
        smallCount: enrichedPositions.filter((p: any) => p.cap_type === 'small').length,
        largePnl,
        smallPnl,
      },
    };
  } catch (error) {
    console.warn('[getUnifiedPortfolio] direct read failed, using safe fallback:', error);
    return {
      wallet: null,
      openPositions: [],
      closedTrades: [],
      fallback: true,
      stats: {
        winRate: 0, totalPnl: 0, totalUnrealizedPnl: 0, totalTrades: 0,
        wins: 0, losses: 0, profitFactor: 0, avgHoldTimeMinutes: 0,
        cumulativeReturn: 0, largeCount: 0, smallCount: 0, largePnl: 0, smallPnl: 0,
      },
    };
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
