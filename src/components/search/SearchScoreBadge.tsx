import { useQuantSignals } from "@/hooks/useStockData";
import { Loader2 } from "lucide-react";

interface Props {
  symbols: string[];
}

function getScoreColor(score: number): string {
  if (score >= 50) return "text-stock-up";
  if (score >= 40) return "text-warning";
  return "text-stock-down";
}

function getScoreBg(score: number): string {
  if (score >= 50) return "bg-stock-up/15 border-stock-up/30";
  if (score >= 40) return "bg-warning/15 border-warning/30";
  return "bg-stock-down/15 border-stock-down/30";
}

export function useSearchScores(symbols: string[]) {
  const { data, isLoading } = useQuantSignals(symbols.length > 0 ? symbols : undefined);
  
  const scoreMap = new Map<string, { totalScore: number; reason: string }>();
  if (data?.results) {
    for (const r of data.results) {
      scoreMap.set(r.symbol, { totalScore: r.totalScore, reason: r.reason });
    }
  }
  
  return { scoreMap, isLoading };
}

export function SearchScoreBadge({ score, reason }: { score: number; reason: string }) {
  return (
    <div className={`flex items-center gap-1.5 shrink-0 px-2 py-0.5 rounded-md border text-[10px] font-mono ${getScoreBg(score)}`}>
      <span className={`font-black text-xs ${getScoreColor(score)}`}>{score}</span>
      <span className="text-muted-foreground">/100</span>
    </div>
  );
}

export function SearchScoreLoading() {
  return (
    <div className="flex items-center gap-1 shrink-0 px-2 py-0.5 rounded-md border border-border bg-muted/30 text-[10px]">
      <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
      <span className="text-muted-foreground">분석중</span>
    </div>
  );
}
