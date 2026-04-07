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
      <Card className="border-emerald-500/30 bg-emerald-500/5">
        <CardContent className="p-3 text-xs text-muted-foreground space-y-1.5">
          <p className="font-bold text-emerald-400 text-sm">📈 복리매매 + 데이장 단타 전략</p>
          <p className="italic text-emerald-400/80">"수익이 쌓일수록 포지션이 커진다. 데이장에서 AI가 선점하고, 정규장에서 수확한다."</p>
          <div className="border-l-2 border-emerald-500/40 pl-2 space-y-0.5">
            <p className="font-semibold text-foreground">[복리매매] 수익금 재투입 복리 성장</p>
            <p>💰 수익 → 원금 합산 → 포지션 ↑ → 수익 가속 (복리 효과)</p>
            <p>📊 일일 목표 ₩30만~₩50만 (잔고 대비 6~10% 동적 조절)</p>
          </div>
          <div className="border-l-2 border-blue-500/40 pl-2 space-y-0.5">
            <p className="font-semibold text-foreground">[데이장 단타] 프리마켓 매수 → 정규장 매도</p>
            <p>🌙 데이장: AI 10대 지표 분석으로 저가 선점 매수</p>
            <p>☀️ 정규장: 유동성 풍부한 시간대에 +3~7% 수익 실현</p>
          </div>
          <div className="border-l-2 border-yellow-500/40 pl-2 space-y-0.5">
            <p className="font-semibold text-foreground">[엄격한 리스크 관리]</p>
            <p>🔒 손절 -5% | +1%→SL+0.3% | +3%→즉시 확정 | 일일 손실 한도 잔고 10%</p>
            <p>🔥 체결강도 200%↑ → 트레일링(고점-1.5%)으로 대시세 추격</p>
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
