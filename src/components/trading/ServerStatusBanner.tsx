import { Badge } from "@/components/ui/badge";
import { useAgentStatus } from "@/hooks/useAgentStatus";
import { Cloud, Activity, AlertTriangle } from "lucide-react";

export function ServerStatusBanner() {
  const { data: status, isLoading } = useAgentStatus();

  if (isLoading) return null;

  const lastHeartbeat = status?.last_heartbeat ? new Date(status.last_heartbeat) : null;
  const isAlive = lastHeartbeat ? (Date.now() - lastHeartbeat.getTime()) < 180000 : false; // 3 min
  const totalCycles = status?.total_cycles || 0;

  return (
    <div className={`rounded-lg px-4 py-2.5 flex items-center justify-between flex-wrap gap-2 border ${
      isAlive 
        ? 'border-stock-up/50 bg-stock-up/5' 
        : 'border-destructive/50 bg-destructive/5'
    }`}>
      <div className="flex items-center gap-3">
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold ${
          isAlive 
            ? 'bg-stock-up/20 text-stock-up' 
            : 'bg-destructive/20 text-destructive'
        }`}>
          <div className={`w-2.5 h-2.5 rounded-full ${isAlive ? 'bg-stock-up animate-pulse' : 'bg-destructive'}`} />
          {isAlive ? (
            <>
              <Cloud className="w-3.5 h-3.5" />
              SERVER STATUS: RUNNING (24/7 ACTIVE)
            </>
          ) : (
            <>
              <AlertTriangle className="w-3.5 h-3.5" />
              SERVER STATUS: OFFLINE
            </>
          )}
        </div>
        <Badge variant="outline" className="text-[10px] font-mono">
          <Activity className="w-3 h-3 mr-1" />
          사이클: {totalCycles.toLocaleString()}회
        </Badge>
        {status?.errors_count > 0 && (
          <Badge variant="outline" className="text-[10px] text-destructive border-destructive/30">
            오류: {status.errors_count}
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-muted-foreground font-mono">
          마지막 심박: {lastHeartbeat ? lastHeartbeat.toLocaleTimeString('ko-KR') : 'N/A'}
        </span>
        <Badge variant="outline" className="text-[10px]">
          1분 간격 자율 실행
        </Badge>
      </div>
    </div>
  );
}
