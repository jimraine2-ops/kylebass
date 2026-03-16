import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAgentLogs } from "@/hooks/useAgentStatus";
import { Radio, ChevronDown } from "lucide-react";
import { formatStockName } from "@/lib/koreanStockMap";
import { useState } from "react";

export function AgentLogViewer() {
  const { data: logs = [], isLoading } = useAgentLogs(50);
  const [open, setOpen] = useState(false);

  const getActionColor = (action: string) => {
    switch (action) {
      case 'buy': return 'text-stock-up';
      case 'exit': case 'sell': return 'text-stock-down';
      case 'exit_attempt': return 'text-warning';
      case 'defense': return 'text-primary';
      case 'replace': return 'text-chart-4';
      case 'error': return 'text-destructive';
      default: return 'text-muted-foreground';
    }
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'buy': return 'default';
      case 'exit': case 'sell': return 'destructive' as const;
      case 'exit_attempt': return 'secondary' as const;
      case 'defense': return 'default' as const;
      case 'error': return 'destructive' as const;
      default: return 'secondary' as const;
    }
  };

  return (
    <Card>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-muted/50 transition-colors rounded-t-lg">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Radio className="w-3.5 h-3.5 text-stock-up animate-pulse" />
            에이전트 로그
            <Badge variant="outline" className="text-[9px] font-mono">
              {logs.length}건
            </Badge>
          </div>
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 pb-3">
            {isLoading ? (
              <p className="text-sm text-muted-foreground text-center py-3">로딩 중...</p>
            ) : logs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-3">로그가 없습니다.</p>
            ) : (
              <ScrollArea className="h-[240px]">
                <div className="space-y-0.5">
                  {logs.map((log: any) => {
                    const time = new Date(log.created_at).toLocaleTimeString('ko-KR', {
                      hour: '2-digit', minute: '2-digit', second: '2-digit',
                    });
                    return (
                      <div key={log.id} className="flex items-start gap-1.5 text-[11px] py-0.5 border-b border-border/20">
                        <span className="text-muted-foreground font-mono shrink-0 w-14">{time}</span>
                        <Badge variant={getActionBadge(log.action)} className="text-[8px] shrink-0 w-10 justify-center py-0 h-4">
                          {log.action}
                        </Badge>
                        {log.symbol && (
                          <span className="font-bold font-mono shrink-0 text-primary text-[10px]">{formatStockName(log.symbol)}</span>
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
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
