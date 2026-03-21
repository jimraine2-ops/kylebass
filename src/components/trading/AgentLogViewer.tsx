import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAgentLogs } from "@/hooks/useAgentStatus";
import { Radio, ShieldCheck, TrendingUp, Clock, Target, AlertTriangle } from "lucide-react";
import { formatStockName } from "@/lib/koreanStockMap";
import { useUnifiedPortfolio } from "@/hooks/useStockData";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { useMemo } from "react";

const KRW_RATE_FALLBACK = 1350;

function fmtKRW(v: number) {
  return `₩${Math.floor(v).toLocaleString('ko-KR')}`;
}

function holdMinutes(openedAt: string): number {
  return Math.floor((Date.now() - new Date(openedAt).getTime()) / 60000);
}

function PinnedPositionCard({ pos, fxRate }: { pos: any; fxRate: number }) {
  const pnlPct = ((pos.close_price || pos.price) - pos.price) / pos.price * 100;
  const pnlKRW = Math.floor(((pos.close_price || pos.price) - pos.price) * pos.quantity * fxRate);
  const costKRW = Math.floor(pos.price * pos.quantity * fxRate);
  const slPct = pos.stop_loss ? ((pos.stop_loss / pos.price) - 1) * 100 : 0;
  const tpPct = pos.take_profit ? ((pos.take_profit / pos.price) - 1) * 100 : 0;
  const confidence = pos.ai_confidence ?? pos.entry_score ?? 0;
  const isHighConf = confidence >= 90;
  const isProfit = pnlKRW >= 0;
  const zeroRiskLocked = slPct > 0;
  const mins = holdMinutes(pos.opened_at);

  return (
    <div className="rounded-lg border border-border/50 bg-card/80 p-2.5 space-y-1.5">
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {zeroRiskLocked && <ShieldCheck className="w-3.5 h-3.5 text-stock-up" />}
          <span className="font-bold font-mono text-sm text-primary">{formatStockName(pos.symbol)}</span>
          <Badge variant="outline" className="text-[9px] px-1.5 py-0">
            {pos.entry_score ?? 0}점
          </Badge>
        </div>
        <span className={`font-bold text-sm font-mono ${isProfit ? 'text-stock-up' : 'text-stock-down'}`}>
          {isProfit ? '+' : ''}{pnlPct.toFixed(2)}%
        </span>
      </div>

      {/* Detail grid */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px]">
        <div className="flex justify-between">
          <span className="text-muted-foreground">PnL</span>
          <span className={`font-mono font-semibold ${isProfit ? 'text-stock-up' : 'text-stock-down'}`}>
            {isProfit ? '+' : ''}{fmtKRW(pnlKRW)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">투자금</span>
          <span className="font-mono text-foreground">{fmtKRW(costKRW)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">손절가</span>
          <span className={`font-mono ${zeroRiskLocked ? 'text-stock-up' : 'text-stock-down'}`}>
            {pos.stop_loss ? `${fmtKRW(pos.stop_loss * fxRate)} (${slPct >= 0 ? '+' : ''}${slPct.toFixed(1)}%)` : '-'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">목표가</span>
          <span className="font-mono text-warning">
            {pos.take_profit ? `${fmtKRW(pos.take_profit * fxRate)} (+${tpPct.toFixed(1)}%)` : '-'}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />보유</span>
          <span className="font-mono text-foreground">{mins}분</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">신뢰도</span>
          <span className={`font-mono font-semibold ${isHighConf ? 'text-yellow-400' : 'text-foreground'}`}>
            {confidence}%{isHighConf ? ' 🏆' : ''}
          </span>
        </div>
      </div>
    </div>
  );
}

function LogEntry({ log, fxRate }: { log: any; fxRate: number }) {
  const time = new Date(log.created_at).toLocaleTimeString('ko-KR', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });

  const details = log.details || {};
  const pnlPct = details.pnlPct;
  const score = details.score ?? details.quantScore;
  const confidence = details.confidence;

  const getActionStyle = (action: string) => {
    switch (action) {
      case 'buy': return { badge: 'default' as const, color: 'text-stock-up', icon: '🚀' };
      case 'exit': case 'sell': return { badge: 'destructive' as const, color: 'text-stock-down', icon: '💰' };
      case 'exit_attempt': return { badge: 'secondary' as const, color: 'text-warning', icon: '⚠️' };
      case 'defense': return { badge: 'default' as const, color: 'text-primary', icon: '🛡️' };
      case 'replace': return { badge: 'secondary' as const, color: 'text-chart-4', icon: '🔄' };
      case 'hold': return { badge: 'secondary' as const, color: 'text-muted-foreground', icon: '⏳' };
      case 'milestone': return { badge: 'default' as const, color: 'text-yellow-400', icon: '🎯' };
      case 'error': return { badge: 'destructive' as const, color: 'text-destructive', icon: '❌' };
      default: return { badge: 'secondary' as const, color: 'text-muted-foreground', icon: '📋' };
    }
  };

  const style = getActionStyle(log.action);

  // Check for high confidence in message
  const isHighConf = log.message?.includes('90%') || log.message?.includes('필승') || log.message?.includes('슈퍼');

  return (
    <div className="py-1.5 border-b border-border/20 space-y-0.5">
      {/* Main line */}
      <div className="flex items-start gap-1.5 text-xs">
        <span className="text-muted-foreground font-mono shrink-0 w-[52px] text-[10px]">{time}</span>
        <Badge variant={style.badge} className="text-[9px] shrink-0 w-[50px] justify-center gap-0.5">
          {style.icon} {log.action}
        </Badge>
        {log.symbol && (
          <span className="font-bold font-mono shrink-0 text-primary text-[11px]">
            {formatStockName(log.symbol)}
          </span>
        )}
        <span className={`${isHighConf ? 'text-yellow-400 font-semibold' : style.color} text-[11px] leading-tight`}>
          {log.message}
        </span>
      </div>

      {/* Detail chips */}
      {(score !== undefined || pnlPct !== undefined || confidence !== undefined) && (
        <div className="flex items-center gap-1.5 ml-[52px] flex-wrap">
          {score !== undefined && (
            <span className="text-[9px] bg-muted/50 rounded px-1 py-0.5 font-mono">
              지표 {score}점
            </span>
          )}
          {pnlPct !== undefined && (
            <span className={`text-[9px] rounded px-1 py-0.5 font-mono font-semibold ${
              pnlPct >= 0 ? 'bg-stock-up/10 text-stock-up' : 'bg-stock-down/10 text-stock-down'
            }`}>
              {pnlPct >= 0 ? '+' : ''}{pnlPct}%
            </span>
          )}
          {confidence !== undefined && (
            <span className={`text-[9px] rounded px-1 py-0.5 font-mono ${
              confidence >= 90 ? 'bg-yellow-500/20 text-yellow-400 font-bold' : 'bg-muted/50'
            }`}>
              신뢰도 {confidence}%
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function AgentLogViewer() {
  const { data: logs = [], isLoading } = useAgentLogs(50);
  const { data: portfolio } = useUnifiedPortfolio();
  const { rate: fxRate } = useExchangeRate();
  const effectiveRate = fxRate || KRW_RATE_FALLBACK;

  const openPositions = useMemo(() => {
    return (portfolio?.openPositions || [])
      .filter((p: any) => p.status === 'open')
      .slice(0, 5);
  }, [portfolio?.openPositions]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Radio className="w-4 h-4 text-stock-up animate-pulse" />
          실시간 매매 로그
          <Badge variant="outline" className="text-[10px] font-mono ml-auto gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-stock-up animate-pulse inline-block" />
            5초 자동갱신
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* ===== Pinned Positions (Top 5) ===== */}
        {openPositions.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-semibold">
              <Target className="w-3.5 h-3.5 text-primary" />
              정예 보유 종목 ({openPositions.length}/5)
            </div>
            <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {openPositions.map((pos: any) => (
                <PinnedPositionCard key={pos.id} pos={pos} fxRate={effectiveRate} />
              ))}
            </div>
          </div>
        )}

        {/* ===== Log Stream ===== */}
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-4">로딩 중...</p>
        ) : logs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            서버 에이전트 로그가 없습니다. 첫 사이클을 기다리는 중...
          </p>
        ) : (
          <ScrollArea className="h-[360px]">
            <div>
              {logs.map((log: any) => (
                <LogEntry key={log.id} log={log} fxRate={effectiveRate} />
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
