import { Badge } from "@/components/ui/badge";
import { Radio, Bot, Wallet } from "lucide-react";
import { Link } from "react-router-dom";
import { UnifiedPortfolio } from "@/components/dashboard/UnifiedPortfolio";

import { useWebSocketPrices } from "@/hooks/useWebSocketPrice";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { useAIPortfolio, useScalpingPortfolio } from "@/hooks/useStockData";
import { useMemo } from "react";
import { LiveSyncIndicator } from "@/components/trading/LiveSyncIndicator";

export default function Dashboard() {
  const { data: mainData } = useAIPortfolio();
  const { data: scalpData } = useScalpingPortfolio();
  const { rate: fxRate, isLive: fxLive } = useExchangeRate();

  // Collect all held symbols for WebSocket
  const allSymbols = useMemo(() => {
    const syms = new Set<string>();
    (mainData?.openPositions || []).forEach((p: any) => syms.add(p.symbol));
    (scalpData?.openPositions || []).forEach((p: any) => syms.add(p.symbol));
    return Array.from(syms);
  }, [mainData?.openPositions, scalpData?.openPositions]);

  const ws = useWebSocketPrices(allSymbols);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold">통합 대시보드</h2>
        <div className="flex items-center gap-2">
          <LiveSyncIndicator
            isConnected={ws.isConnected}
            latencyMs={ws.latencyMs}
            lastUpdateAt={ws.lastUpdateAt}
          />
          <Badge variant="outline" className={`text-[10px] px-2 py-0.5 gap-1 ${fxLive ? 'border-[hsl(var(--stock-up)/0.3)] text-[hsl(var(--stock-up))]' : 'border-[hsl(var(--warning)/0.3)] text-[hsl(var(--warning))]'}`}>
            💱 {fxLive ? '실시간' : '고정'} ₩{fxRate.toLocaleString('ko-KR')}/USD
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            <Radio className="w-3 h-3 mr-1" />실시간
          </Badge>
        </div>
      </div>

      {/* Quick AI Trading Link */}
      <Link to="/ai-trading" className="block">
        <div className="flex items-center gap-3 p-3 rounded-lg border border-primary/20 hover:border-primary/40 transition-colors bg-primary/5">
          <Bot className="w-5 h-5 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">AI 자율 매매 대시보드</p>
            <p className="text-[11px] text-muted-foreground">상세 KPI, 거래 로그, 에이전트 상태 확인</p>
          </div>
          <div className="flex items-center gap-4 text-xs shrink-0">
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground">대형주</p>
              <p className={`font-bold font-mono ${(mainData?.stats?.cumulativeReturn || 0) >= 0 ? 'text-[hsl(var(--stock-up))]' : 'text-[hsl(var(--stock-down))]'}`}>
                {(mainData?.stats?.cumulativeReturn || 0) >= 0 ? '+' : ''}{mainData?.stats?.cumulativeReturn || 0}%
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground">소형주</p>
              <p className={`font-bold font-mono ${(scalpData?.stats?.cumulativeReturn || 0) >= 0 ? 'text-[hsl(var(--stock-up))]' : 'text-[hsl(var(--stock-down))]'}`}>
                {(scalpData?.stats?.cumulativeReturn || 0) >= 0 ? '+' : ''}{scalpData?.stats?.cumulativeReturn || 0}%
              </p>
            </div>
            <Wallet className="w-4 h-4 text-muted-foreground" />
          </div>
        </div>
      </Link>

      {/* Section 1: Unified Portfolio (all open positions) */}
      <UnifiedPortfolio wsGetPrice={ws.getPrice} fxRate={fxRate} />
    </div>
  );
}
