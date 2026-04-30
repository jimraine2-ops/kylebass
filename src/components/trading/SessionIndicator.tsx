import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Clock, Sun, Moon, Sunrise, Zap, Radio } from "lucide-react";

type SessionType = 'PRE_MARKET' | 'REGULAR' | 'AFTER_HOURS' | 'DAY';

function getMarketSession(): { session: SessionType; label: string; nextEvent: string } {
  const now = new Date();
  const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const h = et.getHours();
  const m = et.getMinutes();
  const day = et.getDay();
  const time = h * 60 + m;

  // 토요일 전체 + 일요일 20:00 ET 이전 = 주말 휴장
  if (day === 6 || (day === 0 && time < 1200)) {
    return { session: 'DAY', label: '데이장(주말)', nextEvent: '월요일 프리마켓 04:00 ET' };
  }
  // 일요일 20:00 ET 이후 = 월요일 대비 오버나이트
  if (day === 0 && time >= 1200) {
    return { session: 'PRE_MARKET', label: '오버나이트(월요일 대기)', nextEvent: '프리마켓 04:00 ET' };
  }
  if (time >= 240 && time < 570) {
    return { session: 'PRE_MARKET', label: '프리마켓', nextEvent: '정규장 09:30 ET' };
  }
  if (time >= 570 && time < 960) {
    return { session: 'REGULAR', label: '정규장', nextEvent: '장 마감 16:00 ET' };
  }
  if (time >= 960 && time < 1200) {
    return { session: 'AFTER_HOURS', label: '애프터마켓', nextEvent: '데이장 전환 20:00 ET' };
  }
  return { session: 'DAY', label: '데이장', nextEvent: '프리마켓 04:00 ET' };
}

const SESSION_STYLES: Record<SessionType, { icon: React.ReactNode; className: string }> = {
  PRE_MARKET: { icon: <Sunrise className="w-3.5 h-3.5" />, className: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  REGULAR: { icon: <Sun className="w-3.5 h-3.5" />, className: 'bg-stock-up/20 text-stock-up border-stock-up/30' },
  AFTER_HOURS: { icon: <Moon className="w-3.5 h-3.5" />, className: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  DAY: { icon: <Clock className="w-3.5 h-3.5" />, className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
};

const SLIPPAGE_INFO: Record<SessionType, string> = {
  PRE_MARKET: '슬리피지 0.25%',
  REGULAR: '슬리피지 0.02%',
  AFTER_HOURS: '슬리피지 0.20%',
  DAY: '슬리피지 0.30%',
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
  const slippageNote = SLIPPAGE_INFO[sessionInfo.session];

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* 현재 세션 */}
      <Badge variant="outline" className={`text-xs px-2 py-1 flex items-center gap-1.5 ${style.className}`}>
        <div className="w-2 h-2 rounded-full bg-current animate-pulse" />
        {style.icon}
        현재: {sessionInfo.label} 가동 중
      </Badge>

      {/* 24h Full-Auto 상태 */}
      <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 gap-1 border-stock-up/30 text-stock-up bg-stock-up/10">
        <Radio className="w-3 h-3 animate-pulse" />
        24h Full-Auto
      </Badge>

      {/* 슬리피지 정보 */}
      <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 gap-1 border-muted-foreground/30 text-muted-foreground">
        <Zap className="w-3 h-3" />
        {slippageNote}
      </Badge>

      {/* ET 시간 */}
      <span className="text-[10px] font-mono text-muted-foreground">
        ET {etTime}
      </span>
      <span className="text-[10px] text-muted-foreground hidden sm:inline">
        → {sessionInfo.nextEvent}
      </span>
    </div>
  );
}
