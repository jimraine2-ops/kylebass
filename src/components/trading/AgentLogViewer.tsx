import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAgentLogs } from "@/hooks/useAgentStatus";
import { Radio } from "lucide-react";
import { formatStockName } from "@/lib/koreanStockMap";

export function AgentLogViewer() {
  const { data: logs = [], isLoading } = useAgentLogs(50);

  const getActionColor = (action: string) => {
    switch (action) {
      case 'buy': return 'text-stock-up';
      case 'exit': case 'sell': return 'text-stock-down';
      case 'error': return 'text-destructive';
      default: return 'text-muted-foreground';
    }
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'buy': return 'default';
      case 'exit': case 'sell': return 'destructive' as const;
      case 'error': return 'destructive' as const;
      default: return 'secondary' as const;
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Radio className="w-4 h-4 text-stock-up animate-pulse" />
          Cloud Agent 실시간 로그
          <Badge variant="outline" className="text-[10px] font-mono ml-auto">
            5초 자동갱신
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-4">로딩 중...</p>
        ) : logs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            서버 에이전트 로그가 없습니다. 첫 사이클을 기다리는 중...
          </p>
        ) : (
          <ScrollArea className="h-[300px]">
            <div className="space-y-1">
              {logs.map((log: any) => {
                const time = new Date(log.created_at).toLocaleTimeString('ko-KR', {
                  hour: '2-digit', minute: '2-digit', second: '2-digit',
                });
                return (
                  <div key={log.id} className="flex items-start gap-2 text-xs py-1 border-b border-border/30">
                    <span className="text-muted-foreground font-mono shrink-0 w-16">{time}</span>
                    <Badge variant={getActionBadge(log.action)} className="text-[9px] shrink-0 w-12 justify-center">
                      {log.action}
                    </Badge>
                    {log.symbol && (
                      <span className="font-bold font-mono shrink-0 text-primary">{formatStockName(log.symbol)}</span>
                    )}
                    <span className={`${getActionColor(log.action)} truncate`}>
                      {log.message}
                    </span>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
