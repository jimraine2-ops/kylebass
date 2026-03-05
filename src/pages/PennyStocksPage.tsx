import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { usePennyStocks, useScalpingPortfolio } from "@/hooks/useStockData";
import { useWebSocketPrices } from "@/hooks/useWebSocketPrice";
import { Flame, Cloud, Radio, ShieldCheck, Eye, Zap, TrendingUp, Activity } from "lucide-react";
import StockCardItem from "@/components/penny/StockCardItem";
import { ServerStatusBanner } from "@/components/trading/ServerStatusBanner";
import { LiveSyncIndicator } from "@/components/trading/LiveSyncIndicator";

export default function PennyStocksPage() {
  const { data, isLoading } = usePennyStocks();
  const { data: portfolioData } = useScalpingPortfolio();

  const stocks = data?.stocks || [];
  const openPositions = portfolioData?.openPositions || [];
  const holdingSymbols = new Set(openPositions.map((p: any) => String(p.symbol)));

  // WebSocket subscription for all 50 symbols
  const wsSymbols = useMemo(() => stocks.map((s: any) => s.symbol), [stocks]);
  const { prices: wsPrices, isConnected: wsConnected, latencyMs } = useWebSocketPrices(wsSymbols);

  // Merge WS prices into stock data
  const enrichedStocks = useMemo(() => {
    return stocks.map((s: any) => {
      const wsData = wsPrices.get(s.symbol);
      if (wsData && wsData.price > 0) {
        const newPrice = wsData.price;
        const change = newPrice - (s.previousClose || s.regularMarketPrice);
        const changePct = s.previousClose > 0 ? (change / s.previousClose) * 100 : s.regularMarketChangePercent;
        return {
          ...s,
          regularMarketPrice: newPrice,
          regularMarketChange: change,
          regularMarketChangePercent: changePct,
          isHot: changePct >= 10,
          wsLive: true,
        };
      }
      return { ...s, wsLive: false };
    });
  }, [stocks, wsPrices]);

  const hotStocks = enrichedStocks.filter((s: any) => s.isHot);
  const hotSymbols = new Set(hotStocks.map((s: any) => s.symbol));
  const surgingStocks = enrichedStocks.filter((s: any) => (s.regularMarketChangePercent || 0) >= 5);

  return (
    <div className="space-y-4">
      {/* Strategy Banner */}
      <div className="rounded-lg p-2 border border-destructive/40 bg-destructive/5 flex items-center justify-center gap-2">
        <Flame className="w-4 h-4 text-destructive" />
        <span className="text-xs font-bold text-destructive">공격적 스캔 — 실시간 급상승 50종목 추출</span>
        <span className="text-[10px] text-muted-foreground">| 100+ 종목 로테이션 → TOP 50 | 10초 자동 갱신</span>
      </div>

      {/* Server Status */}
      <ServerStatusBanner />

      {/* Live Status Bar */}
      <div className="rounded-lg p-3 flex items-center justify-between flex-wrap gap-2 border border-stock-up/50 bg-stock-up/5">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold bg-stock-up/20 text-stock-up">
            <div className={`w-2.5 h-2.5 rounded-full ${wsConnected ? 'bg-stock-up animate-pulse' : 'bg-muted-foreground'}`} />
            <Cloud className="w-3.5 h-3.5" />
            {wsConnected ? 'LIVE: WebSocket 실시간' : 'REST 폴링 모드'}
          </div>
          <Badge variant="outline" className="text-[10px]">
            <ShieldCheck className="w-3 h-3 mr-1" />
            보유: {openPositions.length}/10
          </Badge>
          <Badge variant="outline" className="text-[10px] border-destructive/40 text-destructive">
            <Flame className="w-3 h-3 mr-1" />
            +10% 급등: {hotStocks.length}개
          </Badge>
          <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">
            <TrendingUp className="w-3 h-3 mr-1" />
            +5% 이상: {surgingStocks.length}개
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {wsConnected && (
            <Badge variant="outline" className="text-xs font-mono text-stock-up border-stock-up/30">
              <Activity className="w-3 h-3 mr-1" />
              {latencyMs}ms
            </Badge>
          )}
          <Badge variant="outline" className="text-xs font-mono">
            <Radio className="w-3 h-3 mr-1" />
            10초 갱신
          </Badge>
          <Badge variant="outline" className="text-xs">
            <Eye className="w-3 h-3 mr-1" />
            관전 모드
          </Badge>
        </div>
      </div>

      {/* Info Card */}
      <Card className="border-primary/30">
        <CardContent className="p-3 text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">⚡ 공격적 스캔 엔진 — 실시간 급상승 50종목 자동 매매 시스템</p>
          <p>• 100+ 종목 로테이션 스캔 → <span className="text-primary font-medium">변동성+거래량+모멘텀 복합 점수 TOP 50</span> 실시간 추출</p>
          <p>• <span className="text-destructive font-medium">10대 지표 50점 이상 + 3중 조건 충족 시 서버에서 자동 매수</span> | 자산 10% 분할 배분</p>
          <p>• 청산: +2%→50% 1차 익절 | +5% 고정 익절 | -2.5% 즉시 손절 | 고점+10% 후 -5% 추격익절</p>
          <p className="text-primary font-medium mt-1">💡 WebSocket 실시간 시세 + 10초 데이터 갱신 | 브라우저를 닫아도 서버 매매는 계속됩니다.</p>
        </CardContent>
      </Card>

      {/* Rotation Info */}
      {data?.rotationGroup && (
        <div className="flex items-center justify-center gap-2 text-[10px] text-muted-foreground">
          <Zap className="w-3 h-3" />
          스캔 그룹 {data.rotationGroup}/{data.totalGroups} 완료 | 총 {data.allScanned}개 스캔 → 상위 {enrichedStocks.length}개 표시
        </div>
      )}

      {/* Stock Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-2">
          {Array.from({ length: 20 }).map((_, i) => <Skeleton key={i} className="h-36" />)}
        </div>
      ) : enrichedStocks.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            종목을 스캔 중입니다... 10초 후 자동 갱신됩니다.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-2">
          {enrichedStocks.map((stock: any, idx: number) => (
            <StockCardItem
              key={stock.symbol}
              stock={stock}
              rank={idx + 1}
              isHot={hotSymbols.has(stock.symbol)}
              isTrading={false}
              isHolding={holdingSymbols.has(stock.symbol)}
              autoMode={true}
              onManualTrade={() => {}}
            />
          ))}
        </div>
      )}

      {data?.allScanned && (
        <p className="text-xs text-muted-foreground text-center">
          총 {data.allScanned}개 종목 스캔 → 상위 {enrichedStocks.length}개 모니터링 | 🔥 +10% 급등 {hotStocks.length}개 | ⚡ +5% 이상 {surgingStocks.length}개 | ☁️ Cloud Agent 24/7 자율 매매 중
        </p>
      )}
    </div>
  );
}
