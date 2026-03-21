import { Bot } from "lucide-react";
import { IntegratedKPIDashboard } from "@/components/trading/IntegratedKPIDashboard";
import { SessionIndicator } from "@/components/trading/SessionIndicator";
import { ServerStatusBanner } from "@/components/trading/ServerStatusBanner";
import { AgentLogViewer } from "@/components/trading/AgentLogViewer";
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

      {/* Strategy Card */}
      <Card className="border-yellow-500/30 bg-yellow-500/5">
        <CardContent className="p-3 text-xs text-muted-foreground space-y-1.5">
          <p className="font-bold text-yellow-400 text-sm">💰 수익 무한 확장 — 일당 50만 원 탈취 집행서</p>
          <p className="italic text-yellow-400/80">"1% 수익에 만족하는 자는 절대 월가의 승리자가 될 수 없다. 본절가 보호는 유지하되, 상단은 열어두어 주가가 하늘을 뚫을 때까지 추격하라."</p>
          <div className="border-l-2 border-blue-500/40 pl-2 space-y-0.5">
            <p className="font-semibold text-foreground">[Trailing Stop] 수익 추격형 자동 매도</p>
            <p>🚫 +3.0% 전까지 절대 매도 금지 (기존 0.8%→3.0% 대폭 상향)</p>
            <p>🚀 +3.0% 돌파 → SL 매수가+1.5% 잠금 → '수익 추격 모드' 발동</p>
            <p>📈 고점 대비 -2.0% 하락 시에만 전량 매도 (10%, 20%... 끝없이 추격)</p>
          </div>
          <div className="border-l-2 border-stock-up/40 pl-2 space-y-0.5">
            <p className="font-semibold text-foreground">[Volatility Hunt] 저가주 변동성 활용</p>
            <p>🎯 ₩12,000 미만 종목: 일일 목표 수익 30% (한 종목에서 뽑아내기)</p>
            <p>💰 1순위 종목에 50%+ 비중 집중 → 수익금 단숨에 불리기</p>
          </div>
          <div className="border-l-2 border-primary/40 pl-2 space-y-0.5">
            <p className="font-semibold text-foreground">[100% 익절 보장] 패배 없는 공격</p>
            <p>🔒 +1.0% 도달 → 어떤 경우에도 본절가(+0.1%) 아래 금지</p>
            <p>📰 WS 실시간 가격 + Finnhub 뉴스 일치 = '필승 확정 구간' 최대 비중</p>
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
