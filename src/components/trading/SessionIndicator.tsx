import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Clock, Sun, Moon, Sunrise, Zap } from "lucide-react";

type SessionType = 'PRE_MARKET' | 'REGULAR' | 'AFTER_HOURS' | 'DAY';

function getMarketSession(): { session: SessionType; label: string; nextEvent: string } {
  const now = new Date();
  const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const h = et.getHours();
  const m = et.getMinutes();
  const day = et.getDay();
  const time = h * 60 + m;

  // Weekend
  if (day === 0 || day === 6) {
    return { session: 'DAY', label: '데이장 운영 중', nextEvent: '월요일 프리마켓 04:00 ET' };
  }
  // Pre-market: 4:00 AM - 9:30 AM ET
  if (time >= 240 && time < 570) {
    return { session: 'PRE_MARKET', label: '프리마켓 운영 중', nextEvent: '정규장 개장 09:30 ET' };
  }
  // Regular: 9:30 AM - 4:00 PM ET
  if (time >= 570 && time < 960) {
    return { session: 'REGULAR', label: '정규장 운영 중', nextEvent: '장 마감 16:00 ET' };
  }
  // After-hours: 4:00 PM - 8:00 PM ET
  if (time >= 960 && time < 1200) {
    return { session: 'AFTER_HOURS', label: '애프터마켓 운영 중', nextEvent: '애프터마켓 종료 20:00 ET' };
  }
  // Closed (8 PM - 4 AM)
  return { session: 'DAY', label: '데이장 운영 중', nextEvent: '프리마켓 04:00 ET' };
}

const SESSION_STYLES: Record<SessionType, { icon: React.ReactNode; className: string }> = {
  PRE_MARKET: { icon: <Sunrise className="w-3.5 h-3.5" />, className: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  REGULAR: { icon: <Sun className="w-3.5 h-3.5" />, className: 'bg-stock-up/20 text-stock-up border-stock-up/30' },
  AFTER_HOURS: { icon: <Moon className="w-3.5 h-3.5" />, className: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  DAY: { icon: <Clock className="w-3.5 h-3.5" />, className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
};

export function SessionIndicator() {
  const [sessionInfo, setSessionInfo] = useState(getMarketSession());
  const [etTime, setEtTime] = useState('');

  useEffect(() => {
    const update = () => {
      setSessionInfo(getMarketSession());
      const now = new Date();
      const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
      setEtTime(et.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const style = SESSION_STYLES[sessionInfo.session];

  return (
    <div className="flex items-center gap-2">
      <Badge variant="outline" className={`text-xs px-2 py-1 flex items-center gap-1.5 ${style.className}`}>
        <div className="w-2 h-2 rounded-full bg-current animate-pulse" />
        {style.icon}
        {sessionInfo.label}
      </Badge>
      <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 gap-1 border-stock-up/30 text-stock-up">
        <Zap className="w-3 h-3" />
        24h 자동매매
      </Badge>
      <span className="text-[10px] font-mono text-muted-foreground">
        ET {etTime}
      </span>
      <span className="text-[10px] text-muted-foreground hidden sm:inline">
        → {sessionInfo.nextEvent}
      </span>
    </div>
  );
}
