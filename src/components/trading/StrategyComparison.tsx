import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useUnifiedPortfolio } from "@/hooks/useStockData";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3 } from "lucide-react";

export function StrategyComparison() {
  const { data, isLoading } = useUnifiedPortfolio();

  if (isLoading) return <Skeleton className="h-24" />;

  const stats = data?.stats || {};
  const wallet = data?.wallet;
  const ret = stats.cumulativeReturn || 0;
  const isUp = ret >= 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <BarChart3 className="w-4 h-4" />
          통합 포트폴리오 성과
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="text-left py-2 px-2">전략</th>
                <th className="text-right py-2 px-2">잔고</th>
                <th className="text-right py-2 px-2">수익률</th>
                <th className="text-right py-2 px-2">승률</th>
                <th className="text-right py-2 px-2">실현 PnL</th>
                <th className="text-right py-2 px-2">미실현</th>
                <th className="text-right py-2 px-2">손익비</th>
                <th className="text-right py-2 px-2">거래 수</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border/50 hover:bg-muted/30">
                <td className="py-2.5 px-2 font-medium">📊 통합 10대 지표 엔진</td>
                <td className="py-2.5 px-2 text-right font-mono">
                  ₩{wallet?.balance?.toLocaleString(undefined, { maximumFractionDigits: 0 }) || '-'}
                </td>
                <td className={`py-2.5 px-2 text-right font-mono font-bold ${isUp ? 'text-stock-up' : 'text-stock-down'}`}>
                  {isUp ? '+' : ''}{ret}%
                </td>
                <td className="py-2.5 px-2 text-right font-mono">
                  {stats.winRate || 0}%
                  <span className="text-muted-foreground ml-1">({stats.wins || 0}W/{stats.losses || 0}L)</span>
                </td>
                <td className={`py-2.5 px-2 text-right font-mono ${(stats.totalPnl || 0) >= 0 ? 'text-stock-up' : 'text-stock-down'}`}>
                  ₩{(stats.totalPnl || 0).toLocaleString()}
                </td>
                <td className={`py-2.5 px-2 text-right font-mono ${(stats.totalUnrealizedPnl || 0) >= 0 ? 'text-stock-up' : 'text-stock-down'}`}>
                  ₩{(stats.totalUnrealizedPnl || 0).toLocaleString()}
                </td>
                <td className="py-2.5 px-2 text-right font-mono">{stats.profitFactor || 0}</td>
                <td className="py-2.5 px-2 text-right font-mono">{stats.totalTrades || 0}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
