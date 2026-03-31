import { Trophy, Flame, Target, Shield, RotateCcw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatStockName } from "@/lib/koreanStockMap";
import { useEffect, useState, useRef, forwardRef } from "react";

interface ProfitScoreboardProps {
  totalProfitKRW: number;
  roundNumber: number;
  bestTicker: string | null;
  bestPnlPct: number;
  winRate: number;
  totalTrades: number;
  isLoading: boolean;
}

const AnimatedNumber = forwardRef<HTMLSpanElement, { value: number; prefix?: string; suffix?: string }>(
  ({ value, prefix = "", suffix = "" }, ref) => {
    const [display, setDisplay] = useState(value);
    const prevRef = useRef(value);

    useEffect(() => {
      const prev = prevRef.current;
      if (prev === value) return;
      prevRef.current = value;

      const diff = value - prev;
      const steps = 20;
      const stepVal = diff / steps;
      let current = prev;
      let step = 0;

      const timer = setInterval(() => {
        step++;
        current += stepVal;
        if (step >= steps) {
          current = value;
          clearInterval(timer);
        }
        setDisplay(Math.round(current));
      }, 30);

      return () => clearInterval(timer);
    }, [value]);

    return (
      <span ref={ref}>
        {prefix}{display.toLocaleString('ko-KR')}{suffix}
      </span>
    );
  }
);
AnimatedNumber.displayName = "AnimatedNumber";

export const ProfitScoreboard = forwardRef<HTMLDivElement, ProfitScoreboardProps>(function ProfitScoreboard({
  totalProfitKRW,
  roundNumber,
  bestTicker,
  bestPnlPct,
  winRate,
  totalTrades,
  isLoading,
}, _ref) {
  const isProfit = totalProfitKRW >= 0;

  return (
    <Card className="border-yellow-500/40 bg-gradient-to-r from-yellow-500/10 via-amber-500/5 to-orange-500/10 shadow-lg shadow-yellow-500/5">
      <CardContent className="p-4 space-y-3">
        {/* Title */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-400" />
            <span className="text-sm font-bold text-yellow-400">수익 현황판</span>
          </div>
          <Badge variant="outline" className="border-yellow-500/30 text-yellow-400 text-[10px] gap-1">
            <RotateCcw className="w-3 h-3" />
            Round {roundNumber}
          </Badge>
        </div>

        {/* Main Profit Display */}
        <div className="text-center py-2">
          <p className="text-[10px] text-muted-foreground mb-1">오늘의 총 수익</p>
          <p className={`text-2xl md:text-3xl font-extrabold font-mono tracking-tight ${isProfit ? 'text-stock-up' : 'text-stock-down'}`}
            style={isProfit ? { textShadow: '0 0 20px hsl(142 76% 36% / 0.3)' } : undefined}>
            {isProfit ? '+' : ''}
            <AnimatedNumber value={totalProfitKRW} prefix="₩" />
          </p>
          {totalTrades > 0 && (
            <p className="text-[11px] text-muted-foreground mt-1">
              {totalTrades}건 거래 완료
            </p>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-2">
          {/* Best Stock */}
          <div className="bg-card/50 rounded-lg p-2 text-center border border-border/50">
            <Flame className="w-3.5 h-3.5 text-orange-400 mx-auto mb-1" />
            <p className="text-[9px] text-muted-foreground">최고 수익</p>
            {bestTicker ? (
              <>
                <p className="text-xs font-bold truncate">{formatStockName(bestTicker)}</p>
                <p className="text-[10px] font-mono text-stock-up">+{bestPnlPct.toFixed(1)}%</p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">—</p>
            )}
          </div>

          {/* Win Rate */}
          <div className="bg-card/50 rounded-lg p-2 text-center border border-border/50">
            <Shield className="w-3.5 h-3.5 text-emerald-400 mx-auto mb-1" />
            <p className="text-[9px] text-muted-foreground">승률</p>
            <p className={`text-sm font-bold font-mono ${winRate >= 100 ? 'text-stock-up' : winRate >= 80 ? 'text-yellow-400' : 'text-stock-down'}`}>
              {winRate.toFixed(1)}%
            </p>
          </div>

          {/* Round */}
          <div className="bg-card/50 rounded-lg p-2 text-center border border-border/50">
            <Target className="w-3.5 h-3.5 text-primary mx-auto mb-1" />
            <p className="text-[9px] text-muted-foreground">현재 회전수</p>
            <p className="text-sm font-bold font-mono text-yellow-400">
              R{roundNumber}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
