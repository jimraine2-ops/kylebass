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
            ACTIVE · 3-Stage Mechanical Gate
          </Badge>
        </div>

        {/* 3-Stage Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {/* ① 형님들의 허락 — 방향성 */}
          <div className="bg-background/50 rounded-lg p-2.5 border border-cyan-500/30 space-y-1">
            <div className="flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-[11px] font-bold text-cyan-400">① 형님들의 허락 (5분·3분봉)</span>
            </div>
            <p className="text-[10px] text-muted-foreground leading-tight">
              상위 분봉 추세가 '안전한 우상향'인지 검증
            </p>
            <div className="space-y-0.5 text-[9px] font-mono text-foreground/80">
              <div>📊 EMA20 / EMA200(주황) 위 안착</div>
              <div>☁️ 캔들 하단 두꺼운 양운(빨강)</div>
              <div>🧲 EMA200 이격 2~3% 이내 (자석)</div>
              <div>🚫 이격 ≥ 5% → 자격 미달 차단</div>
            </div>
          </div>

          {/* ② 막내의 타이밍 — 1분봉 진입 */}
          <div className="bg-background/50 rounded-lg p-2.5 border border-yellow-500/30 space-y-1">
            <div className="flex items-center gap-1.5">
              <Crosshair className="w-3.5 h-3.5 text-yellow-400" />
              <span className="text-[11px] font-bold text-yellow-400">② 막내의 타이밍 (1분봉)</span>
            </div>
            <p className="text-[10px] text-muted-foreground leading-tight">
              실제 매수 방아쇠를 당기는 정밀 타격 구간
            </p>
            <div className="space-y-0.5 text-[9px] font-mono text-foreground/80">
              <div>✅ 모든 이평선·구름대 위로 안착</div>
              <div>🅰️ Case A — 200 EMA 리테스트 후 첫 양봉</div>
              <div>🅱️ Case B — 단봉 음봉 3개 응축 후 강한 양봉</div>
              <div>🪤 LIMIT @ Kumo 상단 ±0.1% 알박기</div>
            </div>
          </div>

          {/* ③ 최종 필터링 — 돈의 흐름 */}
          <div className="bg-background/50 rounded-lg p-2.5 border border-primary/30 space-y-1">
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-primary" />
              <span className="text-[11px] font-bold text-primary">③ 최종 필터링 (돈의 흐름)</span>
            </div>
            <p className="text-[10px] text-muted-foreground leading-tight">
              기술 지표가 완성돼도 '돈의 흐름' 없으면 진입 금지
            </p>
            <div className="space-y-0.5 text-[9px] font-mono text-foreground/80">
              <div>💪 체결강도 ≥ 120% & 우상향 중</div>
              <div>💥 거래량 폭발 (직전 3~5봉 압도)</div>
              <div>📈 RVOL ≥ 2.0 강제</div>
              <div>🚫 미달 시 즉시 탈락 (대기 모드)</div>
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
