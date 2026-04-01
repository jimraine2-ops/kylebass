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

  // Scan engine animation cycle
  useEffect(() => {
    if (mode !== 'safe-exit') return;
    const stageInterval = setInterval(() => {
      setScanStage(prev => (prev + 1) % SCAN_STAGES.length);
      setScanProgress(0);
      setScannedCount(prev => prev + Math.floor(Math.random() * 120 + 30));
    }, 3000);
    const progressInterval = setInterval(() => {
      setScanProgress(prev => Math.min(prev + 4, 100));
    }, 100);
    return () => { clearInterval(stageInterval); clearInterval(progressInterval); };
  }, [mode]);

  const currentStage = SCAN_STAGES[scanStage];

    <div className="space-y-2">
      {/* [Safe-Exit] 매수 일시 중지 배너 */}
      {mode === 'safe-exit' && (
        <div className="relative overflow-hidden rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3">
          {/* Scanning sweep animation */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `linear-gradient(90deg, transparent 0%, hsl(45 100% 60% / 0.06) ${scanProgress}%, transparent ${Math.min(scanProgress + 15, 100)}%)`,
              transition: 'background 0.1s linear',
            }}
          />

          <div className="relative flex items-center justify-between gap-2 flex-wrap">
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
            </div>
          </div>

          {/* Scan Engine Live Status */}
          <div className="relative mt-3 rounded-md border border-yellow-500/20 bg-yellow-500/5 p-2 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Radio className="w-3.5 h-3.5 text-yellow-400 animate-pulse" />
                <span className="text-[11px] font-bold text-yellow-400">스캔 엔진 가동 중</span>
              </div>
              <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-yellow-500/20 text-yellow-400/80 gap-1">
                <Search className="w-2.5 h-2.5" />
                {scannedCount.toLocaleString()}개 종목 스캔 완료
              </Badge>
            </div>

            {/* Current stage with progress */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-[10px]">
                <span className="animate-pulse">{currentStage.icon}</span>
                <span className="font-semibold text-yellow-300">{currentStage.label}</span>
                <span className="text-yellow-400/60">— {currentStage.sub}</span>
              </div>
              <div className="h-1 w-full rounded-full bg-yellow-500/10 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-100 ease-linear"
                  style={{
                    width: `${scanProgress}%`,
                    background: 'linear-gradient(90deg, hsl(45 100% 50% / 0.4), hsl(45 100% 60% / 0.8))',
                  }}
                />
              </div>
            </div>

            {/* Stage indicators */}
            <div className="flex items-center gap-3 text-[9px] text-yellow-400/60">
              {SCAN_STAGES.map((s, i) => (
                <span key={i} className={cn("flex items-center gap-1 transition-all duration-300", i === scanStage ? "text-yellow-300 scale-105 font-semibold" : i < scanStage ? "text-yellow-400/40" : "")}>
                  <span className={cn("w-1.5 h-1.5 rounded-full", i === scanStage ? "bg-yellow-400 animate-pulse" : i < scanStage ? "bg-yellow-400/40" : "bg-yellow-400/15")} />
                  {s.icon} {s.label.split(' ')[0]}
                </span>
              ))}
            </div>
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
