import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Shield, Clock, Play, Pause, Zap, Target, Radio, Search, BarChart3, Crosshair } from "lucide-react";
import { cn } from "@/lib/utils";

type TimeSlotMode = 'safe-exit' | 'day-break' | 'active';

const SCAN_STAGES = [
  { icon: "🔍", label: "Finnhub 뉴스 수집 중", sub: "실시간 감성 분석" },
  { icon: "📊", label: "Twelve Data 지표 계산 중", sub: "RSI·MACD·볼린저" },
  { icon: "🎯", label: "₩12,000↓ 저가주 필터링", sub: "익절확률 95%↑ 선별" },
  { icon: "⚡", label: "0순위 종목 랭킹 생성", sub: "체결강도·수급 교차 검증" },
];

export function SafePauseBanner() {
  const [kstTime, setKstTime] = useState("");
  const [mode, setMode] = useState<TimeSlotMode>('active');
  const [countdown, setCountdown] = useState("");
  const [blink, setBlink] = useState(true);
  const [scanStage, setScanStage] = useState(0);
  const [scanProgress, setScanProgress] = useState(0);
  const [scannedCount, setScannedCount] = useState(0);
  useEffect(() => {
    const update = () => {
      const now = new Date();
      const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
      const h = kst.getUTCHours();
      const m = kst.getUTCMinutes();
      const s = kst.getUTCSeconds();
      setKstTime(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`);
      setBlink(prev => !prev);

      const totalMin = h * 60 + m;
      if (totalMin < 540) {
        // KST 9:00 이전 → Safe-Exit 대기
        setMode('safe-exit');
        const remaining = 540 - totalMin;
        const rh = Math.floor(remaining / 60);
        const rm = remaining % 60;
        setCountdown(`${rh}시간 ${rm}분`);
      } else if (totalMin >= 540 && totalMin < 545) {
        // KST 9:00~9:05 → Day-Break 공격 모드
        setMode('day-break');
        setCountdown("");
      } else {
        setMode('active');
        setCountdown("");
      }
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-2">
      {/* [Safe-Exit] 매수 일시 중지 배너 */}
      {mode === 'safe-exit' && (
        <div className="relative overflow-hidden rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Pause className="w-4 h-4 text-yellow-400" />
              <span
                className={cn("text-sm font-bold transition-opacity duration-500", blink ? "opacity-100" : "opacity-40")}
                style={{ color: "hsl(45, 100%, 60%)" }}
              >
                [Safe-Exit] 프리마켓 청산 완료 — 오전 9시 재개 대기
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-[10px] px-2 py-0.5 border-yellow-500/30 text-yellow-400 bg-yellow-500/10 gap-1">
                <Clock className="w-3 h-3" />
                KST {kstTime}
              </Badge>
              <Badge variant="outline" className="text-[10px] px-2 py-0.5 border-yellow-500/30 text-yellow-400 bg-yellow-500/10">
                ⏳ 재개까지 {countdown}
              </Badge>
              <span className="text-[10px] text-yellow-400/70">
                스캔 엔진 가동 중 · 0순위 종목 사전 선별
              </span>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-3 text-[10px] text-yellow-400/80">
            <span>🔍 Finnhub × Twelve Data 교차 필터링 중</span>
            <span>📊 ₩12,000↓ 저가주 사전 스캔</span>
            <span>🎯 익절확률 95%↑ 종목 선별 대기</span>
          </div>
        </div>
      )}

      {/* [Day-Break] 공격 모드 전환 배너 */}
      {mode === 'day-break' && (
        <div className="relative overflow-hidden rounded-lg border border-stock-up/40 bg-stock-up/10 p-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Play className="w-4 h-4 text-stock-up animate-pulse" />
              <span className="text-sm font-bold text-stock-up">
                [Day-Break] 🟢 데이장 사냥 강제 재개! 공격 모드 전환
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] px-2 py-0.5 border-stock-up/40 text-stock-up bg-stock-up/10 gap-1">
                <Clock className="w-3 h-3" />
                KST {kstTime}
              </Badge>
              <Badge className="bg-stock-up/20 text-stock-up border-stock-up/30 text-[10px] font-bold">
                💰 ₩1,000,000 원금 세팅 완료
              </Badge>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-3 text-[10px] text-stock-up/80">
            <span>🎯 아시아 세션 수급 + 최신 뉴스 결합 종목 최우선 요격</span>
            <span>💎 ₩12,000↓ 저가주 즉시 투입</span>
          </div>
        </div>
      )}

      {/* [Zero-Loss] 100% 익절 방어막 — 항상 표시 */}
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Shield className="w-3.5 h-3.5 text-primary" />
          <span className="text-[11px] font-bold text-primary">[Zero-Loss] 100% 익절 방어막 상시 가동</span>
          <div className="flex items-center gap-1.5 ml-auto flex-wrap">
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-stock-up/30 text-stock-up gap-0.5">
              <Zap className="w-2.5 h-2.5" />
              +1%→SL+0.2%
            </Badge>
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-warning/30 text-warning gap-0.5">
              <Target className="w-2.5 h-2.5" />
              가변 2~3%
            </Badge>
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-primary/30 text-primary gap-0.5">
              🔥 200%↑→트레일링
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );
}
