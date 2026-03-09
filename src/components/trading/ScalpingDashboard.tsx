import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useScalpingPortfolio } from "@/hooks/useStockData";
import { resetScalpingWallet, updateWalletBalance } from "@/lib/api";
import { Wallet, Trophy, Scale, Target, Activity, RotateCcw, Clock, Zap, ShieldAlert, Ban, DollarSign, Info } from "lucide-react";
import { EditableBalance } from "@/components/trading/EditableBalance";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { formatStockName } from "@/lib/koreanStockMap";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface ScalpingDashboardProps {
  wsGetPrice?: (symbol: string) => number | null;
  wsConnected?: boolean;
  fxRate?: number;
}

export function ScalpingDashboard({ wsGetPrice, wsConnected, fxRate = 1350 }: ScalpingDashboardProps) {
  const { data, isLoading, refetch } = useScalpingPortfolio();
  const [resetting, setResetting] = useState(false);

  // ★ Realtime subscription for instant scalping trade updates
  useEffect(() => {
    const channel = supabase
      .channel('scalping-trades-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scalping_trades' }, () => {
        refetch();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [refetch]);

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
            소형주 초단타 모드: 가동 중
          </Badge>
          <Badge className="bg-destructive/10 text-destructive border-destructive/30 text-xs">
            <Ban className="w-3 h-3 mr-1" />
            필터 적용: ₩1,000 이상 종목만 추적 중
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
          <p className="font-medium text-foreground">⚡ 공격적 초단타 엔진: ₩13,500 미만 전 종목 실시간 스캔</p>
          <p>🚫 <span className="text-destructive font-medium">안전 필터: ₩1,000 미만 초저가주(동전주) 거래 원천 차단</span></p>
          <p>🎯 대상: 100+ 소형주 로테이션 스캔 → +3% 이상 급등 종목 즉시 진입</p>
          <p>✅ 진입: 당일 상승률 +3% 이상 포착 시 즉시 시장가 매수</p>
          <p>💰 자산 배분: 종목당 10% | 최대 동시 보유 10종목</p>
          <p>🛡️ 청산: +2%→50% 1차 익절 | +5% 고정 익절 | -2.5% 즉시 손절 | 고점+10% 후 -5% 추격익절</p>
          <p className="text-primary font-medium">⏱️ 타임컷 없음 — 오직 지표와 가격에만 반응</p>
        </CardContent>
      </Card>

      {/* ★ 자금 운용률 경고 배너 */}
      {(() => {
        const scalpConfirmed = wallet?.balance || 1000000;
        const scalpInitial = wallet?.initial_balance || scalpConfirmed;
        const utilization = scalpInitial > 0 ? ((scalpInitial - scalpConfirmed) / scalpInitial) * 100 : 0;
        return utilization >= 90 ? (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="p-3 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-destructive animate-pulse" />
              <span className="text-sm font-bold text-destructive">⚠️ 자금 운용률 임계점 도달: {utilization.toFixed(1)}%</span>
              <span className="text-xs text-muted-foreground ml-2">확정 잔고의 대부분이 투입되었습니다.</span>
            </CardContent>
          </Card>
        ) : null;
      })()}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-7 gap-3">
        {/* ★ 매수 가능 현금 */}
        <Card className="border-stock-up/40 bg-stock-up/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-stock-up" />
              <span className="text-xs font-medium text-stock-up">매수 가능 현금</span>
            </div>
            <p className="text-lg font-bold font-mono text-stock-up">
              ₩{Math.round(Math.max(0, wallet?.balance || 0)).toLocaleString('ko-KR')}
            </p>
            <p className="text-[10px] text-muted-foreground">종목당: ₩{Math.round(Math.max(0, (wallet?.balance || 0)) * 0.10).toLocaleString('ko-KR')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="w-4 h-4 text-warning" />
              <span className="text-xs text-muted-foreground">확정 잔고</span>
              <Badge variant="outline" className="text-[9px] border-stock-up/30 text-stock-up ml-auto">확정 수익 반영 중</Badge>
            </div>
            <EditableBalance
              balance={wallet?.balance || 1000000}
              currencyPrefix="₩"
              onSave={async (val) => { await updateWalletBalance('scalping', val); await refetch(); }}
            />
            <p className="text-[10px] text-muted-foreground mt-1">매도 확정 시에만 변동</p>
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
              const wsLivePrice = wsGetPrice?.(pos.symbol);
              const displayPrice = wsLivePrice ?? pos.currentPrice ?? pos.price;
              const isProfit = (pos.unrealizedPnl || 0) >= 0;
              const currentPriceKRW = Math.round(displayPrice * fxRate);
              const isBelowFloor = currentPriceKRW < 1000;
              return (
                <div key={pos.id} className={`p-3 rounded-lg bg-muted/50 border space-y-1 ${isBelowFloor ? 'border-destructive/50 bg-destructive/5' : 'border-border'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-sm">{formatStockName(pos.symbol)}</span>
                      {isBelowFloor && (
                        <Badge variant="destructive" className="text-[9px] animate-pulse">
                          <ShieldAlert className="w-2.5 h-2.5 mr-0.5" />
                          ₩1,000 미만 경고
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">{pos.quantity}주 @ ₩{Math.round((pos.price || 0) * fxRate).toLocaleString('ko-KR')}</span>
                      <Badge variant="outline" className="text-[9px]">
                        <Clock className="w-2.5 h-2.5 mr-0.5" />
                        {pos.timeElapsedMin}분 경과
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">현재가{wsLivePrice ? ' 🟢' : ''}</p>
                        <p className="text-sm font-mono font-bold">₩{currentPriceKRW.toLocaleString('ko-KR')}</p>
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
                     <span>손절: ₩{Math.round((pos.stop_loss || 0) * fxRate).toLocaleString('ko-KR')} (-2.5%)</span>
                     <span>익절: ₩{Math.round((pos.take_profit || 0) * fxRate).toLocaleString('ko-KR')} (+5%)</span>
                     <span>추격익절: 고점+10%→-5%</span>
                     {pos.entry_score && <Badge variant="secondary" className="text-[9px]">상승률: +{pos.entry_score}%</Badge>}
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
                        profit_taken: '익절', stopped: '손절', score_exit: '점수청산', time_cut: '타임컷', trailing_profit: '추격익절', closed: '종료',
                      };
                      return (
                        <tr key={trade.id} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="py-2 px-2 text-muted-foreground font-mono">{time}</td>
                          <td className="py-2 px-2 font-bold">{formatStockName(trade.symbol)}</td>
                           <td className="py-2 px-2 text-right font-mono">₩{Math.round((trade.price || 0) * fxRate).toLocaleString('ko-KR')}</td>
                           <td className="py-2 px-2 text-right font-mono">{trade.close_price ? `₩${Math.round(trade.close_price * fxRate).toLocaleString('ko-KR')}` : '-'}</td>
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

      {/* Data Retention Notice */}
      <Alert className="border-muted-foreground/20">
        <Info className="h-4 w-4" />
        <AlertDescription className="text-xs text-muted-foreground">
          최근 2일간의 매매 기록만 보존됩니다 (비용 최적화 모드). 미체결 포지션은 삭제되지 않습니다.
        </AlertDescription>
      </Alert>
    </div>
  );
}
