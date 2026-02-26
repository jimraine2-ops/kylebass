import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAIPortfolio } from "@/hooks/useStockData";
import { resetAIWallet, updateWalletBalance } from "@/lib/api";
import { Wallet, Trophy, BarChart3, RotateCcw, Target, Scale, Activity, Landmark, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { OpenPositionCard } from "@/components/trading/OpenPositionCard";
import { TradeLogTable } from "@/components/trading/TradeLogTable";
import { RadarChartCard } from "@/components/recommendation/RadarChartCard";
import { useQuantSignals } from "@/hooks/useStockData";
import { EditableBalance } from "@/components/trading/EditableBalance";
import { formatStockName } from "@/lib/koreanStockMap";

export function MainTradingDashboard() {
  const { data, isLoading, refetch } = useAIPortfolio();
  const { data: quantData } = useQuantSignals();
  const [resetting, setResetting] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);

  // Realtime subscription for instant trade updates
  useEffect(() => {
    const channel = supabase
      .channel('ai-trades-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ai_trades' }, () => {
        refetch();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [refetch]);

  const wallet = data?.wallet;
  const openPositions = data?.openPositions || [];
  const closedTrades = data?.closedTrades || [];
  const stats = data?.stats || {};

  // Find quant indicators for selected symbol
  const allQuantStocks = [...(quantData?.premium || []), ...(quantData?.penny || [])];
  const selectedQuantStock = selectedSymbol
    ? allQuantStocks.find((s: any) => s.symbol === selectedSymbol)
    : null;

  const handleReset = async () => {
    if (!confirm('가상 지갑을 초기화하시겠습니까? 모든 거래 기록이 삭제됩니다.')) return;
    setResetting(true);
    try {
      await resetAIWallet();
      await refetch();
      toast.success('가상 지갑이 ₩1,000,000으로 초기화되었습니다.');
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
      acc.push({ name: `#${i + 1}`, pnl: trade.pnl || 0, cumPnl: +(prev + (trade.pnl || 0)).toFixed(2), symbol: trade.symbol });
      return acc;
    }, []);

  const wins = stats.wins || 0;
  const losses = stats.losses || 0;
  const pieData = [
    { name: '승', value: wins, fill: 'hsl(var(--stock-up))' },
    { name: '패', value: losses, fill: 'hsl(var(--stock-down))' },
  ];

  // Equity = confirmed balance + market value of open positions
  const openPositionsValue = openPositions.reduce((sum: number, pos: any) => {
    const currentPrice = pos.currentPrice || pos.price;
    return sum + Math.round(currentPrice * pos.quantity * 1350); // KRW
  }, 0);
  const confirmedBalance = Math.round(wallet?.balance || 0);
  const equity = confirmedBalance + openPositionsValue;

  if (isLoading) {
    return <div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className="bg-stock-up/20 text-stock-up border-stock-up/30 text-[10px]">
            📡 데이터: Finnhub 실시간 + Twelve Data 교차검증
          </Badge>
          <Badge className="bg-warning/20 text-warning border-warning/30 text-[10px]">
            ⚡ 슬리피지 ±0.02% 적용
          </Badge>
          <Badge className="bg-stock-up/20 text-stock-up border-stock-up/30 text-[10px]">
            🔥 대형주 퀀트 전략 (진입 임계: 50점)
          </Badge>
          <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px]">
            📊 10대 지표 기반 통합 포트폴리오
          </Badge>
        </div>
        <Button variant="outline" size="sm" onClick={handleReset} disabled={resetting}>
          <RotateCcw className="w-3.5 h-3.5 mr-1" />
          지갑 초기화
        </Button>
      </div>

      <Card className="border-primary/20">
        <CardContent className="p-3 text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">📋 대형주 트레이딩 엔진: 10대 지표 퀀트 전략</p>
          <p>✅ Main 진입: [합산 점수 ≥ 50] AND [현재가 {'>'} VWAP] AND [RVOL {'>'} 1.2]</p>
          <p>✅ Quant 진입: [합산 점수 ≥ 50] AND [호재 {'>'} 0] AND [RVOL {'>'} 1.5] AND [현재가 {'>'} VWAP] → 15%</p>
          <p>🏷️ 거래 태그: [Main] 또는 [Quant] 태그로 전략 구분</p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-primary/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Landmark className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">확정 잔고 (현금)</span>
              <Badge variant="outline" className="text-[9px] border-stock-up/30 text-stock-up ml-auto">확정 수익 반영 중</Badge>
            </div>
            <EditableBalance
              balance={confirmedBalance}
              currencyPrefix="₩"
              onSave={async (val) => { await updateWalletBalance('main', val); await refetch(); }}
            />
            <p className="text-[10px] text-muted-foreground mt-1">매매 체결 시에만 변동 · 미실현 손익 미반영</p>
          </CardContent>
        </Card>
        <Card className="border-warning/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-warning" />
              <span className="text-xs text-muted-foreground">평가 자산 (Equity)</span>
            </div>
            <p className="text-xl font-bold font-mono">
              ₩{Math.round(equity).toLocaleString('ko-KR')}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">
              확정 잔고 + 보유 평가액 ₩{Math.round(openPositionsValue).toLocaleString('ko-KR')}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">누적 수익률</span>
            </div>
            <p className={`text-xl font-bold font-mono ${(stats.cumulativeReturn || 0) >= 0 ? 'text-stock-up' : 'text-stock-down'}`}>
              {stats.cumulativeReturn >= 0 ? '+' : ''}{stats.cumulativeReturn || 0}%
            </p>
            <p className="text-[10px] text-muted-foreground">실현 PnL 기준 (평가 손익 제외)</p>
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
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Scale className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">손익비</span>
            </div>
            <p className="text-xl font-bold font-mono">{stats.profitFactor || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Target className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">실현 PnL</span>
            </div>
            <p className={`text-xl font-bold font-mono ${(stats.totalPnl || 0) >= 0 ? 'text-stock-up' : 'text-stock-down'}`}>
              {stats.totalPnl >= 0 ? '+' : ''}₩{(stats.totalPnl || 0).toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="w-4 h-4 text-warning" />
              <span className="text-xs text-muted-foreground">미실현 PnL</span>
            </div>
            <p className={`text-xl font-bold font-mono ${(stats.totalUnrealizedPnl || 0) >= 0 ? 'text-stock-up' : 'text-stock-down'}`}>
              {(stats.totalUnrealizedPnl || 0) >= 0 ? '+' : ''}₩{(stats.totalUnrealizedPnl || 0).toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">매수 여력</span>
            </div>
            <p className="text-xl font-bold font-mono">
              ₩{Math.round(confirmedBalance * 0.1).toLocaleString('ko-KR')}
            </p>
            <p className="text-[10px] text-muted-foreground">확정 잔고의 10% (종목당)</p>
          </CardContent>
        </Card>
      </div>

      {openPositions.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-stock-up animate-pulse" />
              통합 보유 포지션 ({openPositions.length}) — 실시간 미실현 손익
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {openPositions.map((pos: any) => (
              <OpenPositionCard
                key={pos.id}
                position={pos}
                onSelect={() => setSelectedSymbol(pos.symbol === selectedSymbol ? null : pos.symbol)}
                isSelected={pos.symbol === selectedSymbol}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Radar Chart for selected position */}
      {selectedSymbol && selectedQuantStock && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              {formatStockName(selectedSymbol)} 퀀트 레이더 차트 (점수: {selectedQuantStock.totalScore}/100)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RadarChartCard indicators={selectedQuantStock.indicators} />
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
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
                    formatter={(value: number, name: string) => [`₩${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, name === 'cumPnl' ? '누적 PnL' : '거래 PnL']}
                  />
                  <Line type="monotone" dataKey="cumPnl" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">
                거래 기록이 없습니다. 추천 탭에서 AI 매매를 시작하세요.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">승/패 비율</CardTitle>
          </CardHeader>
          <CardContent>
            {closedTrades.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                    {pieData.map((entry, index) => <Cell key={index} fill={entry.fill} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">데이터 없음</div>
            )}
          </CardContent>
        </Card>
      </div>

      <TradeLogTable closedTrades={closedTrades} openPositions={openPositions} />
    </div>
  );
}
