import { Bot, Radio, ScanLine } from "lucide-react";
import { SlimTradingDashboard } from "@/components/trading/SlimTradingDashboard";
import { SessionIndicator } from "@/components/trading/SessionIndicator";
import { ServerStatusBanner } from "@/components/trading/ServerStatusBanner";
import { AgentLogViewer } from "@/components/trading/AgentLogViewer";
import { LiveSyncIndicator } from "@/components/trading/LiveSyncIndicator";
import { useWebSocketPrices } from "@/hooks/useWebSocketPrice";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { useUnifiedPortfolio } from "@/hooks/useStockData";
import { useMemo, useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";

function ScanStatusBar() {
  const [dots, setDots] = useState(1);
  useEffect(() => {
    const interval = setInterval(() => setDots(d => d >= 3 ? 1 : d + 1), 600);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/5 border border-primary/20 animate-fade-in">
      <ScanLine className="w-4 h-4 text-primary animate-pulse" />
      <span className="text-xs font-medium text-primary">
        전 종목 광대역 스캔 중{'.'.repeat(dots)}
      </span>
      <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
        <div className="h-full bg-primary/60 rounded-full animate-[scan_2s_ease-in-out_infinite]" />
      </div>
      <Badge variant="outline" className="text-[9px] border-primary/30 text-primary gap-1">
        <Radio className="w-2.5 h-2.5 animate-pulse" />
        LIVE
      </Badge>
    </div>
  );
}

export default function AITradingPage() {
  const { data } = useUnifiedPortfolio();
  const { rate: fxRate, isLive: fxLive } = useExchangeRate();

  const allSymbols = useMemo(() => {
    const symbols = new Set<string>();
    (data?.openPositions || []).forEach((p: any) => symbols.add(p.symbol));
    return Array.from(symbols);
  }, [data?.openPositions]);

  const ws = useWebSocketPrices(allSymbols);

  return (
    <div className="space-y-3 max-w-2xl mx-auto">
      {/* Compact Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-base font-bold flex items-center gap-2">
          <Bot className="w-4 h-4 text-primary" />
          통합 KPI
        </h2>
        <div className="flex items-center gap-1.5 flex-wrap">
          <LiveSyncIndicator
            isConnected={ws.isConnected}
            latencyMs={ws.latencyMs}
            lastUpdateAt={ws.lastUpdateAt}
          />
          <Badge variant="outline" className={`text-[9px] px-1.5 py-0.5 gap-1 ${fxLive ? 'border-[hsl(var(--stock-up))]/30 text-[hsl(var(--stock-up))]' : 'border-warning/30 text-warning'}`}>
            💱 ₩{fxRate.toLocaleString('ko-KR')}
          </Badge>
        </div>
      </div>

      {/* Session & Status - compact */}
      <SessionIndicator />
      <ScanStatusBar />
      <ServerStatusBanner />

      {/* Agent Log - collapsible */}
      <AgentLogViewer />

      {/* Slim Dashboard */}
      <SlimTradingDashboard wsGetPrice={ws.getPrice} wsConnected={ws.isConnected} fxRate={fxRate} />
    </div>
  );
}
