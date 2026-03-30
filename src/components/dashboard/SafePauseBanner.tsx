import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Shield, Clock } from "lucide-react";

export function SafePauseBanner() {
  const [kstTime, setKstTime] = useState("");
  const [isBeforeKST9, setIsBeforeKST9] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      // KST = UTC + 9
      const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
      const h = kst.getUTCHours();
      const m = kst.getUTCMinutes();
      const s = kst.getUTCSeconds();
      setKstTime(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`);
      setIsBeforeKST9(h * 60 + m < 540);
      setVisible((prev) => !prev); // blink
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!isBeforeKST9) return null;

  return (
    <div className="relative overflow-hidden rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-yellow-400" />
          <span
            className={`text-sm font-bold transition-opacity duration-500 ${
              visible ? "opacity-100" : "opacity-40"
            }`}
            style={{ color: "hsl(45, 100%, 60%)" }}
          >
            시장 전환 대기 중 — 오전 9시 재개 예정
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="text-[10px] px-2 py-0.5 border-yellow-500/30 text-yellow-400 bg-yellow-500/10 gap-1"
          >
            <Clock className="w-3 h-3" />
            KST {kstTime}
          </Badge>
          <span className="text-[10px] text-yellow-400/70">
            Safe-Pause 모드 · 신규 매수 금지
          </span>
        </div>
      </div>
    </div>
  );
}
