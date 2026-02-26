import { Badge } from "@/components/ui/badge";
import { Wifi, WifiOff } from "lucide-react";

interface LiveSyncIndicatorProps {
  isConnected: boolean;
  latencyMs: number;
  lastUpdateAt: number;
}

export function LiveSyncIndicator({ isConnected, latencyMs, lastUpdateAt }: LiveSyncIndicatorProps) {
  const sinceUpdate = lastUpdateAt ? Math.round((Date.now() - lastUpdateAt) / 1000) : null;

  if (!isConnected) {
    return (
      <Badge variant="outline" className="text-[10px] px-2 py-0.5 border-destructive/30 text-destructive gap-1.5 animate-pulse">
        <WifiOff className="w-3 h-3" />
        Offline — Polling 모드
      </Badge>
    );
  }

  const latencyLabel = latencyMs < 1000
    ? `${latencyMs}ms`
    : `${(latencyMs / 1000).toFixed(1)}s`;

  const latencyColor = latencyMs < 500
    ? 'text-stock-up border-stock-up/30'
    : latencyMs < 2000
      ? 'text-warning border-warning/30'
      : 'text-destructive border-destructive/30';

  return (
    <Badge variant="outline" className={`text-[10px] px-2 py-0.5 gap-1.5 ${latencyColor}`}>
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-stock-up opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-stock-up" />
      </span>
      <Wifi className="w-3 h-3" />
      Live Sync: {latencyLabel}
    </Badge>
  );
}
