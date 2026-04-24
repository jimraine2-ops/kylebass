import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Filter, Cloud, Activity, ShieldAlert } from "lucide-react";

/**
 * ☁️ Kumo Breakout & Retest Sniper — 실시간 구름대 + 유동성 보정 (Top 10 / 60s 순회)
 *
 * "15분 뒤의 잔상을 쫓지 마라. yfinance의 실시간 가격으로 구름대의 입구를 지키고,
 *  10억의 수급이 확인된 문으로만 입장하라."
 *
 * 4-Phase Protocol (보정본 v3):
 *  ① Pre-Scan      — 20일 거래대금 ≥ ₩10억 + 가격 > EMA200 → Top 10 추출
 *  ② Data Engine   — yfinance 1m, 10종목 60초 순회 (IP 차단 방지)
 *  ③ Entry Logic   — Kumo 돌파 → 상단 ±0.1% 리테스트 LIMIT + 두께 ≥ 0.5%
 *  ④ Risk Protocol — +3% 익절 / +1.5% 본절 / 구름 이탈 2분(2봉) 강제 손절
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
                Kumo Breakout & Retest Sniper — yfinance 1m + Top 10 순회 프로토콜
              </h3>
              <p className="text-[10px] italic text-yellow-400/70">
                "15분 뒤의 잔상을 쫓지 마라 — 10억 수급이 확인된 구름대 입구만 지켜라."
              </p>
            </div>
          </div>
          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/40 text-[10px] font-bold">
            ACTIVE · Top 10 / 60s Rotation
          </Badge>
        </div>

        {/* 4-Phase Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
          {/* Phase 1 — Pre-Scan (Top 10) */}
          <div className="bg-background/50 rounded-lg p-2.5 border border-cyan-500/30 space-y-1">
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-[11px] font-bold text-cyan-400">① Pre-Scan</span>
            </div>
            <p className="text-[10px] text-muted-foreground leading-tight">
              장 시작 전 과거 데이터로 Top 10 사냥감 확정
            </p>
            <div className="space-y-0.5 text-[9px] font-mono text-foreground/80">
              <div>💰 20일 평균 거래대금 ≥ ₩10억 ($750K)</div>
              <div>📈 가격 &gt; EMA200 (대세 상승)</div>
              <div>🎯 조건 충족 Top 10 추출</div>
              <div>🚫 잡주·하락장 종목 완전 배제</div>
            </div>
          </div>

          {/* Phase 2 — Data Engine (yfinance 1m, 60s rotation) */}
          <div className="bg-background/50 rounded-lg p-2.5 border border-blue-500/30 space-y-1">
            <div className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-[11px] font-bold text-blue-400">② Data Engine</span>
            </div>
            <p className="text-[10px] text-muted-foreground leading-tight">
              yfinance 1m — 10종목 60초 순회 (IP 차단 방지)
            </p>
            <div className="space-y-0.5 text-[9px] font-mono text-foreground/80">
              <div>⏱️ Interval = 1m 실시간</div>
              <div>🔁 10종목 × 60초 라운드 로빈</div>
              <div>🛡️ Rate-Limit 안전 호출 분산</div>
              <div>📊 TD = 보조 지표 참고용</div>
            </div>
          </div>

          {/* Phase 3 — Entry Logic (Breakout + Retest ±0.1% + Thickness 0.5%) */}
          <div className="bg-background/50 rounded-lg p-2.5 border border-yellow-500/30 space-y-1">
            <div className="flex items-center gap-1.5">
              <Cloud className="w-3.5 h-3.5 text-yellow-400" />
              <span className="text-[11px] font-bold text-yellow-400">③ Entry Logic</span>
            </div>
            <p className="text-[10px] text-muted-foreground leading-tight">
              Kumo 돌파 → 상단 ±0.1% 리테스트 LIMIT 정밀 알박기
            </p>
            <div className="space-y-0.5 text-[9px] font-mono text-foreground/80">
              <div>☁️ Span A/B 중 高 = 구름 상단 돌파</div>
              <div>🪤 LIMIT @ Kumo 상단 ±0.1%</div>
              <div>📏 구름 두께 ≥ 현재가 × 0.5%</div>
              <div>🚫 얇은 구름 (지지력 부족) 무시</div>
            </div>
          </div>

          {/* Phase 4 — Risk Protocol (3% TP / +1.5% BE / 2-bar Cloud-Below Stop) */}
          <div className="bg-background/50 rounded-lg p-2.5 border border-stock-down/30 space-y-1">
            <div className="flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-stock-down" />
              <span className="text-[11px] font-bold text-stock-down">④ Risk Protocol</span>
            </div>
            <p className="text-[10px] text-muted-foreground leading-tight">
              기계적 익절 + 본절 사수 + 구름 이탈 2봉 강제 손절
            </p>
            <div className="space-y-0.5 text-[9px] font-mono text-foreground/80">
              <div>🎯 +3.0% 도달 → 즉시 자동 매도</div>
              <div>🛡️ +1.5% 통과 → SL 매수가+0.2%</div>
              <div>⛔ 구름 하향 2분(2봉) 미회복 → 손절</div>
              <div>♾️ 청산 후 ₩100만 무한 리셋</div>
            </div>
          </div>
        </div>

        {/* Bottom tag bar */}
        <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-yellow-500/20">
          <span className="text-[9px] text-muted-foreground">상시 가동:</span>
          <Badge variant="outline" className="text-[9px] border-cyan-500/40 text-cyan-400">🎯 Top 10 Pre-Scan</Badge>
          <Badge variant="outline" className="text-[9px] border-blue-500/40 text-blue-400">🔁 yfinance 1m / 60s 순회</Badge>
          <Badge variant="outline" className="text-[9px] border-yellow-500/40 text-yellow-400">🪤 Retest ±0.1% LIMIT</Badge>
          <Badge variant="outline" className="text-[9px] border-stock-down/40 text-stock-down">⛔ 2봉 이탈 Stop</Badge>
          <Badge variant="outline" className="text-[9px] border-primary/40 text-primary">♾️ Infinite-Reset ₩1M</Badge>
        </div>
      </CardContent>
    </Card>
  );
}
