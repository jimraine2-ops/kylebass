import { useQuery } from "@tanstack/react-query";
import { fetchBasicFinancials } from "@/lib/api";

export interface ValueGradeResult {
  grade: string;
  score: number;
  cashFlowOk: boolean;
  revenueGrowth: boolean;
  perUndervalued: boolean;
  peRatio: string | number;
  currentRatio: number;
}

function computeValueGrade(metric: any): ValueGradeResult {
  if (!metric) return { grade: 'N/A', score: 0, cashFlowOk: false, revenueGrowth: false, perUndervalued: false, peRatio: 'N/A', currentRatio: 0 };

  let valueScore = 0;

  const cashFlowPerShare = metric.cashFlowPerShareAnnual || metric.cashFlowPerShareTTM || 0;
  const currentRatio = metric.currentRatioAnnual || metric.currentRatioQuarterly || 0;
  const cashFlowOk = cashFlowPerShare > 0 || currentRatio >= 1.0;
  if (cashFlowOk) valueScore += 35;

  const revenueGrowthQoQ = metric.revenueGrowthQuarterlyYoy || metric.revenueGrowth3Y || metric.revenueGrowth5Y || 0;
  const revenueGrowth = revenueGrowthQoQ > 0;
  if (revenueGrowth) valueScore += 35;

  const peRatio = metric.peAnnual || metric.peBasicExclExtraTTM || metric.peTTM || 0;
  const perUndervalued = peRatio > 0 ? peRatio < 50 : true;
  if (perUndervalued) valueScore += 30;

  const grade = valueScore >= 80 ? 'A' : valueScore >= 50 ? 'B' : valueScore >= 35 ? 'C' : 'D';

  return {
    grade,
    score: valueScore,
    cashFlowOk,
    revenueGrowth,
    perUndervalued,
    peRatio: peRatio > 0 ? +peRatio.toFixed(1) : 'N/A(적자)',
    currentRatio: +currentRatio.toFixed(2),
  };
}

/**
 * Fetches basic financials and computes value grade for a symbol.
 * Cached for 10 minutes.
 */
export function useValueGrade(symbol: string | null) {
  return useQuery({
    queryKey: ['value-grade', symbol],
    queryFn: async (): Promise<ValueGradeResult> => {
      if (!symbol) return { grade: 'N/A', score: 0, cashFlowOk: false, revenueGrowth: false, perUndervalued: false, peRatio: 'N/A', currentRatio: 0 };
      const data = await fetchBasicFinancials(symbol);
      return computeValueGrade(data?.metric);
    },
    enabled: !!symbol,
    staleTime: 600000, // 10 min
    refetchInterval: 600000,
    retry: 1,
  });
}

/**
 * Batch hook: compute value grades for multiple symbols.
 */
export function useValueGrades(symbols: string[]) {
  return useQuery({
    queryKey: ['value-grades', symbols.sort().join(',')],
    queryFn: async (): Promise<Record<string, ValueGradeResult>> => {
      const results: Record<string, ValueGradeResult> = {};
      // Fetch in parallel, max 5 at a time
      for (let i = 0; i < symbols.length; i += 5) {
        const batch = symbols.slice(i, i + 5);
        const promises = batch.map(async (sym) => {
          try {
            const data = await fetchBasicFinancials(sym);
            results[sym] = computeValueGrade(data?.metric);
          } catch {
            results[sym] = { grade: 'N/A', score: 0, cashFlowOk: false, revenueGrowth: false, perUndervalued: false, peRatio: 'N/A', currentRatio: 0 };
          }
        });
        await Promise.all(promises);
      }
      return results;
    },
    enabled: symbols.length > 0,
    staleTime: 600000,
    refetchInterval: 600000,
    retry: 1,
  });
}
