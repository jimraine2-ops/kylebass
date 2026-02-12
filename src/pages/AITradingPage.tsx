import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAIPortfolio } from "@/hooks/useStockData";
import { resetAIWallet } from "@/lib/api";
import { TrendingUp, TrendingDown, Bot, Wallet, Trophy, Clock, BarChart3, RotateCcw, Target } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie } from "recharts";

export default function AITradingPage() {
  const { data, isLoading, refetch } = useAIPortfolio();
  const [resetting, setResetting] = useState(false);

  const wallet = data?.wallet;
  const openPositions = data?.openPositions || [];
  const closedTrades = data?.closedTrades || [];
  const stats = data?.stats || {};

  const handleReset = async () => {
    if (!confirm('가상 지갑을 초기화하시겠습니까? 모든 거래 기록이 삭제됩니다.')) return;
    setResetting(true);
    try {
      await resetAIWallet();
      await refetch();
      toast.success('가상 지갑이 $10,000으로 초기화되었습니다.');
    } catch {
      toast.error('초기화 실패');
    } finally {
      setResetting(false);
    }
  };

  // Cumulative PnL chart data
  const pnlChartData = closedTrades
    .slice()
    .reverse()
    .reduce((acc: any[], trade: any, i: number) => {
      const prev = acc[i - 1]?.cumPnl || 0;
      acc.push({
        name: `#${i + 1}`,
        pnl: trade.pnl || 0,
        cumPnl: +(prev + (trade.pnl || 0)).toFixed(2),
        symbol: trade.symbol,
      });
      return acc;
    }, []);

  // Win/Loss pie data
  const wins = closedTrades.filter((t: any) => (t.pnl || 0) > 0).length;
  const losses = closedTrades.filter((t: any) => (t.pnl || 0) <= 0).length;
  const pieData = [
    { name: '승', value: wins, fill: 'hsl(var(--stock-up))' },
    { name: '패', value: losses, fill: 'hsl(var(--stock-down))' },
  ];

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Bot className="w-5 h-5 text-primary" />
          AI 자동 거래 대시보드
        </h2>
        <Button variant="outline" size="sm" onClick={handleReset} disabled={resetting}>
          <RotateCcw className="w-3.5 h-3.5 mr-1" />
          지갑 초기화
        </Button>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">잔고</span>
            </div>
            <p className="text-xl font-bold font-mono">${wallet?.balance?.toFixed(2) || '10,000.00'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">누적 수익률</span>
            </div>
            <p className={`text-xl font-bold font-mono ${(stats.cumulativeReturn || 0) >= 0 ? 'stock-up' : 'stock-down'}`}>
              {stats.cumulativeReturn >= 0 ? '+' : ''}{stats.cumulativeReturn || 0}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Trophy className="w-4 h-4 text-warning" />
              <span className="text-xs text-muted-foreground">승률</span>
            </div>
            <p className="text-xl font-bold font-mono">{stats.winRate || 0}%</p>
            <p className="text-[10px] text-muted-foreground">{wins}승 {losses}패</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Target className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">총 PnL</span>
            </div>
            <p className={`text-xl font-bold font-mono ${(stats.totalPnl || 0) >= 0 ? 'stock-up' : 'stock-down'}`}>
              {stats.totalPnl >= 0 ? '+' : ''}${stats.totalPnl || 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">평균 보유</span>
            </div>
            <p className="text-xl font-bold font-mono">{stats.avgHoldTimeMinutes || 0}분</p>
          </CardContent>
        </Card>
      </div>

      {/* Open Positions - Real-time PnL */}
      {openPositions.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-stock-up animate-pulse" />
              보유 중인 포지션 (실시간)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {openPositions.map((pos: any) => (
                <div key={pos.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border">
                  <div>
                    <span className="font-bold text-sm">{pos.symbol}</span>
                    <span className="text-xs text-muted-foreground ml-2">{pos.quantity}주 @ ${pos.price}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">
                      SL: ${pos.stop_loss} | TP: ${pos.take_profit}
                    </p>
                    <Badge variant="outline" className="text-[10px]">
                      신뢰도: {pos.ai_confidence}%
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Cumulative PnL */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">누적 손익 (PnL)</CardTitle>
          </CardHeader>
          <CardContent>
            {pnlChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={pnlChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                    formatter={(value: number, name: string) => [
                      `$${value.toFixed(2)}`,
                      name === 'cumPnl' ? '누적 PnL' : '거래 PnL'
                    ]}
                  />
                  <Line type="monotone" dataKey="cumPnl" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">
                아직 거래 기록이 없습니다
              </div>
            )}
          </CardContent>
        </Card>

        {/* Win/Loss Pie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">승/패 비율</CardTitle>
          </CardHeader>
          <CardContent>
            {closedTrades.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={index} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">
                데이터 없음
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Trade History */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">거래 내역</CardTitle>
        </CardHeader>
        <CardContent>
          {closedTrades.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">아직 완료된 거래가 없습니다. 소형주 페이지에서 AI 거래를 시작하세요.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left py-2 px-2">종목</th>
                    <th className="text-right py-2 px-2">매수가</th>
                    <th className="text-right py-2 px-2">매도가</th>
                    <th className="text-right py-2 px-2">수량</th>
                    <th className="text-right py-2 px-2">PnL</th>
                    <th className="text-left py-2 px-2">상태</th>
                    <th className="text-left py-2 px-2">사유</th>
                  </tr>
                </thead>
                <tbody>
                  {closedTrades.map((trade: any) => {
                    const isProfit = (trade.pnl || 0) > 0;
                    return (
                      <tr key={trade.id} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="py-2 px-2 font-bold">{trade.symbol}</td>
                        <td className="py-2 px-2 text-right font-mono">${trade.price?.toFixed(4)}</td>
                        <td className="py-2 px-2 text-right font-mono">${trade.close_price?.toFixed(4) || '-'}</td>
                        <td className="py-2 px-2 text-right font-mono">{trade.quantity}</td>
                        <td className={`py-2 px-2 text-right font-mono font-bold ${isProfit ? 'stock-up' : 'stock-down'}`}>
                          {isProfit ? '+' : ''}${trade.pnl?.toFixed(2)}
                        </td>
                        <td className="py-2 px-2">
                          <Badge variant={trade.status === 'profit_taken' ? 'default' : trade.status === 'stopped' ? 'destructive' : 'secondary'} className="text-[9px]">
                            {trade.status === 'profit_taken' ? '익절' : trade.status === 'stopped' ? '손절' : '종료'}
                          </Badge>
                        </td>
                        <td className="py-2 px-2 text-muted-foreground max-w-[200px] truncate">{trade.ai_reason}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
