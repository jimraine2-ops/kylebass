import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Filter, Crosshair, ShieldCheck, Repeat } from "lucide-react";

/**
 * 🎯 Golden Cloud Sniper — 4단계 전략 배너
 * 무료 API의 15분 지연을 역이용하는 타임머신 전략을 시각화.
 * - Static-Filter: 장 시작 전 4-AND 사냥감 선별
 * - Tactical-Entry: Kumo 상단 LIMIT 마중가 알박기
 * - Validation: 체결강도 85%↑ + 25봉 추세로 가짜 돌파 차단
 * - Infinite-Loop: 본절보호 + 3% 익절 후 ₩100만 무한 리셋
 */
export function GoldenCloudSniperBanner() {
  return (
    <Card className="border-yellow-500/40 bg-gradient-to-br from-yellow-500/10 via-cyan-500/5 to-yellow-500/10 shadow-[0_0_24px_rgba(234,179,8,0.15)]">
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-2xl">☁️🎯</span>
            <div>
              <h3 className="font-bold text-yellow-400 text-sm tracking-wide">
                Golden Cloud Sniper — 무료 API 타임머신 전략
              </h3>
              <p className="text-[10px] italic text-yellow-400/70">
                "우리는 15분 전의 뉴스를 보지만, 매수 주문은 15분 후의 지지선에 박아넣는다."
              </p>
            </div>
          </div>
          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/40 text-[10px] font-bold">
            ACTIVE · 사이클 자율 회전
          </Badge>
        </div>

        {/* 4-Phase Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
          {/* Phase 1 — Static-Filter */}
          <div className="bg-background/50 rounded-lg p-2.5 border border-cyan-500/30 space-y-1">
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-[11px] font-bold text-cyan-400">① Static-Filter</span>
            </div>
            <p className="text-[10px] text-muted-foreground leading-tight">
              장 시작 전 4-AND 게이트로 5종목 확정 (API 호출 절약)
            </p>
            <div className="space-y-0.5 text-[9px] font-mono text-foreground/80">
              <div>📊 20일 거래대금 ≥ 30억원</div>
              <div>📈 가격 &gt; EMA200 (우상향)</div>
              <div>☁️ Kumo 상단 돌파/근접</div>
              <div>📰 24h 뉴스 Sentiment ≥ 0.5</div>
            </div>
          </div>

          {/* Phase 2 — Tactical-Entry */}
          <div className="bg-background/50 rounded-lg p-2.5 border border-yellow-500/30 space-y-1">
            <div className="flex items-center gap-1.5">
              <Crosshair className="w-3.5 h-3.5 text-yellow-400" />
              <span className="text-[11px] font-bold text-yellow-400">② Tactical-Entry</span>
            </div>
            <p className="text-[10px] text-muted-foreground leading-tight">
              15분 지연 보정 — Kumo 상단 LIMIT 마중가 알박기
            </p>
            <div className="space-y-0.5 text-[9px] font-mono text-foreground/80">
              <div>🪤 LIMIT @ Kumo 상단</div>
              <div>⏱️ 리테스트 하락 대기</div>
              <div>🎯 지지선 정타 체결</div>
              <div>♻️ 미체결 시 다음 사이클</div>
            </div>
          </div>

          {/* Phase 3 — Validation */}
          <div className="bg-background/50 rounded-lg p-2.5 border border-stock-up/30 space-y-1">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-stock-up" />
              <span className="text-[11px] font-bold text-stock-up">③ Validation</span>
            </div>
            <p className="text-[10px] text-muted-foreground leading-tight">
              가짜 돌파 차단 — 실거래 수급 교차 검증
            </p>
            <div className="space-y-0.5 text-[9px] font-mono text-foreground/80">
              <div>💰 1분 거래대금 ≥ 3억원</div>
              <div>🔥 체결강도 ≥ 85%</div>
              <div>📉 25봉 추세 + 음봉 확인</div>
              <div>🚫 미달 시 [Validation 미달] 보류</div>
            </div>
          </div>

          {/* Phase 4 — Infinite-Loop */}
          <div className="bg-background/50 rounded-lg p-2.5 border border-primary/30 space-y-1">
            <div className="flex items-center gap-1.5">
              <Repeat className="w-3.5 h-3.5 text-primary" />
              <span className="text-[11px] font-bold text-primary">④ Infinite-Loop</span>
            </div>
            <p className="text-[10px] text-muted-foreground leading-tight">
              3% 기계적 익절 + ₩100만 무한 리셋
            </p>
            <div className="space-y-0.5 text-[9px] font-mono text-foreground/80">
              <div>🛡️ 체결 즉시 본절보호 +0.2%</div>
              <div>🎯 기본 익절 3.0%</div>
              <div>🚀 수급 폭발 시 최대 5.0%</div>
              <div>♾️ 익절→₩100만 회수→재공략</div>
            </div>
          </div>
        </div>

        {/* Bottom tag bar */}
        <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-yellow-500/20">
          <span className="text-[9px] text-muted-foreground">상시 가동:</span>
          <Badge variant="outline" className="text-[9px] border-cyan-500/40 text-cyan-400">☁️ Kumo-Retest LIMIT</Badge>
          <Badge variant="outline" className="text-[9px] border-stock-up/40 text-stock-up">🛡️ Iron-Defense</Badge>
          <Badge variant="outline" className="text-[9px] border-yellow-500/40 text-yellow-400">🎯 Dynamic-Target 2~5%</Badge>
          <Badge variant="outline" className="text-[9px] border-primary/40 text-primary">♾️ Infinite-Reset ₩1M</Badge>
        </div>
      </CardContent>
    </Card>
  );
}
