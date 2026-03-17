import { Badge } from "@/components/ui/badge";
import { Radio, Bot, CalendarDays } from "lucide-react";
import { UnifiedPortfolio } from "@/components/dashboard/UnifiedPortfolio";
import { IntegratedKPIDashboard } from "@/components/trading/IntegratedKPIDashboard";
import { ServerStatusBanner } from "@/components/trading/ServerStatusBanner";
import { AgentLogViewer } from "@/components/trading/AgentLogViewer";
import { SessionIndicator } from "@/components/trading/SessionIndicator";
import { LiveSyncIndicator } from "@/components/trading/LiveSyncIndicator";
import { EarningsWatchSection } from "@/components/dashboard/EarningsWatchSection";

import { useWebSocketPrices } from "@/hooks/useWebSocketPrice";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { useAIPortfolio, useScalpingPortfolio, useUnifiedPortfolio } from "@/hooks/useStockData";
import { useMemo } from "react";

export default function Dashboard() {
  const { data: mainData } = useAIPortfolio();
  const { data: scalpData } = useScalpingPortfolio();
  const { data: unifiedData } = useUnifiedPortfolio();
  const { rate: fxRate, isLive: fxLive } = useExchangeRate();

  // Collect all held symbols for WebSocket
  const allSymbols = useMemo(() => {
    const syms = new Set<string>();
    (mainData?.openPositions || []).forEach((p: any) => syms.add(p.symbol));
    (scalpData?.openPositions || []).forEach((p: any) => syms.add(p.symbol));
    (unifiedData?.openPositions || []).forEach((p: any) => syms.add(p.symbol));
    return Array.from(syms);
  }, [mainData?.openPositions, scalpData?.openPositions, unifiedData?.openPositions]);

  const ws = useWebSocketPrices(allSymbols);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold">통합 대시보드</h2>
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
          <Badge variant="outline" className="text-[10px]">
            <Radio className="w-3 h-3 mr-1" />실시간
          </Badge>
        </div>
      </div>

      {/* Server Status */}
      <ServerStatusBanner />

      {/* Section 1: 통합 KPI (자율매매) */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Bot className="w-4.5 h-4.5 text-primary" />
          <h3 className="text-sm font-semibold">AI 자율매매 KPI</h3>
        </div>
        <AgentLogViewer />
        <IntegratedKPIDashboard wsGetPrice={ws.getPrice} wsConnected={ws.isConnected} fxRate={fxRate} />
      </section>

      {/* Section 2: 포트폴리오 현황 */}
      <section className="space-y-3">
        <UnifiedPortfolio wsGetPrice={ws.getPrice} fxRate={fxRate} />
      </section>

      {/* Section 3: 실적 임박 필승주 */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4.5 h-4.5 text-primary" />
          <h3 className="text-sm font-semibold">실적 임박 필승주</h3>
        </div>
        <EarningsWatchSection />
      </section>
    </div>
  );
}
