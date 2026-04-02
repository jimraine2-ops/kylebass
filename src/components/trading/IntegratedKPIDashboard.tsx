import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useUnifiedPortfolio } from "@/hooks/useStockData";
import { resetUnifiedWallet, updateUnifiedBalance } from "@/lib/api";
import { Wallet, Trophy, BarChart3, RotateCcw, Target, Scale, Activity, Landmark, TrendingUp, DollarSign, ShieldAlert, Clock } from "lucide-react";
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
import { SafePauseBanner } from "@/components/dashboard/SafePauseBanner";
import { useValueGrades } from "@/hooks/useValueGrade";

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

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('unified-trades-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'unified_trades' }, () => {
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

  const allQuantStocks = [...(quantData?.premium || []), ...(quantData?.penny || [])];
  const selectedQuantStock = selectedSymbol
    ? allQuantStocks.find((s: any) => s.symbol === selectedSymbol)
    : null;

  // ★ Live score tracking: map symbol → current score
  const liveScoreMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of allQuantStocks) {
      if (s.symbol && s.totalScore != null) {
        map.set(s.symbol, s.totalScore);
      }
    }
    return map;
  }, [allQuantStocks]);

  // ★ Previous score tracking for change arrows
  const prevScoreMapRef = useRef<Map<string, number>>(new Map());
  const prevScoreMap = prevScoreMapRef.current;

  useEffect(() => {
    // After render, save current scores as previous for next cycle
    const timeout = setTimeout(() => {
      prevScoreMapRef.current = new Map(liveScoreMap);
    }, 2000);
    return () => clearTimeout(timeout);
  }, [liveScoreMap]);

  const handleReset = async () => {
    if (!confirm('통합 지갑을 ₩1,000,000으로 초기화하시겠습니까? 모든 거래 기록이 삭제됩니다.')) return;
    setResetting(true);
    try {
      await resetUnifiedWallet();
      await refetch();
      toast.success('통합 지갑이 ₩1,000,000으로 초기화되었습니다.');
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

  // ★ 일일 수익 목표 체크 + 라운드 추적
  const DAILY_TARGET_KRW = 500000;
  const ROUND_RESET_BASE_KRW = 5000000;

  // ★ 라운드 감지: agent_logs에서 Round 완료 로그 카운트
  const [currentRound, setCurrentRound] = useState(1);
  const [cumulativeProfit, setCumulativeProfit] = useState(0);

  useEffect(() => {
    async function detectRound() {
      try {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const { data: roundLogs } = await supabase
          .from('agent_logs')
          .select('details')
          .eq('action', 'milestone')
          .like('message', '%Round%완료%')
          .gte('created_at', todayStart.toISOString())
          .order('created_at', { ascending: false });

        if (roundLogs && roundLogs.length > 0) {
          const latestDetails = roundLogs[0]?.details as any;
          setCurrentRound(latestDetails?.newRound || roundLogs.length + 1);
          setCumulativeProfit(latestDetails?.cumulativeProfit || 0);
        }
      } catch { /* fallback */ }
    }
    detectRound();
    const interval = setInterval(detectRound, 30000);
    return () => clearInterval(interval);
  }, []);

  const todayPnl = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return closedTrades
      .filter((t: any) => t.closed_at && new Date(t.closed_at) >= todayStart)
      .reduce((sum: number, t: any) => sum + (t.pnl || 0), 0);
  }, [closedTrades]);

  // 현재 라운드 수익 = 오늘 총 수익 - 이전 라운드 누적 수익
  const currentRoundPnl = todayPnl - cumulativeProfit;
  const dailyTargetHit = currentRoundPnl >= DAILY_TARGET_KRW;
  const dailyProgress = Math.min(100, (currentRoundPnl / DAILY_TARGET_KRW) * 100);
  const totalDayProfit = todayPnl; // 전체 일일 수익 (모든 라운드 합산)

  // ★ 연승 카운트: 최근 연속 익절 횟수
  const winStreak = useMemo(() => {
    const sorted = closedTrades
      .filter((t: any) => t.closed_at)
      .sort((a: any, b: any) => new Date(b.closed_at).getTime() - new Date(a.closed_at).getTime());
    let streak = 0;
    for (const t of sorted) {
      if ((t.pnl || 0) > 0) streak++;
      else break;
    }
    return streak;
  }, [closedTrades]);

  const wins = stats.wins || 0;
  const losses = stats.losses || 0;
  const pieData = [
    { name: '승', value: wins, fill: 'hsl(var(--stock-up))' },
    { name: '패', value: losses, fill: 'hsl(var(--stock-down))' },
  ];

  const openPositionsValue = openPositions.reduce((sum: number, pos: any) => {
    const wsPrice = wsGetPrice?.(pos.symbol);
    const currentPrice = wsPrice ?? pos.currentPrice ?? pos.price;
    return sum + Math.round(currentPrice * pos.quantity * fxRate);
  }, 0);
  const confirmedBalance = Math.round(wallet?.balance || 0);
  const equity = confirmedBalance + openPositionsValue;

  // Cap type counts
  const largePositions = openPositions.filter((p: any) => p.cap_type === 'large');
  const smallPositions = openPositions.filter((p: any) => p.cap_type === 'small');

  if (isLoading) {
    return <div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <SafePauseBanner />
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* ★ 연승 카운터 */}
          {winStreak > 0 && (
            <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-sm font-bold shadow-[0_0_12px_rgba(234,179,8,0.3)]">
              🔥 현재 연속 익절: {winStreak}회 / 승률: {wins + losses > 0 ? ((wins / (wins + losses)) * 100).toFixed(0) : 0}%
            </Badge>
          )}
          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-[10px]">
            🛡️ Iron-Defense | +1%→SL+0.2% | +3%→즉시 확정
          </Badge>
          <Badge className="bg-stock-up/20 text-stock-up border-stock-up/30 text-[10px]">
            🎯 Dynamic-Target | 체결강도별 2~3% 가변 익절
          </Badge>
          <Badge className="bg-warning/20 text-warning border-warning/30 text-[10px]">
            📉 Adaptive-Exit | 고점-0.5% OR 체결강도 80%↓ → 즉시 익절
          </Badge>
          <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px]">
            💎 ₩12,000↓ 저가주 호가 최적화 | 선제적 매도
          </Badge>
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">
            💎 Value-Filter | 기업가치 A/B등급 → 익절확정 98%
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            대형 {stats.largeCount || largePositions.length} + 소형 {stats.smallCount || smallPositions.length} = {openPositions.length}종목
          </Badge>
          {currentRound > 1 && (
            <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px] font-bold">
              🔄 Round {currentRound} 진행 중 | 누적 수익: ₩{cumulativeProfit.toLocaleString('ko-KR')}
            </Badge>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={handleReset} disabled={resetting}>
          <RotateCcw className="w-3.5 h-3.5 mr-1" />
          지갑 초기화 (₩100만)
        </Button>
      </div>

    <Card className="border-yellow-500/30 bg-yellow-500/5">
        <CardContent className="p-3 text-xs text-muted-foreground space-y-1.5">
          <p className="font-bold text-yellow-400 text-sm">🏆 Dynamic-Target + Adaptive-Exit 전략</p>
          <p className="italic text-yellow-400/80">"시장은 생물이다. 3%가 목표지만, 힘이 2.5%에서 꺾인다면 그곳이 우리의 종착역이다."</p>
          <div className="border-l-2 border-yellow-500/40 pl-2 space-y-0.5">
            <p className="font-semibold text-foreground">[Dynamic-Target] 종목별 맞춤 익절</p>
            <p>🔥 체결강도 150%↑ → 3.0% 익절 (강력 홀딩)</p>
            <p>📊 체결강도 100~150% → 2.5% 익절 (분할 대응)</p>
            <p>⚡ 체결강도 100%↓ → 2.0% 익절 (빠른 회전)</p>
          </div>
          <div className="border-l-2 border-stock-up/40 pl-2 space-y-0.5">
            <p className="font-semibold text-foreground">[Adaptive-Exit] 힘의 균열 감지 즉시 익절</p>
            <p>📉 고점 대비 -0.5% 하락 OR 체결강도 80% 미만 → 현재가 즉시 익절</p>
            <p>🔒 어떤 경우에도 본절가(+0.2%) 아래 매도 금지</p>
          </div>
          <div className="border-l-2 border-primary/40 pl-2 space-y-0.5">
            <p className="font-semibold text-foreground">[저가주 호가 최적화] ₩12,000↓</p>
            <p>💎 호가창 얇아질 조짐 → AI 추천 구간에서 선제적 매도</p>
            <p>🛡️ Iron-Defense: +1% → SL+0.2% | +3% → 즉시 확정</p>
          </div>
        </CardContent>
      </Card>

      {/* ★ 일일 목표 달성 축하 배너 + 라운드 정보 */}
      {dailyTargetHit ? (
        <Card className="border-stock-up/50 bg-stock-up/10">
          <CardContent className="p-4 flex items-center gap-3">
            <span className="text-3xl">🏆🔄</span>
            <div>
              <p className="text-lg font-bold text-stock-up">Round {currentRound > 1 ? currentRound - 1 : 1} 목표 달성! → Round {currentRound} 재공략 중 🎯</p>
              <p className="text-sm text-muted-foreground">
                현재 라운드 수익: <span className="font-bold font-mono text-stock-up">₩{currentRoundPnl.toLocaleString('ko-KR')}</span> / 목표 ₩{DAILY_TARGET_KRW.toLocaleString('ko-KR')}
              </p>
              {cumulativeProfit > 0 && (
                <p className="text-sm text-muted-foreground">
                  🏦 오늘 총 누적 수익 (안전 자산): <span className="font-bold font-mono text-stock-up">₩{totalDayProfit.toLocaleString('ko-KR')}</span>
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-primary/20">
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">
                💰 {currentRound > 1 ? `[Round ${currentRound}]` : ''} 수익 목표 진행률
              </span>
              <span className="text-xs font-mono font-bold">
                ₩{currentRoundPnl.toLocaleString('ko-KR')} / ₩{DAILY_TARGET_KRW.toLocaleString('ko-KR')} ({dailyProgress.toFixed(1)}%)
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${dailyProgress >= 80 ? 'bg-stock-up' : dailyProgress >= 40 ? 'bg-warning' : 'bg-primary'}`}
                style={{ width: `${dailyProgress}%` }}
              />
            </div>
            {cumulativeProfit > 0 && (
              <p className="text-[10px] text-muted-foreground mt-1">
                🏦 이전 라운드 누적 수익 (안전 자산): ₩{cumulativeProfit.toLocaleString('ko-KR')} | 오늘 총: ₩{totalDayProfit.toLocaleString('ko-KR')}
              </p>
            )}
          </CardContent>
        </Card>
      )}

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
        <Card className="border-stock-up/40 bg-stock-up/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-stock-up" />
              <span className="text-xs font-medium text-stock-up">매수 가능 현금</span>
            </div>
            <p className="text-xl font-bold font-mono text-stock-up">
              ₩{Math.round(Math.max(0, confirmedBalance)).toLocaleString('ko-KR')}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">종목당 최대: ₩{Math.round(Math.max(0, confirmedBalance) * 0.33).toLocaleString('ko-KR')} (33%)</p>
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
              onSave={async (val) => { await updateUnifiedBalance(val); await refetch(); }}
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
            <p className="text-[10px] text-muted-foreground">실현 PnL 기준</p>
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

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
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
              <Clock className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">평균 보유</span>
            </div>
            <p className="text-xl font-bold font-mono">{stats.avgHoldTimeMinutes || 0}분</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">매수 여력 (종목당)</span>
            </div>
            <p className="text-xl font-bold font-mono">
              ₩{Math.round(confirmedBalance * 0.33).toLocaleString('ko-KR')}
            </p>
            <p className="text-[10px] text-muted-foreground">확정 잔고의 33% (슈퍼/급상승)</p>
          </CardContent>
        </Card>
      </div>

      {/* Cap Type Summary */}
      {openPositions.length > 0 && (
        <div className="flex items-center gap-3 text-xs">
          <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">
            대형주 {largePositions.length}종목 | PnL ₩{(stats.largePnl || 0).toLocaleString()}
          </Badge>
          <Badge variant="outline" className="text-[10px] border-warning/30 text-warning">
            소형주 {smallPositions.length}종목 | PnL ₩{(stats.smallPnl || 0).toLocaleString()}
          </Badge>
        </div>
      )}

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
                liveScore={liveScoreMap.get(pos.symbol) ?? null}
                prevScore={prevScoreMap.get(pos.symbol) ?? null}
                onSelect={() => setSelectedSymbol(pos.symbol === selectedSymbol ? null : pos.symbol)}
                isSelected={pos.symbol === selectedSymbol}
                onOpenModal={() => setModalSymbol(pos.symbol)}
                valueGradeData={valueGrades?.[pos.symbol] || null}
              />
            ))}
          </CardContent>
        </Card>
      )}

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

      {/* ★ 레이더 차트 & 수급 분석 모달 */}
      <PositionAnalysisModal
        open={!!modalSymbol}
        onOpenChange={(open) => { if (!open) setModalSymbol(null); }}
        position={openPositions.find((p: any) => p.symbol === modalSymbol) || null}
        quantStock={modalSymbol ? allQuantStocks.find((s: any) => s.symbol === modalSymbol) : null}
        livePrice={modalSymbol ? wsGetPrice?.(modalSymbol) : null}
        liveScore={modalSymbol ? (liveScoreMap.get(modalSymbol) ?? null) : null}
        fxRate={fxRate}
      />

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
                거래 기록이 없습니다. Cloud Agent가 자율 매매를 시작합니다.
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
