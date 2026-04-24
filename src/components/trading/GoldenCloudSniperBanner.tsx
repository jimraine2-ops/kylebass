import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Filter, Cloud, Activity, ShieldAlert } from "lucide-react";

/**
 * ☁️ Kumo Breakout & Retest Sniper — 일목균형표 정밀 타격 + 최소 유동성 보정
 *
 * "구름대를 뚫는 것은 날개지만, 거래대금은 그 날개를 지탱하는 공기다.
 *  공기가 없는 진공 상태(저거래량)에서의 비행은 추락뿐이다."
 *
 * 4-Phase Protocol (보정본):
 *  ① Dual-Filter   — 20일 평균 거래대금 ≥ ₩10억 + 가격 > EMA200
 *  ② Ichimoku Logic — Kumo 돌파 + 리테스트 + 구름 두께 ≥ 0.5%
 *  ③ Data Engine    — yfinance 1m 기준 즉시 집행 (TD는 참고용)
 *  ④ Risk Protocol  — +3% 익절 / +1.2% 본절 / 구름 하향 1분 유지 시 강제 손절
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
                Kumo Breakout & Retest Sniper — 일목균형표 + 최소 유동성 보정 프로토콜
              </h3>
              <p className="text-[10px] italic text-yellow-400/70">
                "거래대금은 구름대 돌파의 날개를 지탱하는 공기 — 진공 상태의 비행은 추락뿐."
              </p>
            </div>
          </div>
          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/40 text-[10px] font-bold">
            ACTIVE · Dual-Filter v2 (₩10억 보정)
          </Badge>
        </div>

        {/* 4-Phase Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
          {/* Phase 1 — Dual-Filter (₩10억 + EMA200) */}
          <div className="bg-background/50 rounded-lg p-2.5 border border-cyan-500/30 space-y-1">
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-[11px] font-bold text-cyan-400">① Dual-Filter</span>
            </div>
            <p className="text-[10px] text-muted-foreground leading-tight">
              종목 풀 확장 + 잡주 차단 — 가짜 익절·체결 실패 원천 봉쇄
            </p>
            <div className="space-y-0.5 text-[9px] font-mono text-foreground/80">
              <div>💰 20일 평균 거래대금 ≥ ₩10억</div>
              <div>🚫 ₩10억 미만 잡주 완전 배제</div>
              <div>📈 가격 &gt; EMA200 (대세 상승)</div>
              <div>⛔ 하락장 단기 반등 진입 금지</div>
            </div>
          </div>

          {/* Phase 2 — Ichimoku Logic (Breakout + Retest + Cloud Thickness) */}
          <div className="bg-background/50 rounded-lg p-2.5 border border-yellow-500/30 space-y-1">
            <div className="flex items-center gap-1.5">
              <Cloud className="w-3.5 h-3.5 text-yellow-400" />
              <span className="text-[11px] font-bold text-yellow-400">② Ichimoku Logic</span>
            </div>
            <p className="text-[10px] text-muted-foreground leading-tight">
              Kumo 돌파 → 리테스트 지지 → 두꺼운 구름만 정밀 타격
            </p>
            <div className="space-y-0.5 text-[9px] font-mono text-foreground/80">
              <div>☁️ Kumo 상단 확실히 상향 돌파</div>
              <div>🎯 Span A/B 부근 지지 리테스트</div>
              <div>📏 구름 두께 ≥ 주가의 0.5%</div>
              <div>🚫 얇은 구름 (지지력 약함) 무시</div>
            </div>
          </div>

          {/* Phase 3 — Data Engine (yfinance 1m 기준) */}
          <div className="bg-background/50 rounded-lg p-2.5 border border-blue-500/30 space-y-1">
            <div className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-[11px] font-bold text-blue-400">③ Data Engine</span>
            </div>
            <p className="text-[10px] text-muted-foreground leading-tight">
              yfinance 1분봉 = 단일 진실 소스 — TD는 참고용
            </p>
            <div className="space-y-0.5 text-[9px] font-mono text-foreground/80">
              <div>⏱️ 타겟 1분(1m) 실시간 호출</div>
              <div>🎯 매수/매도 = yfinance 시세 즉시 집행</div>
              <div>📊 Twelve Data = 보조 지표 참고용</div>
              <div>🔒 데이터 무결성 단일 채널 유지</div>
            </div>
          </div>

          {/* Phase 4 — Risk Protocol (3% TP / +1.2% BE / Cloud-Below 1min Stop) */}
          <div className="bg-background/50 rounded-lg p-2.5 border border-stock-down/30 space-y-1">
            <div className="flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-stock-down" />
              <span className="text-[11px] font-bold text-stock-down">④ Risk Protocol</span>
            </div>
            <p className="text-[10px] text-muted-foreground leading-tight">
              기계적 익절 + 본절 가드 + 구름 이탈 1분 강제 손절
            </p>
            <div className="space-y-0.5 text-[9px] font-mono text-foreground/80">
              <div>🎯 +3.0% 도달 → 즉시 전량 매도</div>
              <div>🛡️ +1.2% 통과 → SL 매수가+0.2%</div>
              <div>⛔ 구름 하향 1분 유지 → 강제 손절</div>
              <div>♾️ 청산 후 ₩100만 무한 리셋</div>
            </div>
          </div>
        </div>

        {/* Bottom tag bar */}
        <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-yellow-500/20">
          <span className="text-[9px] text-muted-foreground">상시 가동:</span>
          <Badge variant="outline" className="text-[9px] border-cyan-500/40 text-cyan-400">💰 ₩10억 Liquidity Guard</Badge>
          <Badge variant="outline" className="text-[9px] border-yellow-500/40 text-yellow-400">📏 Cloud Thickness ≥ 0.5%</Badge>
          <Badge variant="outline" className="text-[9px] border-blue-500/40 text-blue-400">⏱️ yfinance 1m 단일 소스</Badge>
          <Badge variant="outline" className="text-[9px] border-stock-down/40 text-stock-down">⛔ 구름 이탈 1분 Stop</Badge>
          <Badge variant="outline" className="text-[9px] border-primary/40 text-primary">♾️ Infinite-Reset ₩1M</Badge>
        </div>
      </CardContent>
    </Card>
  );
}
