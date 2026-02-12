import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuantSignals } from "@/hooks/useStockData";
import { aiAnalyzeAndTrade } from "@/lib/api";
import { Target, BarChart3, Shield, Radio, RefreshCw, DollarSign, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import { RadarChartCard, INDICATOR_LABELS } from "@/components/recommendation/RadarChartCard";
import { StockCard } from "@/components/recommendation/StockCard";

export default function RecommendationPage() {
  const { data, isLoading, refetch, isFetching } = useQuantSignals();
  const [tradingSymbol, setTradingSymbol] = useState<string | null>(null);
  const [selectedStock, setSelectedStock] = useState<any>(null);

  const premium = data?.premium || [];
  const penny = data?.penny || [];

  const handleAITrade = useCallback(async (stock: any) => {
    setTradingSymbol(stock.symbol);
    try {
      const result = await aiAnalyzeAndTrade(stock.symbol, stock.price, undefined, stock.totalScore, stock.indicators);
      if (result.trade) {
        toast.success(`AI가 ${stock.symbol} ${result.trade.quantity}주를 $${result.trade.price}에 매수! [Score: ${stock.totalScore}]`);
      } else {
        toast.info(`AI 판단: ${result.decision?.action} (${result.decision?.confidence}%) - ${result.decision?.reason}`);
      }
    } catch (err: any) {
      toast.error(`거래 오류: ${err.message}`);
    } finally {
      setTradingSymbol(null);
    }
  }, []);

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
              onTrade={handleAITrade}
              isTrading={tradingSymbol === stock.symbol}
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
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isFetching ? 'animate-spin' : ''}`} />
            새로고침
          </Button>
          <Badge variant="outline" className="font-mono text-xs">
            <Radio className="w-3 h-3 mr-1" />
            2분 자동갱신
          </Badge>
        </div>
      </div>

      <Card className="border-primary/20">
        <CardContent className="p-4 text-xs text-muted-foreground">
          <p className="font-medium text-foreground mb-1">📊 10대 전문 지표 기반 AI 퀀트 분석</p>
          <p>감성분석 · RVOL · 캔들패턴 · ATR변동성 · 갭분석 · 숏스퀴즈 · 가격위치 · 섹터동조화 · 체결강도 · 프리마켓</p>
          <p className="mt-1">합산 50점 이상 + [현재가{'>'}VWAP] + [RVOL{'>'}1.2] 충족 시 AI 자동 매수 실행 (10% 정찰병 → 80점+ 피라미딩)</p>
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
