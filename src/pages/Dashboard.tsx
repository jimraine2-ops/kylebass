import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Radio, Bot, Wallet, TrendingUp, TrendingDown, Briefcase, Activity, Target, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { LiveSyncIndicator } from "@/components/trading/LiveSyncIndicator";
import { SessionIndicator } from "@/components/trading/SessionIndicator";
import { ServerStatusBanner } from "@/components/trading/ServerStatusBanner";

import { useWebSocketPrices } from "@/hooks/useWebSocketPrice";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { useUnifiedPortfolio } from "@/hooks/useStockData";
import { useAgentStatus, useAgentLogs } from "@/hooks/useAgentStatus";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import { formatStockName } from "@/lib/koreanStockMap";

function useEarningsWatch() {
  return useQuery({
    queryKey: ['earnings-watch'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('earnings-watch');
      if (error) throw error;
      return data;
    },
    refetchInterval: 5 * 60 * 1000,
    staleTime: 2 * 60 * 1000,
  });
}

export default function Dashboard() {
  const { data: unifiedData, isLoading: portfolioLoading } = useUnifiedPortfolio();
  const { data: agentStatus } = useAgentStatus();
  const { data: logs = [] } = useAgentLogs(5);
  const { data: earningsData } = useEarningsWatch();
  const { rate: fxRate, isLive: fxLive } = useExchangeRate();

  const allSymbols = useMemo(() => {
    const syms = new Set<string>();
    (unifiedData?.openPositions || []).forEach((p: any) => syms.add(p.symbol));
    return Array.from(syms);
  }, [unifiedData?.openPositions]);

  const ws = useWebSocketPrices(allSymbols);

  const wallet = unifiedData?.wallet;
  const balance = wallet?.balance || 0;
  const initial = wallet?.initial_balance || balance;
  const totalReturn = initial > 0 ? ((balance - initial) / initial * 100) : 0;
  const openPositions = unifiedData?.openPositions || [];
  const stats = unifiedData?.stats || {} as any;

  const earningsStocks = earningsData?.stocks || [];
  const preBuyCandidates = earningsStocks.filter((s: any) => s.isPreBuy);

  const isAgentRunning = agentStatus?.is_running ?? false;
  const lastLog = logs[0];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold">대시보드</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <LiveSyncIndicator isConnected={ws.isConnected} latencyMs={ws.latencyMs} lastUpdateAt={ws.lastUpdateAt} />
          <Badge variant="outline" className={`text-[10px] px-2 py-0.5 ${fxLive ? 'border-stock-up/30 text-stock-up' : 'border-warning/30 text-warning'}`}>
            💱 ₩{fxRate.toLocaleString('ko-KR')}
          </Badge>
          <SessionIndicator />
        </div>
      </div>

      <ServerStatusBanner />

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* 총 잔고 */}
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
              <Wallet className="w-3.5 h-3.5" />
              <span className="text-[10px] font-medium">총 잔고</span>
            </div>
            <p className="text-base font-bold font-mono">₩{Math.round(balance).toLocaleString('ko-KR')}</p>
            <p className={`text-[11px] font-mono font-semibold ${totalReturn >= 0 ? 'text-stock-up' : 'text-stock-down'}`}>
              {totalReturn >= 0 ? '▲' : '▼'} {totalReturn >= 0 ? '+' : ''}{totalReturn.toFixed(2)}%
            </p>
          </CardContent>
        </Card>

        {/* 보유 종목 */}
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
              <Briefcase className="w-3.5 h-3.5" />
              <span className="text-[10px] font-medium">보유 종목</span>
            </div>
            <p className="text-base font-bold font-mono">{openPositions.length}개</p>
            <p className="text-[11px] text-muted-foreground">
              승률 {stats.winRate || 0}% · {stats.totalTrades || 0}거래
            </p>
          </CardContent>
        </Card>

        {/* 에이전트 상태 */}
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
              <Bot className="w-3.5 h-3.5" />
              <span className="text-[10px] font-medium">에이전트</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${isAgentRunning ? 'bg-stock-up animate-pulse' : 'bg-muted-foreground'}`} />
              <span className="text-sm font-semibold">{isAgentRunning ? '가동 중' : '정지'}</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {agentStatus?.total_cycles || 0}사이클 · 오류 {agentStatus?.errors_count || 0}
            </p>
          </CardContent>
        </Card>

        {/* 실적 임박 */}
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
              <CalendarDays className="w-3.5 h-3.5" />
              <span className="text-[10px] font-medium">실적 임박</span>
            </div>
            <p className="text-base font-bold font-mono">{earningsStocks.length}종목</p>
            <p className="text-[11px] text-yellow-400 font-medium">
              🎯 선취매 {preBuyCandidates.length}개
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Two Column: 보유종목 + 실적임박 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 보유 종목 요약 */}
        <Card>
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-primary" />보유 종목
              </span>
              <Link to="/ai-trading" className="text-[10px] text-primary flex items-center hover:underline">
                상세보기 <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            {openPositions.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">보유 종목 없음</p>
            ) : (
              <div className="space-y-1.5">
                {openPositions.slice(0, 5).map((pos: any) => {
                  const livePrice = ws.getPrice(pos.symbol) || pos.price;
                  const pnlPct = ((livePrice - pos.price) / pos.price) * 100;
                  const pnlKRW = Math.round((livePrice - pos.price) * pos.quantity * fxRate);
                  const isUp = pnlPct >= 0;
                  return (
                    <Link key={pos.id} to={`/stock/${pos.symbol}`}
                      className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-semibold text-xs truncate">{formatStockName(pos.symbol)}</span>
                        <span className="text-[10px] text-muted-foreground font-mono">{pos.quantity}주</span>
                      </div>
                      <div className={`flex items-center gap-1 text-xs font-bold font-mono ${isUp ? 'text-stock-up' : 'text-stock-down'}`}>
                        {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {isUp ? '+' : ''}{pnlPct.toFixed(1)}%
                        <span className="text-[10px] font-normal ml-1">({isUp ? '+' : ''}₩{pnlKRW.toLocaleString('ko-KR')})</span>
                      </div>
                    </Link>
                  );
                })}
                {openPositions.length > 5 && (
                  <Link to="/ai-trading" className="block text-center text-[10px] text-primary pt-1 hover:underline">
                    +{openPositions.length - 5}개 더보기
                  </Link>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 실적 임박 요약 */}
        <Card>
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5 text-primary" />실적 임박 종목
              </span>
              <Link to="/earnings-watch" className="text-[10px] text-primary flex items-center hover:underline">
                전체보기 <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            {earningsStocks.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">실적 발표 예정 종목 없음</p>
            ) : (
              <div className="space-y-1.5">
                {earningsStocks.slice(0, 5).map((s: any) => (
                  <div key={s.symbol} className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-semibold text-xs">{s.symbol}</span>
                      {s.isPreBuy && (
                        <Badge className="text-[8px] px-1 py-0 bg-yellow-500/20 text-yellow-400 border-yellow-500/50">선취매</Badge>
                      )}
                      <span className="text-[10px] text-muted-foreground">{s.date}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-muted-foreground">${s.price?.toFixed(2)}</span>
                      <Badge variant="outline" className={`text-[9px] font-mono ${s.winProb >= 88 ? 'border-yellow-500/50 text-yellow-400' : ''}`}>
                        {s.winProb}%
                      </Badge>
                    </div>
                  </div>
                ))}
                {earningsStocks.length > 5 && (
                  <Link to="/earnings-watch" className="block text-center text-[10px] text-primary pt-1 hover:underline">
                    +{earningsStocks.length - 5}개 더보기
                  </Link>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 최근 에이전트 활동 */}
      <Card>
        <CardContent className="p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-primary" />최근 활동
            </span>
            <Link to="/ai-trading" className="text-[10px] text-primary flex items-center hover:underline">
              전체 로그 <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          {logs.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3">활동 기록 없음</p>
          ) : (
            <div className="space-y-1">
              {logs.slice(0, 5).map((log: any) => (
                <div key={log.id} className="flex items-center gap-2 text-[11px] py-1 px-2 rounded hover:bg-muted/30">
                  <Badge variant={log.action === 'buy' ? 'default' : log.action === 'exit' || log.action === 'sell' ? 'destructive' : 'secondary'}
                    className="text-[8px] px-1.5 py-0 shrink-0">
                    {log.action}
                  </Badge>
                  {log.symbol && <span className="font-mono font-medium shrink-0">{formatStockName(log.symbol)}</span>}
                  <span className="text-muted-foreground truncate">{log.message}</span>
                  <span className="text-[9px] text-muted-foreground shrink-0 ml-auto">
                    {new Date(log.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
