import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useUnifiedPortfolio } from "@/hooks/useStockData";
import { formatStockName } from "@/lib/koreanStockMap";
import { Briefcase, TrendingUp, TrendingDown } from "lucide-react";
import { Link } from "react-router-dom";

interface UnifiedPortfolioProps {
  wsGetPrice?: (symbol: string) => number | null;
  fxRate?: number;
}

export function UnifiedPortfolio({ wsGetPrice, fxRate = 1350 }: UnifiedPortfolioProps) {
  const { data, isLoading } = useUnifiedPortfolio();

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-primary" />보유 종목 현황
          </CardTitle>
        </CardHeader>
        <CardContent><Skeleton className="h-40" /></CardContent>
      </Card>
    );
  }

  const allPositions = data?.openPositions || [];
  const wallet = data?.wallet;
  const totalBalance = wallet?.balance || 0;
  const totalInitial = wallet?.initial_balance || totalBalance;
  const totalReturn = totalInitial > 0 ? ((totalBalance - totalInitial) / totalInitial * 100) : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-primary" />
            통합 보유 종목 현황
            <Badge variant="outline" className="text-[10px]">{allPositions.length}종목</Badge>
          </CardTitle>
          <div className="flex items-center gap-3 text-xs">
            <div className="text-right">
              <p className="text-muted-foreground">통합 잔고</p>
              <p className="font-bold font-mono">₩{totalBalance.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}</p>
            </div>
            <div className="text-right">
              <p className="text-muted-foreground">총 수익률</p>
              <p className={`font-bold font-mono ${totalReturn >= 0 ? 'text-[hsl(var(--stock-up))]' : 'text-[hsl(var(--stock-down))]'}`}>
                {totalReturn >= 0 ? '+' : ''}{totalReturn.toFixed(2)}%
              </p>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {allPositions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">현재 보유 중인 종목이 없습니다</p>
        ) : (
          allPositions.map((pos: any) => {
            const livePrice = wsGetPrice?.(pos.symbol) || pos.currentPrice || pos.price;
            const pnlPct = ((livePrice - pos.price) / pos.price) * 100;
            const pnlKRW = Math.round((livePrice - pos.price) * pos.quantity * fxRate);
            const isUp = pnlPct >= 0;
            const entryKRW = Math.round(pos.price * fxRate);
            const currentKRW = Math.round(livePrice * fxRate);
            const capLabel = pos.cap_type === 'large' ? '대형' : '소형';

            return (
              <Link
                to={`/stock/${pos.symbol}`}
                key={pos.id}
                className={`flex items-center justify-between p-3 rounded-lg border transition-all hover:shadow-sm ${
                  isUp
                    ? 'bg-[hsl(var(--stock-up)/0.06)] border-[hsl(var(--stock-up)/0.2)] hover:border-[hsl(var(--stock-up)/0.4)]'
                    : 'bg-[hsl(var(--stock-down)/0.06)] border-[hsl(var(--stock-down)/0.2)] hover:border-[hsl(var(--stock-down)/0.4)]'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-sm truncate">{formatStockName(pos.symbol)}</span>
                      <Badge variant="secondary" className="text-[9px] shrink-0">{capLabel}</Badge>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                      <span>진입 ₩{entryKRW.toLocaleString('ko-KR')}</span>
                      <span>→</span>
                      <span className="font-mono">₩{currentKRW.toLocaleString('ko-KR')}</span>
                      <span>× {pos.quantity}주</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {pos.ai_confidence && (
                    <Badge variant="outline" className={`text-[9px] ${
                      pos.ai_confidence >= 55 ? 'border-[hsl(var(--stock-up)/0.3)] text-[hsl(var(--stock-up))]' :
                      pos.ai_confidence >= 35 ? 'border-[hsl(var(--warning)/0.3)] text-[hsl(var(--warning))]' :
                      'border-[hsl(var(--stock-down)/0.3)] text-[hsl(var(--stock-down))]'
                    }`}>
                      {pos.ai_confidence}점
                    </Badge>
                  )}
                  <div className={`text-right ${isUp ? 'text-[hsl(var(--stock-up))]' : 'text-[hsl(var(--stock-down))]'}`}>
                    <div className="flex items-center gap-1 justify-end">
                      {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      <span className="font-bold font-mono text-sm">{isUp ? '+' : ''}{pnlPct.toFixed(2)}%</span>
                    </div>
                    <p className="text-[10px] font-mono">{isUp ? '+' : ''}₩{pnlKRW.toLocaleString('ko-KR')}</p>
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
