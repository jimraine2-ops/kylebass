import { useState, useCallback, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuantSignals } from "@/hooks/useStockData";
import { quantAutoTrade } from "@/lib/api";
import { Target, BarChart3, Shield, Radio, RefreshCw, Cpu, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";
import { RadarChartCard, INDICATOR_LABELS } from "@/components/recommendation/RadarChartCard";
import { StockCard } from "@/components/recommendation/StockCard";
import { QuantAutoBriefing } from "@/components/recommendation/QuantAutoBriefing";

type SortKey = 'score' | 'changePct' | 'rvol';

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'score', label: '점수순' },
  { value: 'changePct', label: '상승률순' },
  { value: 'rvol', label: '거래량순' },
];

export default function RecommendationPage() {
  const { data, isLoading, refetch, isFetching } = useQuantSignals();
  const [selectedStock, setSelectedStock] = useState<any>(null);
  const [fullAutoEnabled, setFullAutoEnabled] = useState(true);
  const [autoLogs, setAutoLogs] = useState<string[]>([]);
  const [lastConditions, setLastConditions] = useState<any>(null);
  const [processingSymbols, setProcessingSymbols] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>('score');
  

  const premium = data?.premium || [];
  const allStocks = premium;

  const sortedStocks = useMemo(() => {
    const sorted = [...allStocks];
    switch (sortKey) {
      case 'score':
        sorted.sort((a, b) => b.totalScore - a.totalScore);
        break;
      case 'changePct':
        sorted.sort((a, b) => (b.changePct || 0) - (a.changePct || 0));
        break;
      case 'rvol':
        sorted.sort((a, b) => (b.indicators?.rvol?.rvol || 0) - (a.indicators?.rvol?.rvol || 0));
        break;
    }
    return sorted;
  }, [allStocks, sortKey]);

  // Full-Auto Trading Loop - Continuous
  useEffect(() => {
    if (!fullAutoEnabled || allStocks.length === 0) return;

    let cancelled = false;

    const processAutoTrade = async () => {
      for (const stock of allStocks) {
        if (cancelled) return;
        if (stock.totalScore < 50) continue;

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
              const pnlStr = ct.pnl >= 0 ? `+₩${Math.abs(ct.pnl).toLocaleString('ko-KR')}` : `-₩${Math.abs(ct.pnl).toLocaleString('ko-KR')}`;
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

    // Run immediately, then repeat every 15 seconds
    processAutoTrade();
    const loopInterval = setInterval(() => {
      if (!cancelled) processAutoTrade();
    }, 15000);

    return () => {
      cancelled = true;
      clearInterval(loopInterval);
    };
  }, [fullAutoEnabled, data]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Target className="w-5 h-5 text-primary" />
          대형주 실시간 거래 현황
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
          <p className="mt-1 text-muted-foreground">🔍 S&P 500 + 성장주 {data?.allScanned || 70}개 스캔 → 상위 50개 실시간 모니터링</p>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : (
        <>
          {/* Sorting Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                Top {sortedStocks.length}개 종목
              </Badge>
              {data?.allScanned && (
                <span className="text-xs text-muted-foreground">
                  (총 {data.allScanned}개 스캔)
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" />
              <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
                <SelectTrigger className="w-[120px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Stock List with Virtual Scroll */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <ScrollArea className="h-[calc(100vh-420px)] min-h-[400px]">
                <div className="space-y-3 pr-3">
                  {sortedStocks.length === 0 ? (
                    <Card>
                      <CardContent className="p-8 text-center text-muted-foreground">
                        분석 가능한 종목이 없습니다. 잠시 후 다시 시도해주세요.
                      </CardContent>
                    </Card>
                  ) : (
                    sortedStocks.map((stock: any, idx: number) => (
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
                    ))
                  )}
                </div>
              </ScrollArea>
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
        </>
      )}
    </div>
  );
}