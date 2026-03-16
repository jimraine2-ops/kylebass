import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useUnifiedPortfolio } from "@/hooks/useStockData";
import { resetUnifiedWallet, updateUnifiedBalance } from "@/lib/api";
import { Trophy, BarChart3, RotateCcw, Target, TrendingUp, DollarSign, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { useState, useEffect, useRef, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { OpenPositionCard } from "@/components/trading/OpenPositionCard";
import { PositionAnalysisModal } from "@/components/trading/PositionAnalysisModal";
import { TradeLogTable } from "@/components/trading/TradeLogTable";
import { RadarChartCard } from "@/components/recommendation/RadarChartCard";
import { useQuantSignals } from "@/hooks/useStockData";
import { EditableBalance } from "@/components/trading/EditableBalance";
import { formatStockName } from "@/lib/koreanStockMap";

interface IntegratedKPIDashboardProps {
  wsGetPrice?: (symbol: string) => number | null;
  wsConnected?: boolean;
  fxRate?: number;
}

export function IntegratedKPIDashboard({ wsGetPrice, wsConnected, fxRate = 1350 }: IntegratedKPIDashboardProps) {
  const { data, isLoading, refetch } = useUnifiedPortfolio();
  const { data: quantData } = useQuantSignals();
  const [resetting, setResetting] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [modalSymbol, setModalSymbol] = useState<string | null>(null);
  const [chartsOpen, setChartsOpen] = useState(false);

  useEffect(() => {
    const channel = supabase
      .channel('unified-trades-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'unified_trades' }, () => { refetch(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [refetch]);

  const wallet = data?.wallet;
  const openPositions = data?.openPositions || [];
  const closedTrades = data?.closedTrades || [];
  const stats = data?.stats || {};

  const allQuantStocks = [...(quantData?.premium || []), ...(quantData?.penny || [])];
  const selectedQuantStock = selectedSymbol
    ? allQuantStocks.find((s: any) => s.symbol === selectedSymbol)
    : null;

  const liveScoreMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of allQuantStocks) {
      if (s.symbol && s.totalScore != null) map.set(s.symbol, s.totalScore);
    }
    return map;
  }, [allQuantStocks]);

  const prevScoreMapRef = useRef<Map<string, number>>(new Map());
  const prevScoreMap = prevScoreMapRef.current;

  useEffect(() => {
    const timeout = setTimeout(() => { prevScoreMapRef.current = new Map(liveScoreMap); }, 2000);
    return () => clearTimeout(timeout);
  }, [liveScoreMap]);

  const handleReset = async () => {
    if (!confirm('통합 지갑을 초기화하시겠습니까?')) return;
    setResetting(true);
    try {
      await resetUnifiedWallet();
      await refetch();
      toast.success('지갑이 초기화되었습니다.');
    } catch { toast.error('초기화 실패'); }
    finally { setResetting(false); }
  };

  const pnlChartData = closedTrades.slice().reverse().reduce((acc: any[], trade: any, i: number) => {
    const prev = acc[i - 1]?.cumPnl || 0;
    acc.push({ name: `#${i + 1}`, pnl: trade.pnl || 0, cumPnl: +(prev + (trade.pnl || 0)).toFixed(2) });
    return acc;
  }, []);

  const DAILY_TARGET_KRW = 300000;
  const todayPnl = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return closedTrades
      .filter((t: any) => t.closed_at && new Date(t.closed_at) >= todayStart)
      .reduce((sum: number, t: any) => sum + (t.pnl || 0), 0);
  }, [closedTrades]);
  const dailyProgress = Math.min(100, (todayPnl / DAILY_TARGET_KRW) * 100);

  const wins = stats.wins || 0;
  const losses = stats.losses || 0;

  const openPositionsValue = openPositions.reduce((sum: number, pos: any) => {
    const wsPrice = wsGetPrice?.(pos.symbol);
    const currentPrice = wsPrice ?? pos.currentPrice ?? pos.price;
    return sum + Math.round(currentPrice * pos.quantity * fxRate);
  }, 0);
  const confirmedBalance = Math.round(wallet?.balance || 0);
  const equity = confirmedBalance + openPositionsValue;

  if (isLoading) {
    return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>;
  }

  return (
    <div className="space-y-3">
      {/* ── KPI Summary: 4 key metrics in one compact card ── */}
      <Card>
        <CardContent className="p-3">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* 매수 가능 현금 */}
            <div>
              <div className="flex items-center gap-1.5 mb-0.5">
                <DollarSign className="w-3.5 h-3.5 text-stock-up" />
                <span className="text-[11px] text-muted-foreground">매수 가능</span>
              </div>
              <EditableBalance
                balance={confirmedBalance}
                currencyPrefix="₩"
                onSave={async (val) => { await updateUnifiedBalance(val); await refetch(); }}
              />
            </div>

            {/* 평가 자산 */}
            <div>
              <div className="flex items-center gap-1.5 mb-0.5">
                <TrendingUp className="w-3.5 h-3.5 text-warning" />
                <span className="text-[11px] text-muted-foreground">평가 자산</span>
              </div>
              <p className="text-lg font-bold font-mono">₩{Math.round(equity).toLocaleString('ko-KR')}</p>
              <p className="text-[10px] text-muted-foreground">보유 평가 ₩{Math.round(openPositionsValue).toLocaleString('ko-KR')}</p>
            </div>

            {/* 누적 수익률 + 실현 PnL */}
            <div>
              <div className="flex items-center gap-1.5 mb-0.5">
                <BarChart3 className="w-3.5 h-3.5 text-primary" />
                <span className="text-[11px] text-muted-foreground">실현 PnL</span>
              </div>
              <p className={`text-lg font-bold font-mono ${(stats.totalPnl || 0) >= 0 ? 'text-stock-up' : 'text-stock-down'}`}>
                {(stats.totalPnl || 0) >= 0 ? '+' : ''}₩{(stats.totalPnl || 0).toLocaleString()}
              </p>
              <p className="text-[10px] text-muted-foreground">
                수익률 {stats.cumulativeReturn >= 0 ? '+' : ''}{stats.cumulativeReturn || 0}% · 미실현 {(stats.totalUnrealizedPnl || 0) >= 0 ? '+' : ''}₩{(stats.totalUnrealizedPnl || 0).toLocaleString()}
              </p>
            </div>

            {/* 승률 */}
            <div>
              <div className="flex items-center gap-1.5 mb-0.5">
                <Trophy className="w-3.5 h-3.5 text-warning" />
                <span className="text-[11px] text-muted-foreground">승률</span>
              </div>
              <p className="text-lg font-bold font-mono">{stats.winRate || 0}%</p>
              <p className="text-[10px] text-muted-foreground">
                {wins}승 {losses}패 · 손익비 {stats.profitFactor || 0} · 평균 {stats.avgHoldTimeMinutes || 0}분
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Daily target progress ── */}
      <div className="px-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Target className="w-3 h-3" />
            일일 목표
          </span>
          <span className="text-[11px] font-mono">
            <span className={todayPnl >= DAILY_TARGET_KRW ? 'text-stock-up font-bold' : ''}>
              ₩{todayPnl.toLocaleString('ko-KR')}
            </span>
            <span className="text-muted-foreground"> / ₩300,000</span>
          </span>
        </div>
        <div className="w-full bg-muted rounded-full h-1.5">
          <div
            className={`h-1.5 rounded-full transition-all ${dailyProgress >= 100 ? 'bg-stock-up' : dailyProgress >= 50 ? 'bg-warning' : 'bg-primary'}`}
            style={{ width: `${dailyProgress}%` }}
          />
        </div>
      </div>

      {/* ── Open Positions ── */}
      {openPositions.length > 0 && (
        <Card>
          <CardHeader className="pb-1.5 pt-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-stock-up animate-pulse" />
              보유 종목 ({openPositions.length})
              <div className="flex items-center gap-1.5 ml-auto">
                <Badge variant="outline" className="text-[9px] py-0">
                  대형 {openPositions.filter((p: any) => p.cap_type === 'large').length} · 소형 {openPositions.filter((p: any) => p.cap_type !== 'large').length}
                </Badge>
                <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[9px] text-muted-foreground" onClick={handleReset} disabled={resetting}>
                  <RotateCcw className="w-3 h-3" />
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 px-3 pb-3">
            {openPositions.map((pos: any) => (
              <OpenPositionCard
                key={pos.id}
                position={pos}
                livePrice={wsGetPrice?.(pos.symbol)}
                fxRate={fxRate}
                liveScore={liveScoreMap.get(pos.symbol) ?? null}
                prevScore={prevScoreMap.get(pos.symbol) ?? null}
                onSelect={() => setSelectedSymbol(pos.symbol === selectedSymbol ? null : pos.symbol)}
                isSelected={pos.symbol === selectedSymbol}
                onOpenModal={() => setModalSymbol(pos.symbol)}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Selected symbol radar chart */}
      {selectedSymbol && selectedQuantStock && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              {formatStockName(selectedSymbol)} 퀀트 레이더 ({selectedQuantStock.totalScore}/100)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RadarChartCard indicators={selectedQuantStock.indicators} />
          </CardContent>
        </Card>
      )}

      {/* Radar modal */}
      <PositionAnalysisModal
        open={!!modalSymbol}
        onOpenChange={(open) => { if (!open) setModalSymbol(null); }}
        position={openPositions.find((p: any) => p.symbol === modalSymbol) || null}
        quantStock={modalSymbol ? allQuantStocks.find((s: any) => s.symbol === modalSymbol) : null}
        livePrice={modalSymbol ? wsGetPrice?.(modalSymbol) : null}
        liveScore={modalSymbol ? (liveScoreMap.get(modalSymbol) ?? null) : null}
        fxRate={fxRate}
      />

      {/* ── Charts & Trade Log (Collapsible) ── */}
      <Collapsible open={chartsOpen} onOpenChange={setChartsOpen}>
        <CollapsibleTrigger className="w-full px-3 py-2 flex items-center justify-between hover:bg-muted/50 transition-colors rounded-lg border border-border/50">
          <span className="text-sm font-medium flex items-center gap-2">
            <BarChart3 className="w-3.5 h-3.5 text-primary" />
            차트 & 거래 내역
          </span>
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${chartsOpen ? 'rotate-180' : ''}`} />
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2 space-y-3">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-1 pt-3">
                <CardTitle className="text-xs">누적 손익</CardTitle>
              </CardHeader>
              <CardContent>
                {pnlChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={pnlChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} />
                      <YAxis tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} />
                      <Tooltip
                        contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }}
                        formatter={(value: number, name: string) => [`₩${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, name === 'cumPnl' ? '누적' : 'PnL']}
                      />
                      <Line type="monotone" dataKey="cumPnl" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 2 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[200px] flex items-center justify-center text-muted-foreground text-xs">거래 기록 없음</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-1 pt-3">
                <CardTitle className="text-xs">승/패</CardTitle>
              </CardHeader>
              <CardContent>
                {closedTrades.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: '승', value: wins, fill: 'hsl(var(--stock-up))' },
                          { name: '패', value: losses, fill: 'hsl(var(--stock-down))' },
                        ]}
                        cx="50%" cy="50%" innerRadius={50} outerRadius={70} dataKey="value"
                        label={({ name, value }) => `${name}:${value}`}
                      >
                        <Cell fill="hsl(var(--stock-up))" />
                        <Cell fill="hsl(var(--stock-down))" />
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[200px] flex items-center justify-center text-muted-foreground text-xs">데이터 없음</div>
                )}
              </CardContent>
            </Card>
          </div>

          <TradeLogTable closedTrades={closedTrades} openPositions={openPositions} />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
