import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAIPortfolio } from "@/hooks/useStockData";
import { resetAIWallet, updateWalletBalance } from "@/lib/api";
import { Wallet, Trophy, BarChart3, RotateCcw, Target, Scale, Activity, Landmark, TrendingUp, DollarSign, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { OpenPositionCard } from "@/components/trading/OpenPositionCard";
import { TradeLogTable } from "@/components/trading/TradeLogTable";
import { RadarChartCard } from "@/components/recommendation/RadarChartCard";
import { SafePauseBanner } from "@/components/dashboard/SafePauseBanner";
import { useQuantSignals } from "@/hooks/useStockData";
import { EditableBalance } from "@/components/trading/EditableBalance";
import { formatStockName } from "@/lib/koreanStockMap";
import { useValueGrades } from "@/hooks/useValueGrade";

interface MainTradingDashboardProps {
  wsGetPrice?: (symbol: string) => number | null;
  wsConnected?: boolean;
  fxRate?: number;
}

export function MainTradingDashboard({ wsGetPrice, wsConnected, fxRate = 1350 }: MainTradingDashboardProps) {
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

  // ★ [Value-Filter] 보유 포지션 심볼의 기업 가치 등급 배치 조회
  const openSymbols = openPositions.map((p: any) => p.symbol as string);
  const { data: valueGrades } = useValueGrades(openSymbols);

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
      toast.success('복리매매 지갑이 ₩5,000,000으로 초기화되었습니다.');
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

  // Use WebSocket prices when available, fallback to API prices
  const openPositionsValue = openPositions.reduce((sum: number, pos: any) => {
    const wsPrice = wsGetPrice?.(pos.symbol);
    const currentPrice = wsPrice ?? pos.currentPrice ?? pos.price;
    return sum + Math.round(currentPrice * pos.quantity * fxRate);
  }, 0);
  const confirmedBalance = Math.round(wallet?.balance || 0);
  const equity = confirmedBalance + openPositionsValue;

  if (isLoading) {
    return <div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <SafePauseBanner />
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">
            📈 복리매매 | 수익금 재투입 → 복리 가속
          </Badge>
          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-[10px]">
            🛡️ SL -5% 엄격 | +1%→SL+0.3% | +3%→즉시 확정
          </Badge>
          <Badge className="bg-warning/20 text-warning border-warning/30 text-[10px]">
            🎯 Alpha-Entry | 뉴스70%↑ + 익절확률85%↑
          </Badge>
          <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px]">
            💰 일일 목표 ₩30만~₩50만 | 손실 한도 잔고 10%
          </Badge>
        </div>
        <Button variant="outline" size="sm" onClick={handleReset} disabled={resetting}>
          <RotateCcw className="w-3.5 h-3.5 mr-1" />
          지갑 초기화
        </Button>
      </div>

      <Card className="border-emerald-500/30 bg-emerald-500/5">
        <CardContent className="p-3 text-xs text-muted-foreground space-y-1.5">
          <p className="font-bold text-emerald-400 text-sm">📈 복리매매 전략 — 수익금 재투입으로 자산 가속 성장</p>
          <p className="italic text-emerald-400/80">"수익이 쌓일수록 포지션이 커지고, 같은 3%가 더 큰 수익이 된다."</p>
          <div className="border-l-2 border-emerald-500/40 pl-2 space-y-0.5">
            <p className="font-semibold text-foreground">[복리 핵심] 수익금 자동 재투입</p>
            <p>💰 라운드 완료 시 잔고 리셋 없음 → 수익금이 다음 원금에 합산</p>
            <p>📊 일일 목표 ₩30만~₩50만 (잔고 대비 6~10% 동적 조절)</p>
          </div>
          <div className="border-l-2 border-yellow-500/40 pl-2 space-y-0.5">
            <p className="font-semibold text-foreground">[리스크 관리] 엄격한 복리 방어</p>
            <p>🔒 손절: -5% (기존 -10% → 절반으로 강화, R:R 1:1.4↑)</p>
            <p>⚡ +1% → SL+0.3% 본절 | +3% → 즉시 수익 확정</p>
            <p>🚨 일일 최대 손실 한도: 잔고의 10% 초과 시 매수 전면 중단</p>
          </div>
          <div className="border-l-2 border-primary/40 pl-2 space-y-0.5">
            <p className="font-semibold text-foreground">[진입 최적화] 매매 기회 확대</p>
            <p>🎯 진입 조건 완화: 뉴스 70%↑ + 익절확률 85%↑ (기존 90/95%)</p>
            <p>💎 포지션 분산: 최대 30% (기존 50%) — 과집중 위험 방지</p>
          </div>
        </CardContent>
      </Card>

      {/* ★ 자금 운용률 경고 배너 */}
      {(() => {
        const initialBal = wallet?.initial_balance || confirmedBalance;
        const utilization = initialBal > 0 ? ((initialBal - confirmedBalance) / initialBal) * 100 : 0;
        return utilization >= 90 ? (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="p-3 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-destructive animate-pulse" />
              <span className="text-sm font-bold text-destructive">⚠️ 자금 운용률 임계점 도달: {utilization.toFixed(1)}%</span>
              <span className="text-xs text-muted-foreground ml-2">확정 잔고의 대부분이 투입되었습니다. 신규 매수가 제한될 수 있습니다.</span>
            </CardContent>
          </Card>
        ) : null;
      })()}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {/* ★ 매수 가능 현금 (Buying Power) — 가장 눈에 띄게 */}
        <Card className="border-stock-up/40 bg-stock-up/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-stock-up" />
              <span className="text-xs font-medium text-stock-up">매수 가능 현금</span>
            </div>
            <p className="text-xl font-bold font-mono text-stock-up">
              ₩{Math.round(Math.max(0, confirmedBalance)).toLocaleString('ko-KR')}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">종목당 최대: ₩{Math.round(Math.max(0, confirmedBalance) * 0.30).toLocaleString('ko-KR')} (30%)</p>
          </CardContent>
        </Card>
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
                livePrice={wsGetPrice?.(pos.symbol)}
                fxRate={fxRate}
                onSelect={() => setSelectedSymbol(pos.symbol === selectedSymbol ? null : pos.symbol)}
                isSelected={pos.symbol === selectedSymbol}
                valueGradeData={valueGrades?.[pos.symbol] || null}
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
