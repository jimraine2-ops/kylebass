import { useState, useCallback, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuantSignals } from "@/hooks/useStockData";
import { quantAutoTrade } from "@/lib/api";
import { Target, BarChart3, Shield, Radio, RefreshCw, DollarSign, TrendingDown, Cpu } from "lucide-react";
import { toast } from "sonner";
import { RadarChartCard, INDICATOR_LABELS } from "@/components/recommendation/RadarChartCard";
import { StockCard } from "@/components/recommendation/StockCard";
import { QuantAutoBriefing } from "@/components/recommendation/QuantAutoBriefing";

export default function RecommendationPage() {
  const { data, isLoading, refetch, isFetching } = useQuantSignals();
  const [selectedStock, setSelectedStock] = useState<any>(null);
  const [fullAutoEnabled, setFullAutoEnabled] = useState(true);
  const [autoLogs, setAutoLogs] = useState<string[]>([]);
  const [lastConditions, setLastConditions] = useState<any>(null);
  const [processingSymbols, setProcessingSymbols] = useState<Set<string>>(new Set());
  const processedRef = useRef<Set<string>>(new Set());

  const premium = data?.premium || [];
  const penny = data?.penny || [];
  const allStocks = [...premium, ...penny];

  // Full-Auto Trading Loop
  useEffect(() => {
    if (!fullAutoEnabled || allStocks.length === 0) return;

    const processAutoTrade = async () => {
      for (const stock of allStocks) {
        const cycleKey = `${stock.symbol}-${stock.totalScore}`;
        if (processedRef.current.has(cycleKey)) continue;
        if (stock.totalScore < 50) continue;

        processedRef.current.add(cycleKey);
        setProcessingSymbols(prev => new Set(prev).add(stock.symbol));

        try {
          const result = await quantAutoTrade(
            stock.symbol,
            stock.price,
            stock.totalScore,
            stock.indicators
          );

          if (result.logs?.length > 0) {
            setAutoLogs(prev => [...result.logs, ...prev].slice(0, 50));
          }
          if (result.conditions) {
            setLastConditions(result.conditions);
          }
          if (result.trade) {
            toast.success(`[Quant] ${stock.symbol} ${result.trade.quantity}주 자율 매수 완료 [Score: ${stock.totalScore}]`);
          }
          if (result.closedTrades?.length > 0) {
            for (const ct of result.closedTrades) {
              const pnlStr = ct.pnl >= 0 ? `+$${ct.pnl.toFixed(2)}` : `-$${Math.abs(ct.pnl).toFixed(2)}`;
              toast.info(`[Quant] 청산: ${ct.symbol} ${pnlStr}`);
            }
          }
        } catch (err: any) {
          if (!err.message?.includes('Rate limit')) {
            console.error(`Quant auto-trade error for ${stock.symbol}:`, err);
          }
        } finally {
          setProcessingSymbols(prev => {
            const next = new Set(prev);
            next.delete(stock.symbol);
            return next;
          });
        }
      }
    };

    processAutoTrade();

    const resetInterval = setInterval(() => {
      processedRef.current.clear();
    }, 60000);

    return () => clearInterval(resetInterval);
  }, [fullAutoEnabled, data]);

  const renderList = (stocks: any[]) => (
    stocks.length === 0 ? (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          분석 가능한 종목이 없습니다. 잠시 후 다시 시도해주세요.
        </CardContent>
      </Card>
    ) : (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          {stocks.map((stock: any, idx: number) => (
            <StockCard
              key={stock.symbol}
              stock={stock}
              idx={idx}
              isSelected={selectedStock?.symbol === stock.symbol}
              onSelect={setSelectedStock}
              onTrade={() => {}}
              isTrading={processingSymbols.has(stock.symbol)}
              isAutoMode={fullAutoEnabled}
            />
          ))}
        </div>
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                {selectedStock ? `${selectedStock.symbol} 지표 레이더` : '종목을 선택하세요'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedStock ? (
                <RadarChartCard indicators={selectedStock.indicators} />
              ) : (
                <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
                  좌측 종목 클릭 시 레이더 차트 표시
                </div>
              )}
            </CardContent>
          </Card>
          {selectedStock && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">지표 상세</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {Object.entries(selectedStock.indicators || {}).map(([key, ind]: [string, any]) => (
                  <div key={key} className="flex items-start justify-between text-xs border-b border-border/50 pb-1.5">
                    <div>
                      <p className="font-medium">{INDICATOR_LABELS[key]}</p>
                      <p className="text-muted-foreground text-[10px]">{ind.details}</p>
                    </div>
                    <Badge variant={ind.score >= 8 ? "default" : ind.score >= 5 ? "secondary" : "outline"} className="text-[10px] shrink-0">
                      {ind.score}/10
                    </Badge>
                  </div>
                ))}
                {selectedStock.trailingStop > 0 && (
                  <div className="flex items-center gap-2 mt-2 p-2 rounded bg-muted text-xs">
                    <Shield className="w-3.5 h-3.5 text-warning" />
                    <span>추적 손절선: <span className="font-mono font-bold">${selectedStock.trailingStop?.toFixed(4)}</span></span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    )
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Target className="w-5 h-5 text-primary" />
          10대 지표 종목 추천
        </h2>
        <div className="flex items-center gap-2">
          <Button
            variant={fullAutoEnabled ? "default" : "outline"}
            size="sm"
            onClick={() => setFullAutoEnabled(!fullAutoEnabled)}
            className={fullAutoEnabled ? "bg-stock-up hover:bg-stock-up/80" : ""}
          >
            <Cpu className={`w-3.5 h-3.5 mr-1 ${fullAutoEnabled ? 'animate-pulse' : ''}`} />
            {fullAutoEnabled ? 'QUANT AI: ACTIVE' : 'QUANT AI: OFF'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isFetching ? 'animate-spin' : ''}`} />
            새로고침
          </Button>
          <Badge variant="outline" className="font-mono text-xs">
            <Radio className="w-3 h-3 mr-1" />
            30초 자동갱신
          </Badge>
        </div>
      </div>

      {/* Auto-Trade Briefing */}
      <QuantAutoBriefing logs={autoLogs} conditions={lastConditions} isActive={fullAutoEnabled} />

      <Card className="border-primary/20">
        <CardContent className="p-4 text-xs text-muted-foreground">
          <p className="font-medium text-foreground mb-1">📊 10대 전문 지표 기반 AI 퀀트 자율 매매 → Main Trading 통합</p>
          <p>✅ 진입: [합산 ≥ 50점] AND [호재 {'>'} 0] AND [RVOL {'>'} 1.5] AND [현재가 {'>'} VWAP] → 15% 자동 매수</p>
          <p>📈 피라미딩: 80점 돌파 시 +10% 추가 매수</p>
          <p>🛡️ 청산: -2.5% 손절 | 점수{'<'}40 근거소멸 | 목표가 50% 익절 → ATR×2 추격 익절</p>
          <p className="mt-1 text-primary font-medium">💰 모든 거래는 Main Trading 잔고를 사용하며, [Quant] 태그로 구분됩니다.</p>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : (
        <Tabs defaultValue="premium" onValueChange={() => setSelectedStock(null)}>
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="premium" className="flex items-center gap-1.5">
              <DollarSign className="w-4 h-4" />
              Premium Picks ($10+)
              <Badge variant="secondary" className="ml-1 text-[10px] px-1.5">{premium.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="penny" className="flex items-center gap-1.5">
              <TrendingDown className="w-4 h-4" />
              Penny/Small-Cap (&lt;$10)
              <Badge variant="secondary" className="ml-1 text-[10px] px-1.5">{penny.length}</Badge>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="premium">
            {renderList(premium)}
          </TabsContent>
          <TabsContent value="penny">
            {renderList(penny)}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
