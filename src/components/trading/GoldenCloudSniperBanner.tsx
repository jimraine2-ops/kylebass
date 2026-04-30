import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Compass, Crosshair, Filter, ShieldAlert } from "lucide-react";

/**
 * 🎯 The Golden Rule — 기계적 매수 진입 지시서 (사용자 최종 설계)
 *
 * "뉴스는 속여도 이평선과 구름은 속이지 못한다.
 *  200일선의 자석 힘을 이용해 가장 안전한 궤도에서만 사격하라."
 *
 *  ① 형님들의 허락  — 5/3분봉 방향성 (EMA20·EMA200·구름 위 + 이격 ≤5%)
 *  ② 막내의 타이밍  — 1분봉 리테스트(Case A) / 응축 돌파(Case B)
 *  ③ 최종 필터링    — 체결강도 ≥120% + 거래량 폭발 (RVOL ≥2.0)
 */
export function GoldenCloudSniperBanner() {
  return (
    <Card className="border-yellow-500/40 bg-gradient-to-br from-yellow-500/10 via-cyan-500/5 to-yellow-500/10 shadow-[0_0_24px_rgba(234,179,8,0.15)]">
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎯</span>
            <div>
              <h3 className="font-bold text-yellow-400 text-sm tracking-wide">
                The Golden Rule — 기계적 매수 진입 지시서
              </h3>
              <p className="text-[10px] italic text-yellow-400/70">
                "뉴스는 속여도 이평선과 구름은 속이지 못한다 — 200일선 자석 궤도에서만 사격하라."
              </p>
            </div>
          </div>
          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/40 text-[10px] font-bold">
            ACTIVE · Triple-API Mechanical Gate
          </Badge>
        </div>

        {/* 3-Stage Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {/* ① 형님들의 허락 — 방향성 */}
          <div className="bg-background/50 rounded-lg p-2.5 border border-cyan-500/30 space-y-1">
            <div className="flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-[11px] font-bold text-cyan-400">① 형님들의 허락 <span className="text-[8px] text-cyan-400/60">[Twelve Data 5m]</span></span>
            </div>
            <p className="text-[10px] text-muted-foreground leading-tight">
              5분봉 200 EMA 자석 궤도 + 양운(Kumo) 지지 검증
            </p>
            <div className="space-y-0.5 text-[9px] font-mono text-foreground/80">
              <div>📊 EMA200 위 안착 (5분봉)</div>
              <div>☁️ Kumo 양운(spanA &gt; spanB) 위</div>
              <div>🧲 EMA200 이격 ≤ 3% (자석 궤도)</div>
              <div>🚫 이격 &gt; 3% / 음운 → 즉시 차단</div>
            </div>
          </div>

          {/* ② 막내의 타이밍 — 1분봉 진입 */}
          <div className="bg-background/50 rounded-lg p-2.5 border border-yellow-500/30 space-y-1">
            <div className="flex items-center gap-1.5">
              <Crosshair className="w-3.5 h-3.5 text-yellow-400" />
              <span className="text-[11px] font-bold text-yellow-400">② 막내의 타이밍 <span className="text-[8px] text-yellow-400/60">[Polygon 1m]</span></span>
            </div>
            <p className="text-[10px] text-muted-foreground leading-tight">
              1분봉 200 EMA 리테스트 / 응축 돌파 패턴 감시
            </p>
            <div className="space-y-0.5 text-[9px] font-mono text-foreground/80">
              <div>🅰️ Case A — EMA200 ±0.3% 터치 후 양봉</div>
              <div>🅱️ Case B — 음봉 3개 응축 후 돌파 양봉</div>
              <div>✅ 현재가 &gt; EMA200(1m) 강제</div>
              <div>🪤 LIMIT @ Kumo 상단 ±0.1% 알박기</div>
            </div>
          </div>

          {/* ③ 최종 필터링 — 돈의 흐름 */}
          <div className="bg-background/50 rounded-lg p-2.5 border border-primary/30 space-y-1">
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-primary" />
              <span className="text-[11px] font-bold text-primary">③ 돈의 흐름 + UT Bot <span className="text-[8px] text-primary/60">[Finnhub RT]</span></span>
            </div>
            <p className="text-[10px] text-muted-foreground leading-tight">
              실시간 가격 + UT Bot 매칭 + 0.1초 단위 익/손절 감시
            </p>
            <div className="space-y-0.5 text-[9px] font-mono text-foreground/80">
              <div>💪 체결강도 ≥ 120%</div>
              <div>📈 RVOL ≥ 2.0 (거래량 폭발)</div>
              <div>🎯 +3% 익절 / -1.5% 손절 (0.1s 감시)</div>
              <div>🚫 뉴스 전략 완전 배제</div>
            </div>
          </div>
        </div>

        {/* Risk tag bar */}
        <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-yellow-500/20">
          <span className="text-[9px] text-muted-foreground">리스크 프로토콜:</span>
          <Badge variant="outline" className="text-[9px] border-stock-up/40 text-stock-up">🎯 +1.5~3% 익절</Badge>
          <Badge variant="outline" className="text-[9px] border-yellow-500/40 text-yellow-400">🛡️ +1.5% → SL 매수가+0.2%</Badge>
          <Badge variant="outline" className="text-[9px] border-stock-down/40 text-stock-down">⛔ 구름 이탈 2봉 강제 손절</Badge>
          <Badge variant="outline" className="text-[9px] border-primary/40 text-primary">♾️ Infinite-Reset ₩1M</Badge>
        </div>
      </CardContent>
    </Card>
  );
}
