import { Bot } from "lucide-react";
import { IntegratedKPIDashboard } from "@/components/trading/IntegratedKPIDashboard";
import { SessionIndicator } from "@/components/trading/SessionIndicator";
import { ServerStatusBanner } from "@/components/trading/ServerStatusBanner";
import { AgentLogViewer } from "@/components/trading/AgentLogViewer";
import { Phase1TargetCard } from "@/components/trading/Phase1TargetCard";
import { FillRateCard } from "@/components/dashboard/FillRateCard";
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

      {/* 실전 체결률 KPI */}
      <FillRateCard />

      {/* Agent Log Viewer */}
      <AgentLogViewer />

      {/* Integrated KPI Dashboard */}
      <IntegratedKPIDashboard wsGetPrice={ws.getPrice} wsConnected={ws.isConnected} fxRate={fxRate} />
    </div>
  );
}
