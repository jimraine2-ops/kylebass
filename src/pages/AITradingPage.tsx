import { Bot } from "lucide-react";
import { IntegratedKPIDashboard } from "@/components/trading/IntegratedKPIDashboard";
import { SessionIndicator } from "@/components/trading/SessionIndicator";
import { ServerStatusBanner } from "@/components/trading/ServerStatusBanner";
import { AgentLogViewer } from "@/components/trading/AgentLogViewer";
import { Phase1TargetCard } from "@/components/trading/Phase1TargetCard";
import { LiveSyncIndicator } from "@/components/trading/LiveSyncIndicator";
import { useWebSocketPrices } from "@/hooks/useWebSocketPrice";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { useUnifiedPortfolio } from "@/hooks/useStockData";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export default function AITradingPage() {
  const { data } = useUnifiedPortfolio();
  const { rate: fxRate, isLive: fxLive } = useExchangeRate();

  // Collect all symbols from open positions for WebSocket subscription
  const allSymbols = useMemo(() => {
    const symbols = new Set<string>();
    (data?.openPositions || []).forEach((p: any) => symbols.add(p.symbol));
    return Array.from(symbols);
  }, [data?.openPositions]);

  const ws = useWebSocketPrices(allSymbols);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Bot className="w-5 h-5 text-primary" />
          통합 KPI 대시보드
        </h2>
        <div className="flex items-center gap-2 flex-wrap">
          <LiveSyncIndicator
            isConnected={ws.isConnected}
            latencyMs={ws.latencyMs}
            lastUpdateAt={ws.lastUpdateAt}
          />
          <Badge variant="outline" className={`text-[10px] px-2 py-0.5 gap-1 ${fxLive ? 'border-stock-up/30 text-stock-up' : 'border-warning/30 text-warning'}`}>
            💱 {fxLive ? '실시간' : '고정'} ₩{fxRate.toLocaleString('ko-KR')}/USD
          </Badge>
          <SessionIndicator />
        </div>
      </div>

      {/* Server Status Banner */}
      <ServerStatusBanner />

      {/* Phase 1 Target Universe — 그물망 알박기 Top 5 */}
      <Phase1TargetCard />

      {/* Strategy Card */}
      <Card className="border-yellow-500/30 bg-yellow-500/5">
        <CardContent className="p-3 text-xs text-muted-foreground space-y-1.5">
          <p className="font-bold text-yellow-400 text-sm">🎯 종목별 맞춤 익절 — Dynamic-Target & Adaptive-Exit</p>
          <p className="italic text-yellow-400/80">"시장은 생물이다. 3%가 목표지만, 힘이 2.5%에서 꺾인다면 그곳이 우리의 종착역이다. 단 0.1%의 수익도 시장에 반납하지 마라."</p>
          <div className="border-l-2 border-yellow-500/40 pl-2 space-y-0.5">
            <p className="font-semibold text-foreground">[Dynamic-Target] 체결강도 기반 가변 익절</p>
            <p>🔥 체결강도 150%↑ → "3.0% 익절 추천" (강력 홀딩)</p>
            <p>📊 체결강도 100~150% → "2.5% 익절 추천" (분할 대응)</p>
            <p>⚡ 체결강도 100%↓ → "2.0% 익절 추천" (빠른 회전)</p>
          </div>
          <div className="border-l-2 border-stock-up/40 pl-2 space-y-0.5">
            <p className="font-semibold text-foreground">[Adaptive-Exit] 힘의 균열 감지 즉시 익절</p>
            <p>📉 고점 대비 -0.5% 하락 OR 체결강도 80% 미만 급락 → 즉시 전량 익절</p>
            <p>🔒 100% 익절 사수: 본절가(+0.2%) 라인 절대 사수</p>
          </div>
          <div className="border-l-2 border-primary/40 pl-2 space-y-0.5">
            <p className="font-semibold text-foreground">[₩12,000↓ 저가주] 호가 최적화</p>
            <p>💎 호가창 얇아질 조짐 → AI 추천 2%/2.5% 구간에서 선제적 매도</p>
            <p>🛡️ Iron-Defense: +1%→SL+0.2% | +3%→즉시 확정 | 200%↑ 트레일링</p>
          </div>
        </CardContent>
      </Card>

      {/* Agent Log Viewer */}
      <AgentLogViewer />

      {/* Integrated KPI Dashboard */}
      <IntegratedKPIDashboard wsGetPrice={ws.getPrice} wsConnected={ws.isConnected} fxRate={fxRate} />
    </div>
  );
}
