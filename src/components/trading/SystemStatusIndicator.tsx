import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAgentLogs } from "@/hooks/useAgentStatus";
import { AlertTriangle, CheckCircle2, AlertOctagon } from "lucide-react";
import { useMemo } from "react";

/**
 * [시스템 상태 지시등] + [최근 에러 로그 리스트]
 * - 최근 15분 이내 error/fill_failed/warning 발생 여부로 녹/적 판정
 * - agent_logs에서 error·warning·fill_failed·hold(Triple-API탈락 다수) 요약
 */
export function SystemStatusIndicator() {
  const { data: logs = [] } = useAgentLogs(200);

  const { status, recentErrors, blockReasons, recoveredFatalCount } = useMemo(() => {
    const now = Date.now();
    const fifteenMin = 15 * 60 * 1000;
    const recent = (logs as any[]).filter(l => now - new Date(l.created_at).getTime() < fifteenMin);
    const fatalErrors = recent.filter(l => ['error', 'fill_failed'].includes(l.action));
    const warnings = recent.filter(l => l.action === 'warning');
    const latestFatalAt = fatalErrors.reduce((max, l) => Math.max(max, new Date(l.created_at).getTime()), 0);
    const latestProgressAt = recent
      .filter(l => !['error', 'fill_failed'].includes(l.action))
      .reduce((max, l) => Math.max(max, new Date(l.created_at).getTime()), 0);
    const activeFatalErrors = latestFatalAt > latestProgressAt
      ? fatalErrors.filter(l => new Date(l.created_at).getTime() >= latestFatalAt)
      : [];
    const errs = [...activeFatalErrors, ...warnings].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    // 매수 정지 원인 집계 (Triple-API 탈락 사유)
    const holds = recent.filter(l => l.action === 'hold' && typeof l.message === 'string' && l.message.includes('탈락'));
    const reasonCounts: Record<string, number> = {};
    holds.forEach(h => {
      const m = String(h.message).match(/\[([^\]]+)\]/g);
      m?.slice(1).forEach(tag => {
        const clean = tag.replace(/[\[\]]/g, '');
        clean.split('|').forEach(r => {
          const key = r.replace(/[0-9.%$()✗<>≤≥]/g, '').trim().slice(0, 30);
          if (key) reasonCounts[key] = (reasonCounts[key] || 0) + 1;
        });
      });
    });
    const topReasons = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const st = activeFatalErrors.length > 0 ? 'error' : warnings.length > 0 ? 'warn' : 'ok';
    return { status: st, recentErrors: errs.slice(0, 20), blockReasons: topReasons, recoveredFatalCount: fatalErrors.length - activeFatalErrors.length };
  }, [logs]);

  const statusStyle = status === 'ok'
    ? 'bg-stock-up/20 text-stock-up border-stock-up/50'
    : status === 'warn'
      ? 'bg-warning/20 text-warning border-warning/50'
      : 'bg-destructive/20 text-destructive border-destructive/50';

  const Icon = status === 'ok' ? CheckCircle2 : status === 'warn' ? AlertTriangle : AlertOctagon;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2 flex-wrap">
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border ${statusStyle}`}>
            <div className={`w-2.5 h-2.5 rounded-full ${status === 'ok' ? 'bg-stock-up animate-pulse' : status === 'warn' ? 'bg-warning' : 'bg-destructive animate-pulse'}`} />
            <Icon className="w-3.5 h-3.5" />
            시스템 상태: {status === 'ok' ? '정상 (녹색)' : status === 'warn' ? '경고 (황색)' : '오류 (적색)'}
          </div>
          <Badge variant="outline" className="text-[10px] font-mono ml-auto">
            활성 이슈 {recentErrors.length}건
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {blockReasons.length > 0 && (
          <div className="rounded-md bg-muted/40 p-2 border border-border/50">
            <div className="text-[10px] font-semibold text-muted-foreground mb-1">🚧 매수 차단 사유 Top (최근 15분)</div>
            <div className="flex flex-wrap gap-1.5">
              {blockReasons.map(([reason, count]) => (
                <Badge key={reason} variant="secondary" className="text-[10px]">
                  {reason} × {count}
                </Badge>
              ))}
            </div>
          </div>
        )}
        <div>
          <div className="text-[10px] font-semibold text-muted-foreground mb-1">📋 최근 시스템 에러 로그</div>
          {recoveredFatalCount > 0 && status !== 'error' && (
            <p className="text-xs text-muted-foreground py-2">
              최근 치명 오류 {recoveredFatalCount}건은 이후 엔진 진행 로그가 확인되어 복구 처리됨
            </p>
          )}
          {recentErrors.length === 0 ? (
            <p className="text-xs text-muted-foreground py-3 text-center">에러 없음 — 시스템 정상 가동 중</p>
          ) : (
            <ScrollArea className="h-[180px]">
              <div className="space-y-1">
                {recentErrors.map((log: any) => {
                  const time = new Date(log.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                  const isErr = log.action === 'error' || log.action === 'fill_failed';
                  return (
                    <div key={log.id} className="flex items-start gap-2 text-xs py-1 border-b border-border/30">
                      <span className="text-muted-foreground font-mono shrink-0 w-16">{time}</span>
                      <Badge variant={isErr ? 'destructive' : 'secondary'} className="text-[9px] shrink-0">
                        {log.action}
                      </Badge>
                      {log.symbol && <span className="font-bold font-mono text-primary shrink-0">{log.symbol}</span>}
                      <span className={`${isErr ? 'text-destructive' : 'text-warning'} break-words`}>{log.message}</span>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
