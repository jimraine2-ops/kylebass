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
          <p className="font-bold text-yellow-400 text-sm">⚔️ 복병 타파 & 100% 익절 집행서</p>
          <p className="italic text-yellow-400/80">"데이터가 늦다면 예측으로 앞서가고, 슬리피지가 두렵다면 호가를 장악하라. 어떤 악조건에서도 '패배'는 선택지에 없다."</p>
          <div className="border-l-2 border-blue-500/40 pl-2 space-y-0.5">
            <p className="font-semibold text-foreground">[Anti-Latency] 데이터 시차 역이용</p>
            <p>🔮 예측형 매수: 가격 선행 → 뉴스 후행 구간 포착 → 지표 60점 돌파 시 선취매</p>
            <p>⏱️ Timestamp Guard: 1초↑ 지연 → 2~3호가 아래 Limit Order (추격매수 차단)</p>
          </div>
          <div className="border-l-2 border-stock-up/40 pl-2 space-y-0.5">
            <p className="font-semibold text-foreground">[Liquidity Guard] 호가 장악 & 슬리피지 정복</p>
            <p>💧 진입금액 10배↑ 매수잔량 확인 → 내가 던져도 받아줄 물량이 있는 종목만 진입</p>
            <p>🎯 Passive Fill: 시장가 금지 → 매수 1호가 알박기 → 슬리피지 = 0</p>
          </div>
          <div className="border-l-2 border-primary/40 pl-2 space-y-0.5">
            <p className="font-semibold text-foreground">[Select-5] 정예 종목 집중 운용</p>
            <p>🔒 전 종목 스캔 → 5개 정예 종목 ₩100만 배분 → 30~50% 목표 무조건 홀딩</p>
            <p>🛡️ Zero-Risk Lock + Iron-Hold → 어떤 파동에도 패배 기록 0 유지</p>
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
