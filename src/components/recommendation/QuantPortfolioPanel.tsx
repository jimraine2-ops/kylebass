import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuantPortfolio } from "@/hooks/useStockData";
import { resetQuantWallet } from "@/lib/api";
import { Wallet, Trophy, Scale, Target, Activity, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export function QuantPortfolioPanel() {
  const { data, isLoading, refetch } = useQuantPortfolio();
  const [resetting, setResetting] = useState(false);

  const wallet = data?.wallet;
  const openPositions = data?.openPositions || [];
  const closedTrades = data?.closedTrades || [];
  const stats = data?.stats || {};

  const handleReset = async () => {
    if (!confirm('퀀트 지갑을 초기화하시겠습니까? 모든 거래 기록이 삭제됩니다.')) return;
    setResetting(true);
    try {
      await resetQuantWallet();
      await refetch();
      toast.success('퀀트 지갑이 $50,000으로 초기화되었습니다.');
    } catch {
      toast.error('초기화 실패');
    } finally {
      setResetting(false);
    }
  };

  if (isLoading) {
    return <div className="space-y-3">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>;
  }

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-2">
        <KPI icon={<Wallet className="w-3.5 h-3.5 text-primary" />} label="잔고" value={`$${wallet?.balance?.toFixed(2) || '50,000.00'}`} />
        <KPI icon={<Target className="w-3.5 h-3.5 text-primary" />} label="수익률" value={`${(stats.cumulativeReturn || 0) >= 0 ? '+' : ''}${stats.cumulativeReturn || 0}%`} isUp={(stats.cumulativeReturn || 0) >= 0} />
        <KPI icon={<Trophy className="w-3.5 h-3.5 text-warning" />} label="승률" value={`${stats.winRate || 0}%`} sub={`${stats.wins || 0}W ${stats.losses || 0}L`} />
        <KPI icon={<Scale className="w-3.5 h-3.5 text-primary" />} label="손익비" value={`${stats.profitFactor || 0}`} />
        <KPI icon={<Target className="w-3.5 h-3.5 text-primary" />} label="실현PnL" value={`$${stats.totalPnl || 0}`} isUp={(stats.totalPnl || 0) >= 0} />
        <KPI icon={<Activity className="w-3.5 h-3.5 text-warning" />} label="미실현" value={`$${stats.totalUnrealizedPnl || 0}`} isUp={(stats.totalUnrealizedPnl || 0) >= 0} />
      </div>

      {/* Open positions */}
      {openPositions.length > 0 && (
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-stock-up animate-pulse" />
              퀀트 보유 포지션 ({openPositions.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {openPositions.map((pos: any) => {
              const isProfit = (pos.unrealizedPnl || 0) >= 0;
              return (
                <div key={pos.id} className="flex items-center justify-between p-2 rounded bg-muted/50 border border-border text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{pos.symbol}</span>
                    <span className="text-muted-foreground">{pos.quantity}주 @${pos.price}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono">${pos.currentPrice?.toFixed(2)}</span>
                    <span className={`font-mono font-bold ${isProfit ? 'stock-up' : 'stock-down'}`}>
                      {isProfit ? '+' : ''}${pos.unrealizedPnl?.toFixed(2)} ({isProfit ? '+' : ''}{pos.unrealizedPnlPct?.toFixed(1)}%)
                    </span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Recent trades */}
      {closedTrades.length > 0 && (
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs">최근 퀀트 매매 로그</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[150px]">
              <div className="space-y-1">
                {closedTrades.slice(0, 20).map((trade: any) => {
                  const isProfit = (trade.pnl || 0) > 0;
                  return (
                    <div key={trade.id} className="flex items-center justify-between text-[10px] py-1 border-b border-border/30">
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{trade.symbol}</span>
                        <Badge variant={trade.status === 'profit_taken' || trade.status === 'trailing_stop' ? 'default' : 'destructive'} className="text-[8px] px-1 py-0">
                          {trade.status}
                        </Badge>
                      </div>
                      <span className={`font-mono font-bold ${isProfit ? 'stock-up' : 'stock-down'}`}>
                        {isProfit ? '+' : ''}${trade.pnl?.toFixed(2)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      <Button variant="outline" size="sm" onClick={handleReset} disabled={resetting} className="w-full">
        <RotateCcw className="w-3 h-3 mr-1" />
        퀀트 지갑 초기화 ($50,000)
      </Button>
    </div>
  );
}

function KPI({ icon, label, value, sub, isUp }: { icon: React.ReactNode; label: string; value: string; sub?: string; isUp?: boolean }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-1.5 mb-0.5">
          {icon}
          <span className="text-[10px] text-muted-foreground">{label}</span>
        </div>
        <p className={`text-sm font-bold font-mono ${isUp !== undefined ? (isUp ? 'stock-up' : 'stock-down') : ''}`}>{value}</p>
        {sub && <p className="text-[9px] text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}
