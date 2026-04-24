import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Cloud, Activity, Target, ShieldAlert } from "lucide-react";

/**
 * ☁️ Kumo Breakout & Retest Sniper — 일목균형표 정밀 타격 프로토콜
 *
 * "뉴스는 선반영되고 거래량은 속임수가 있을 수 있지만, 구름대는 거짓말을 하지 않는다.
 *  구름 위로 올라온 시세가 지지받는 그 찰나의 순간을 포착하라."
 *
 * 4-Phase Protocol:
 *  ① Technical Core   — Kumo 돌파 + 정배열(전환>기준) + 리테스트 지지
 *  ② Data Engine      — yfinance 1m + 52일 선행로드 (지연 시세 배제)
 *  ③ Execution        — Kumo 상단 +0.1~0.3% LIMIT 진입
 *  ④ Risk Protocol    — +3.0% 익절 / +1.2% 본절 / Span B 이탈 손절
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
                Kumo Breakout & Retest Sniper — 일목균형표 정밀 타격 프로토콜
              </h3>
              <p className="text-[10px] italic text-yellow-400/70">
                "구름대는 거짓말을 하지 않는다 — 구름 위 시세가 지지받는 찰나를 포착하라."
              </p>
            </div>
          </div>
          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/40 text-[10px] font-bold">
            ACTIVE · Kumo-Retest 매수 엔진
          </Badge>
        </div>

        {/* 4-Phase Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
          {/* Phase 1 — Technical Core (Ichimoku Algorithm) */}
          <div className="bg-background/50 rounded-lg p-2.5 border border-cyan-500/30 space-y-1">
            <div className="flex items-center gap-1.5">
              <Cloud className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-[11px] font-bold text-cyan-400">① Technical Core</span>
            </div>
            <p className="text-[10px] text-muted-foreground leading-tight">
              일목균형표 진입 알고리즘 — 구름대 상관관계 성립 시에만 가동
            </p>
            <div className="space-y-0.5 text-[9px] font-mono text-foreground/80">
              <div>☁️ Kumo Breakout (Span A·B 상향)</div>
              <div>📈 정배열: 전환(9) &gt; 기준(26)</div>
              <div>🎯 Retest: 구름 상단 지지 터치</div>
              <div>✨ 호전 상태 유지 (가격 &gt; 구름)</div>
            </div>
          </div>

          {/* Phase 2 — Data Engine (yfinance 1m) */}
          <div className="bg-background/50 rounded-lg p-2.5 border border-blue-500/30 space-y-1">
            <div className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-[11px] font-bold text-blue-400">② Data Engine</span>
            </div>
            <p className="text-[10px] text-muted-foreground leading-tight">
              yfinance 1분 실시간 — Twelve Data 지연 시세 완전 배제
            </p>
            <div className="space-y-0.5 text-[9px] font-mono text-foreground/80">
              <div>⏱️ Interval = 1m 호출</div>
              <div>📊 Span 실시간 재계산</div>
              <div>📦 52일 과거 선행 로드</div>
              <div>🔒 데이터 무결성 단일 소스</div>
            </div>
          </div>

          {/* Phase 3 — Execution (Limit Entry +0.1~0.3%) */}
          <div className="bg-background/50 rounded-lg p-2.5 border border-yellow-500/30 space-y-1">
            <div className="flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-yellow-400" />
              <span className="text-[11px] font-bold text-yellow-400">③ Execution</span>
            </div>
            <p className="text-[10px] text-muted-foreground leading-tight">
              구름대 상단 +0.1~0.3% LIMIT 정밀 알박기
            </p>
            <div className="space-y-0.5 text-[9px] font-mono text-foreground/80">
              <div>🪤 LIMIT @ P_Cloud_Top × 1.001~1.003</div>
              <div>⏳ 지지선 터치 시 즉시 체결</div>
              <div>🚫 시장가/추격 매수 금지</div>
              <div>♻️ 미체결 → 다음 1m 사이클</div>
            </div>
          </div>

          {/* Phase 4 — Risk Protocol (TP/Breakeven/SL) */}
          <div className="bg-background/50 rounded-lg p-2.5 border border-stock-down/30 space-y-1">
            <div className="flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-stock-down" />
              <span className="text-[11px] font-bold text-stock-down">④ Risk Protocol</span>
            </div>
            <p className="text-[10px] text-muted-foreground leading-tight">
              기계적 익절 + Span B 이탈 손절 — '잃지 않는 매매'
            </p>
            <div className="space-y-0.5 text-[9px] font-mono text-foreground/80">
              <div>🎯 +3.0% 도달 → 전량 매도</div>
              <div>🛡️ +1.2% 통과 → SL 매수가+0.2%</div>
              <div>⛔ Span B(구름 하단) 이탈 → 손절</div>
              <div>♾️ 청산 후 ₩100만 무한 리셋</div>
            </div>
          </div>
        </div>

        {/* Bottom tag bar */}
        <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-yellow-500/20">
          <span className="text-[9px] text-muted-foreground">상시 가동:</span>
          <Badge variant="outline" className="text-[9px] border-cyan-500/40 text-cyan-400">☁️ Kumo Breakout+Retest</Badge>
          <Badge variant="outline" className="text-[9px] border-blue-500/40 text-blue-400">⏱️ yfinance 1m</Badge>
          <Badge variant="outline" className="text-[9px] border-yellow-500/40 text-yellow-400">🪤 LIMIT +0.1~0.3%</Badge>
          <Badge variant="outline" className="text-[9px] border-stock-down/40 text-stock-down">⛔ Span B Stop</Badge>
          <Badge variant="outline" className="text-[9px] border-primary/40 text-primary">♾️ Infinite-Reset ₩1M</Badge>
        </div>
      </CardContent>
    </Card>
  );
}
