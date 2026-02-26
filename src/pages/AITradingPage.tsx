import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bot, Zap } from "lucide-react";
import { MainTradingDashboard } from "@/components/trading/MainTradingDashboard";
import { ScalpingDashboard } from "@/components/trading/ScalpingDashboard";
import { StrategyComparison } from "@/components/trading/StrategyComparison";
import { SessionIndicator } from "@/components/trading/SessionIndicator";
import { ServerStatusBanner } from "@/components/trading/ServerStatusBanner";
import { AgentLogViewer } from "@/components/trading/AgentLogViewer";
import { LiveSyncIndicator } from "@/components/trading/LiveSyncIndicator";
import { useWebSocketPrices } from "@/hooks/useWebSocketPrice";
import { useAIPortfolio, useScalpingPortfolio } from "@/hooks/useStockData";
import { useMemo } from "react";

export default function AITradingPage() {
  const { data: mainData } = useAIPortfolio();
  const { data: scalpData } = useScalpingPortfolio();

  // Collect all symbols from open positions for WebSocket subscription
  const allSymbols = useMemo(() => {
    const symbols = new Set<string>();
    (mainData?.openPositions || []).forEach((p: any) => symbols.add(p.symbol));
    (scalpData?.openPositions || []).forEach((p: any) => symbols.add(p.symbol));
    return Array.from(symbols);
  }, [mainData?.openPositions, scalpData?.openPositions]);

  const ws = useWebSocketPrices(allSymbols);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Bot className="w-5 h-5 text-primary" />
          AI 자율 매매 대시보드
        </h2>
        <div className="flex items-center gap-3 flex-wrap">
          <LiveSyncIndicator
            isConnected={ws.isConnected}
            latencyMs={ws.latencyMs}
            lastUpdateAt={ws.lastUpdateAt}
          />
          <SessionIndicator />
        </div>
      </div>

      {/* Server Status Banner */}
      <ServerStatusBanner />

      {/* Strategy Comparison */}
      <StrategyComparison />

      {/* Agent Log Viewer */}
      <AgentLogViewer />

      <Tabs defaultValue="main">
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="main" className="flex items-center gap-1.5">
            <Bot className="w-4 h-4" />
            대형주 KPI
          </TabsTrigger>
          <TabsTrigger value="scalping" className="flex items-center gap-1.5">
            <Zap className="w-4 h-4" />
            소형주 KPI
          </TabsTrigger>
        </TabsList>
        <TabsContent value="main">
          <MainTradingDashboard wsGetPrice={ws.getPrice} wsConnected={ws.isConnected} />
        </TabsContent>
        <TabsContent value="scalping">
          <ScalpingDashboard wsGetPrice={ws.getPrice} wsConnected={ws.isConnected} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
