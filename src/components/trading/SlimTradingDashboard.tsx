import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useUnifiedPortfolio, useQuantSignals } from "@/hooks/useStockData";
import { resetUnifiedWallet, updateUnifiedBalance } from "@/lib/api";
import {
  Wallet, Trophy, RotateCcw, Target, TrendingUp, TrendingDown,
  Activity, Radar, ShieldCheck, Shield, ArrowUp, ArrowDown,
} from "lucide-react";
import { toast } from "sonner";
import { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatStockName } from "@/lib/koreanStockMap";
import { cn } from "@/lib/utils";
import { EditableBalance } from "@/components/trading/EditableBalance";
import { SlimPositionAnalysisModal } from "@/components/trading/SlimPositionAnalysisModal";
import { Progress } from "@/components/ui/progress";

interface SlimTradingDashboardProps {
  wsGetPrice?: (symbol: string) => number | null;
  wsConnected?: boolean;
  fxRate?: number;
}

function getScoreColor(score: number): string {
  if (score >= 55) return 'text-[hsl(var(--stock-up))]';
  if (score >= 45) return 'text-primary';
  if (score >= 35) return 'text-warning';
  return 'text-destructive';
}

function getScoreLabel(score: number): string {
  if (score >= 55) return '강력 보유';
  if (score >= 45) return '보유 유지';
  if (score >= 35) return '주의';
  return '매도 검토';
}

export function SlimTradingDashboard({ wsGetPrice, wsConnected, fxRate = 1350 }: SlimTradingDashboardProps) {
  const { data, isLoading, refetch } = useUnifiedPortfolio();
  const { data: quantData } = useQuantSignals();
  const [resetting, setResetting] = useState(false);
  const [modalSymbol, setModalSymbol] = useState<string | null>(null);

  useEffect(() => {
    const channel = supabase
      .channel('unified-trades-realtime-slim')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'unified_trades' }, () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [refetch]);

  const wallet = data?.wallet;
  const openPositions = data?.openPositions || [];
  const closedTrades = data?.closedTrades || [];
  const stats = data?.stats || {};

  const allQuantStocks = [...(quantData?.premium || []), ...(quantData?.penny || [])];

  const liveScoreMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of allQuantStocks) {
      if (s.symbol && s.totalScore != null) map.set(s.symbol, s.totalScore);
    }
    return map;
  }, [allQuantStocks]);

  const prevScoreMapRef = useRef<Map<string, number>>(new Map());
  useEffect(() => {
    const t = setTimeout(() => { prevScoreMapRef.current = new Map(liveScoreMap); }, 2000);
    return () => clearTimeout(t);
  }, [liveScoreMap]);

  const wins = stats.wins || 0;
  const losses = stats.losses || 0;
  const winRate = stats.winRate || 0;
  const confirmedBalance = Math.round(wallet?.balance || 0);
  const initialBalance = wallet?.initial_balance || confirmedBalance;

  const openPositionsValue = openPositions.reduce((sum: number, pos: any) => {
    const p = wsGetPrice?.(pos.symbol) ?? pos.currentPrice ?? pos.price;
    return sum + Math.round(p * pos.quantity * fxRate);
  }, 0);

  // Today PnL
  const todayPnl = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return closedTrades
      .filter((t: any) => t.closed_at && new Date(t.closed_at) >= todayStart)
      .reduce((sum: number, t: any) => sum + (t.pnl || 0), 0);
  }, [closedTrades]);

  const todayPnlKRW = Math.round(todayPnl);
  const DAILY_TARGET = 300000;
  const dailyProgress = Math.min(100, (todayPnl / DAILY_TARGET) * 100);

  const handleReset = async () => {
    if (!confirm('통합 지갑을 ₩1,000,000으로 초기화하시겠습니까?')) return;
    setResetting(true);
    try {
      await resetUnifiedWallet();
      await refetch();
      toast.success('초기화 완료');
    } catch { toast.error('초기화 실패'); }
    finally { setResetting(false); }
  };

  if (isLoading) {
    return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>;
  }

  return (
    <div className="space-y-3">
      {/* ===== 1. Hero Summary Cards ===== */}
      <div className="grid grid-cols-3 gap-2">
        {/* Capital */}
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-3 text-center">
            <p className="text-[10px] text-muted-foreground mb-0.5">💰 자본금</p>
            <EditableBalance
              balance={confirmedBalance}
              currencyPrefix="₩"
              onSave={async (val) => { await updateUnifiedBalance(val); await refetch(); }}
            />
          </CardContent>
        </Card>

        {/* Today Profit */}
        <Card className={cn(
          "border",
          todayPnlKRW >= 0
            ? 'border-[hsl(var(--stock-up))]/30 bg-[hsl(var(--stock-up))]/5'
            : 'border-[hsl(var(--stock-down))]/30 bg-[hsl(var(--stock-down))]/5'
        )}>
          <CardContent className="p-3 text-center">
            <p className="text-[10px] text-muted-foreground mb-0.5">📈 오늘 수익</p>
            <p className={cn(
              "text-xl font-black font-mono leading-tight",
              todayPnlKRW >= 0 ? 'text-[hsl(var(--stock-up))]' : 'text-[hsl(var(--stock-down))]'
            )}>
              {todayPnlKRW >= 0 ? '+' : ''}{todayPnlKRW.toLocaleString('ko-KR')}
            </p>
            <p className="text-[9px] text-muted-foreground">원</p>
          </CardContent>
        </Card>

        {/* Win Rate */}
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="p-3 text-center">
            <p className="text-[10px] text-muted-foreground mb-0.5">🏆 승률</p>
            <p className="text-xl font-black font-mono leading-tight text-warning">{winRate}%</p>
            <p className="text-[9px] text-muted-foreground">{wins}승 {losses}패</p>
          </CardContent>
        </Card>
      </div>

      {/* Entry Threshold Badge + Daily Target */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge className="bg-primary/20 text-primary border-primary/40 text-xs font-bold px-3 py-1">
          🎯 매수 기준: 60점
        </Badge>
        <Badge variant="outline" className="text-[10px] gap-1">
          <Target className="w-3 h-3" />
          일일 목표 {dailyProgress.toFixed(0)}%
        </Badge>
        {todayPnl >= DAILY_TARGET && (
          <Badge className="bg-[hsl(var(--stock-up))]/20 text-[hsl(var(--stock-up))] border-[hsl(var(--stock-up))]/40 text-xs animate-pulse">
            🏆 목표 달성!
          </Badge>
        )}
        <Button variant="ghost" size="sm" className="ml-auto h-6 text-[10px] text-muted-foreground" onClick={handleReset} disabled={resetting}>
          <RotateCcw className="w-3 h-3 mr-1" />초기화
        </Button>
      </div>

      {/* Daily target progress */}
      <div className="px-1">
        <Progress
          value={dailyProgress}
          className={cn("h-1.5", dailyProgress >= 100 ? '[&>div]:bg-[hsl(var(--stock-up))]' : dailyProgress >= 50 ? '[&>div]:bg-warning' : '[&>div]:bg-primary')}
        />
      </div>

      {/* ===== 2. Position Cards - Vertical Scroll ===== */}
      {openPositions.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            현재 보유 종목 없음 — AI 자동 매수 대기 중
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <div className="w-2 h-2 rounded-full bg-[hsl(var(--stock-up))] animate-pulse" />
            <span className="text-xs font-bold">보유 포지션 ({openPositions.length})</span>
          </div>

          {openPositions.map((pos: any) => {
            const livePrice = wsGetPrice?.(pos.symbol) ?? pos.currentPrice ?? pos.price;
            const pnlPct = ((livePrice - pos.price) / pos.price) * 100;
            const pnlKRW = Math.round((livePrice - pos.price) * pos.quantity * fxRate);
            const isUp = pnlPct >= 0;
            const score = liveScoreMap.get(pos.symbol) ?? pos.entry_score ?? null;
            const prevScore = prevScoreMapRef.current.get(pos.symbol) ?? null;
            const scoreChange = score !== null && prevScore !== null ? score - prevScore : 0;
            const currentKRW = Math.round(livePrice * fxRate);

            // Target progress
            const targetPct = (pos.ai_reason || '').includes('15%') ? 15 : 5;
            const targetProgress = Math.min(100, Math.max(0, (pnlPct / targetPct) * 100));

            return (
              <Card
                key={pos.id}
                className={cn(
                  "border transition-all cursor-pointer active:scale-[0.98]",
                  isUp
                    ? 'border-[hsl(var(--stock-up))]/20 hover:border-[hsl(var(--stock-up))]/50'
                    : 'border-[hsl(var(--stock-down))]/20 hover:border-[hsl(var(--stock-down))]/50'
                )}
                onClick={() => setModalSymbol(pos.symbol)}
              >
                <CardContent className="p-3 space-y-2">
                  {/* Row 1: Name + PnL */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-bold text-sm truncate">{formatStockName(pos.symbol)}</span>
                      <Badge variant="secondary" className="text-[8px] shrink-0">
                        {pos.cap_type === 'large' ? '대형' : '소형'}
                      </Badge>
                    </div>
                    <div className={cn("text-right", isUp ? 'text-[hsl(var(--stock-up))]' : 'text-[hsl(var(--stock-down))]')}>
                      <div className="flex items-center gap-1 justify-end">
                        {isUp ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                        <span className="font-black font-mono text-lg leading-none">
                          {isUp ? '+' : ''}{pnlPct.toFixed(2)}%
                        </span>
                      </div>
                      <p className="text-[10px] font-mono">{isUp ? '+' : ''}₩{pnlKRW.toLocaleString('ko-KR')}</p>
                    </div>
                  </div>

                  {/* Row 2: Price + Score */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground font-mono">
                      ₩{currentKRW.toLocaleString('ko-KR')} {wsGetPrice?.(pos.symbol) ? '🟢' : ''}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {score !== null && (
                        <Badge variant="outline" className={cn(
                          "text-[10px] px-2 py-0.5 font-mono font-bold gap-1",
                          score >= 55 ? 'border-[hsl(var(--stock-up))]/40 text-[hsl(var(--stock-up))]' :
                          score >= 35 ? 'border-primary/40 text-primary' :
                          'border-destructive/40 text-destructive'
                        )}>
                          <Activity className="w-3 h-3" />
                          {score}점
                          {scoreChange !== 0 && (
                            <span className={cn("flex items-center", scoreChange > 0 ? 'text-[hsl(var(--stock-up))]' : 'text-[hsl(var(--stock-down))]')}>
                              {scoreChange > 0 ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />}
                              {Math.abs(scoreChange)}
                            </span>
                          )}
                        </Badge>
                      )}
                      {score !== null && (
                        <span className={cn("text-[9px] font-medium", getScoreColor(score))}>
                          {getScoreLabel(score)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Row 3: Target Progress */}
                  <div className="flex items-center gap-2">
                    <Target className={cn("w-3 h-3 shrink-0", targetPct >= 15 ? 'text-warning' : 'text-primary')} />
                    <Progress
                      value={targetProgress}
                      className={cn("h-1.5 flex-1", targetPct >= 15 ? '[&>div]:bg-warning' : '[&>div]:bg-primary')}
                    />
                    <span className="text-[9px] font-mono text-muted-foreground w-16 text-right">
                      {pnlPct.toFixed(1)}% / {targetPct}%
                    </span>
                  </div>

                  {/* Row 4: Holding status for losers */}
                  {!isUp && score !== null && score >= 50 && (
                    <div className="flex items-center gap-1.5 text-[10px] text-primary bg-primary/5 rounded px-2 py-1">
                      <ShieldCheck className="w-3 h-3 shrink-0" />
                      <span className="font-medium">홀딩 권장 — 지표 양호, 반등 대기</span>
                    </div>
                  )}
                  {!isUp && score !== null && score < 40 && (
                    <div className="flex items-center gap-1.5 text-[10px] text-destructive bg-destructive/5 rounded px-2 py-1 animate-pulse">
                      <Shield className="w-3 h-3 shrink-0" />
                      <span className="font-medium">매도 검토 — 추세 이탈 위험</span>
                    </div>
                  )}

                  {/* Tap hint */}
                  <div className="flex items-center justify-end">
                    <span className="text-[9px] text-muted-foreground flex items-center gap-1">
                      <Radar className="w-3 h-3" /> 탭하여 레이더 차트
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ===== 3. Fullscreen Radar Modal ===== */}
      <SlimPositionAnalysisModal
        open={!!modalSymbol}
        onOpenChange={(open) => { if (!open) setModalSymbol(null); }}
        position={openPositions.find((p: any) => p.symbol === modalSymbol) || null}
        quantStock={modalSymbol ? allQuantStocks.find((s: any) => s.symbol === modalSymbol) : null}
        livePrice={modalSymbol ? wsGetPrice?.(modalSymbol) : null}
        liveScore={modalSymbol ? (liveScoreMap.get(modalSymbol) ?? null) : null}
        fxRate={fxRate}
      />

      {/* ===== Quick Stats Footer ===== */}
      <div className="grid grid-cols-4 gap-1.5 text-center">
        {[
          { label: '실현 PnL', value: `₩${(stats.totalPnl || 0).toLocaleString()}`, color: (stats.totalPnl || 0) >= 0 ? 'text-[hsl(var(--stock-up))]' : 'text-[hsl(var(--stock-down))]' },
          { label: '미실현', value: `₩${(stats.totalUnrealizedPnl || 0).toLocaleString()}`, color: (stats.totalUnrealizedPnl || 0) >= 0 ? 'text-[hsl(var(--stock-up))]' : 'text-[hsl(var(--stock-down))]' },
          { label: '손익비', value: `${stats.profitFactor || 0}`, color: 'text-foreground' },
          { label: '평균 보유', value: `${stats.avgHoldTimeMinutes || 0}분`, color: 'text-foreground' },
        ].map((item) => (
          <Card key={item.label} className="border-border/50">
            <CardContent className="p-2">
              <p className="text-[9px] text-muted-foreground">{item.label}</p>
              <p className={cn("text-sm font-bold font-mono", item.color)}>{item.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
