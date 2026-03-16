import { Badge } from "@/components/ui/badge";
import { useAgentStatus } from "@/hooks/useAgentStatus";
import { Cloud, AlertTriangle, Activity, Clock, Sun, Moon, Sunrise, Radio } from "lucide-react";
import { useState, useEffect } from "react";

type SessionType = 'PRE_MARKET' | 'REGULAR' | 'AFTER_HOURS' | 'DAY';

function getMarketSession(): { session: SessionType; label: string } {
  const now = new Date();
  const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const h = et.getHours(), m = et.getMinutes(), day = et.getDay();
  const time = h * 60 + m;
  if (day === 0 || day === 6) return { session: 'DAY', label: '데이장(주말)' };
  if (time >= 240 && time < 570) return { session: 'PRE_MARKET', label: '프리마켓' };
  if (time >= 570 && time < 960) return { session: 'REGULAR', label: '정규장' };
  if (time >= 960 && time < 1200) return { session: 'AFTER_HOURS', label: '애프터마켓' };
  return { session: 'DAY', label: '데이장' };
}

const SESSION_ICON: Record<SessionType, React.ReactNode> = {
  PRE_MARKET: <Sunrise className="w-3 h-3" />,
  REGULAR: <Sun className="w-3 h-3" />,
  AFTER_HOURS: <Moon className="w-3 h-3" />,
  DAY: <Clock className="w-3 h-3" />,
};

export function ServerStatusBanner() {
  const { data: status, isLoading } = useAgentStatus();
  const [sessionInfo, setSessionInfo] = useState(getMarketSession());
  const [etTime, setEtTime] = useState('');

  useEffect(() => {
    const update = () => {
      setSessionInfo(getMarketSession());
      const et = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
      setEtTime(et.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }));
    };
    update();
    const interval = setInterval(update, 10000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading) return null;

  const lastHeartbeat = status?.last_heartbeat ? new Date(status.last_heartbeat) : null;
  const isAlive = lastHeartbeat ? (Date.now() - lastHeartbeat.getTime()) < 180000 : false;

  return (
    <div className={`rounded-lg px-3 py-1.5 flex items-center justify-between flex-wrap gap-1.5 border text-xs ${
      isAlive ? 'border-stock-up/30 bg-stock-up/5' : 'border-destructive/30 bg-destructive/5'
    }`}>
      <div className="flex items-center gap-2">
        <div className={`w-1.5 h-1.5 rounded-full ${isAlive ? 'bg-stock-up animate-pulse' : 'bg-destructive'}`} />
        {isAlive ? (
          <span className="text-stock-up font-medium flex items-center gap-1">
            <Cloud className="w-3 h-3" /> 24h 자동매매
          </span>
        ) : (
          <span className="text-destructive font-medium flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> 오프라인
          </span>
        )}
        <span className="text-muted-foreground">·</span>
        <span className="flex items-center gap-1 text-muted-foreground">
          {SESSION_ICON[sessionInfo.session]}
          {sessionInfo.label}
        </span>
        <span className="text-muted-foreground font-mono">{etTime} ET</span>
      </div>
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className="font-mono">{(status?.total_cycles || 0).toLocaleString()}회</span>
        {status?.errors_count > 0 && (
          <span className="text-destructive">{status.errors_count}err</span>
        )}
      </div>
    </div>
  );
}
