import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAIPortfolio, useScalpingPortfolio } from "@/hooks/useStockData";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3 } from "lucide-react";

export function StrategyComparison() {
  const { data: mainData, isLoading: l1 } = useAIPortfolio();
  const { data: scalpData, isLoading: l2 } = useScalpingPortfolio();

  if (l1 || l2) return <Skeleton className="h-48" />;

  const strategies = [
    {
      name: '대형주 전략 (10대 지표 퀀트)',
      icon: '🎯',
      wallet: mainData?.wallet,
      stats: mainData?.stats || {},
      color: 'text-primary',
    },
    {
      name: '소형주 전략 (초단타 스캘핑)',
      icon: '⚡',
      wallet: scalpData?.wallet,
      stats: scalpData?.stats || {},
      color: 'text-warning',
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <BarChart3 className="w-4 h-4" />
          전략별 성과 비교
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
              {strategies.map(s => {
                const ret = s.stats.cumulativeReturn || 0;
                const isUp = ret >= 0;
                return (
                  <tr key={s.name} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="py-2.5 px-2 font-medium">
                      <span className="mr-1">{s.icon}</span>
                      {s.name}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono">
                      ₩{s.wallet?.balance?.toLocaleString(undefined, { maximumFractionDigits: 0 }) || '-'}
                    </td>
                    <td className={`py-2.5 px-2 text-right font-mono font-bold ${isUp ? 'stock-up' : 'stock-down'}`}>
                      {isUp ? '+' : ''}{ret}%
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono">
                      {s.stats.winRate || 0}%
                      <span className="text-muted-foreground ml-1">({s.stats.wins || 0}W/{s.stats.losses || 0}L)</span>
                    </td>
                    <td className={`py-2.5 px-2 text-right font-mono ${(s.stats.totalPnl || 0) >= 0 ? 'stock-up' : 'stock-down'}`}>
                      ₩{(s.stats.totalPnl || 0).toLocaleString()}
                    </td>
                    <td className={`py-2.5 px-2 text-right font-mono ${(s.stats.totalUnrealizedPnl || 0) >= 0 ? 'stock-up' : 'stock-down'}`}>
                      ₩{(s.stats.totalUnrealizedPnl || 0).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono">{s.stats.profitFactor || 0}</td>
                    <td className="py-2.5 px-2 text-right font-mono">{s.stats.totalTrades || 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
