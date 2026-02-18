import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useScalpingPortfolio } from "@/hooks/useStockData";
import { resetScalpingWallet, updateWalletBalance } from "@/lib/api";
import { Wallet, Trophy, Scale, Target, Activity, RotateCcw, Clock, Zap } from "lucide-react";
import { EditableBalance } from "@/components/trading/EditableBalance";
import { toast } from "sonner";
import { useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export function ScalpingDashboard() {
  const { data, isLoading, refetch } = useScalpingPortfolio();
  const [resetting, setResetting] = useState(false);

  const wallet = data?.wallet;
  const openPositions = data?.openPositions || [];
  const closedTrades = data?.closedTrades || [];
  const stats = data?.stats || {};

  const handleReset = async () => {
    if (!confirm('스캘핑 지갑을 초기화하시겠습니까? 모든 거래 기록이 삭제됩니다.')) return;
    setResetting(true);
    try {
      await resetScalpingWallet();
      await refetch();
      toast.success('스캘핑 지갑이 ₩1,000,000으로 초기화되었습니다.');
    } catch {
      toast.error('초기화 실패');
    } finally {
      setResetting(false);
    }
  };

  const pnlChartData = closedTrades
    .slice()
    .reverse()
    .reduce((acc: any[], trade: any, i: number) => {
      const prev = acc[i - 1]?.cumPnl || 0;
      acc.push({ name: `#${i + 1}`, cumPnl: +(prev + (trade.pnl || 0)).toFixed(2), symbol: trade.symbol });
      return acc;
    }, []);

  if (isLoading) {
    return <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Badge className="bg-warning/20 text-warning border-warning/30 text-xs animate-pulse">
            <Zap className="w-3 h-3 mr-1" />
            Scalping Mode: ACTIVE
          </Badge>
        </div>
        <Button variant="outline" size="sm" onClick={handleReset} disabled={resetting}>
          <RotateCcw className="w-3.5 h-3.5 mr-1" />
          지갑 초기화
        </Button>
      </div>

      {/* Entry Rules Card */}
      <Card className="border-warning/30">
        <CardContent className="p-3 text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">⚡ 즉시 실행 알고리즘: Under $10 Instant Scalping Engine</p>
          <p>🎯 대상: TOP 10 리스트 진입 즉시 자동 매수 (점수 필터 없음)</p>
          <p>✅ 진입: TOP 10 포착 → 0.1초 이내 시장가 매수 집행</p>
          <p>💰 자산 배분: 종목당 10% (₩1,000,000 기준 ₩100,000)</p>
          <p>🛡️ 청산: 2~3%→50% 익절 | 잔여→ATR×2 추격 손절 | -2% 즉시 손절 | 15분 타임컷 | 장마감 30분 전 강제 청산</p>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="w-4 h-4 text-warning" />
              <span className="text-xs text-muted-foreground">잔고</span>
            </div>
            <EditableBalance
              balance={wallet?.balance || 1000000}
              currencyPrefix="₩"
              onSave={async (val) => { await updateWalletBalance('scalping', val); await refetch(); }}
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Target className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">누적 수익률</span>
            </div>
            <p className={`text-lg font-bold font-mono ${(stats.cumulativeReturn || 0) >= 0 ? 'stock-up' : 'stock-down'}`}>
              {(stats.cumulativeReturn || 0) >= 0 ? '+' : ''}{stats.cumulativeReturn || 0}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Trophy className="w-4 h-4 text-warning" />
              <span className="text-xs text-muted-foreground">승률</span>
            </div>
            <p className="text-lg font-bold font-mono">{stats.winRate || 0}%</p>
            <p className="text-[10px] text-muted-foreground">{stats.wins || 0}승 {stats.losses || 0}패</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Scale className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">손익비</span>
            </div>
            <p className="text-lg font-bold font-mono">{stats.profitFactor || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">평균 보유</span>
            </div>
            <p className="text-lg font-bold font-mono">{stats.avgHoldTimeMinutes || 0}분</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="w-4 h-4 text-warning" />
              <span className="text-xs text-muted-foreground">미실현 PnL</span>
            </div>
            <p className={`text-lg font-bold font-mono ${(stats.totalUnrealizedPnl || 0) >= 0 ? 'stock-up' : 'stock-down'}`}>
              {(stats.totalUnrealizedPnl || 0) >= 0 ? '+' : ''}₩{(stats.totalUnrealizedPnl || 0).toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Open Positions */}
      {openPositions.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-warning animate-pulse" />
              스캘핑 보유 포지션 ({openPositions.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {openPositions.map((pos: any) => {
              const isProfit = (pos.unrealizedPnl || 0) >= 0;
              return (
                <div key={pos.id} className="p-3 rounded-lg bg-muted/50 border border-border space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-sm">{pos.symbol}</span>
                      <span className="text-xs text-muted-foreground">{pos.quantity}주 @ ₩{Math.round((pos.price || 0) * 1350).toLocaleString('ko-KR')}</span>
                      <Badge variant="outline" className="text-[9px]">
                        <Clock className="w-2.5 h-2.5 mr-0.5" />
                        {pos.timeElapsedMin}분 경과
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">현재가</p>
                        <p className="text-sm font-mono font-bold">₩{Math.round((pos.currentPrice || 0) * 1350).toLocaleString('ko-KR') || '-'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">미실현 PnL</p>
                        <p className={`text-sm font-mono font-bold ${isProfit ? 'stock-up' : 'stock-down'}`}>
                          {isProfit ? '+' : ''}₩{pos.unrealizedPnl?.toLocaleString(undefined, { maximumFractionDigits: 2 }) || '0'}
                          <span className="text-[10px] ml-1">({isProfit ? '+' : ''}{pos.unrealizedPnlPct?.toFixed(2) || '0'}%)</span>
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                    <span>SL: ₩{Math.round((pos.stop_loss || 0) * 1350).toLocaleString('ko-KR')} (-2%)</span>
                    <span>TP: ₩{Math.round((pos.take_profit || 0) * 1350).toLocaleString('ko-KR')}</span>
                    <span>타임컷: 15분</span>
                    {pos.entry_score && <Badge variant="secondary" className="text-[9px]">진입점수: {pos.entry_score}</Badge>}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* PnL Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">스캘핑 누적 손익</CardTitle>
        </CardHeader>
        <CardContent>
          {pnlChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={pnlChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                <Line type="monotone" dataKey="cumPnl" stroke="hsl(var(--warning))" strokeWidth={2} dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
              스캘핑 거래 기록이 없습니다.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Trade Log */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">⚡ 스캘핑 매매 로그</CardTitle>
        </CardHeader>
        <CardContent>
          {closedTrades.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">완료된 스캘핑 거래가 없습니다.</p>
          ) : (
            <ScrollArea className="h-[300px]">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="text-left py-2 px-2">시간</th>
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
                      const time = trade.closed_at ? new Date(trade.closed_at).toLocaleString('ko-KR', { hour: '2-digit', minute: '2-digit', month: '2-digit', day: '2-digit' }) : '-';
                      const statusLabels: Record<string, string> = {
                        profit_taken: '익절', stopped: '손절', score_exit: '점수청산', time_cut: '타임컷', closed: '종료',
                      };
                      return (
                        <tr key={trade.id} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="py-2 px-2 text-muted-foreground font-mono">{time}</td>
                          <td className="py-2 px-2 font-bold">{trade.symbol}</td>
                           <td className="py-2 px-2 text-right font-mono">₩{Math.round((trade.price || 0) * 1350).toLocaleString('ko-KR')}</td>
                           <td className="py-2 px-2 text-right font-mono">{trade.close_price ? `₩${Math.round(trade.close_price * 1350).toLocaleString('ko-KR')}` : '-'}</td>
                          <td className="py-2 px-2 text-right font-mono">{trade.quantity}</td>
                          <td className={`py-2 px-2 text-right font-mono font-bold ${isProfit ? 'stock-up' : 'stock-down'}`}>
                            {isProfit ? '+' : ''}₩{trade.pnl?.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-2 px-2">
                            <Badge variant={trade.status === 'profit_taken' ? 'default' : trade.status === 'time_cut' ? 'secondary' : 'destructive'} className="text-[9px]">
                              {statusLabels[trade.status] || trade.status}
                            </Badge>
                          </td>
                          <td className="py-2 px-2 text-muted-foreground max-w-[250px] truncate">{trade.ai_reason}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
