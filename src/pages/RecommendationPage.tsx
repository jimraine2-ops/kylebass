import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuantSignals } from "@/hooks/useStockData";
import { Target, BarChart3, Shield, Radio, RefreshCw, Cloud, ArrowUpDown } from "lucide-react";
import { RadarChartCard, INDICATOR_LABELS } from "@/components/recommendation/RadarChartCard";
import { StockCard } from "@/components/recommendation/StockCard";
import { ServerStatusBanner } from "@/components/trading/ServerStatusBanner";

type SortKey = 'score' | 'changePct' | 'rvol';

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'score', label: '점수순' },
  { value: 'changePct', label: '상승률순' },
  { value: 'rvol', label: '거래량순' },
];

export default function RecommendationPage() {
  const { data, isLoading, refetch, isFetching } = useQuantSignals();
  const [selectedStock, setSelectedStock] = useState<any>(null);
  const [sortKey, setSortKey] = useState<SortKey>('score');

  const premium = data?.premium || [];
  const allStocks = premium;

  const sortedStocks = useMemo(() => {
    const sorted = [...allStocks];
    switch (sortKey) {
      case 'score': sorted.sort((a, b) => b.totalScore - a.totalScore); break;
      case 'changePct': sorted.sort((a, b) => (b.changePct || 0) - (a.changePct || 0)); break;
      case 'rvol': sorted.sort((a, b) => (b.indicators?.rvol?.rvol || 0) - (a.indicators?.rvol?.rvol || 0)); break;
    }
    return sorted;
  }, [allStocks, sortKey]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Target className="w-5 h-5 text-primary" />
          대형주 실시간 모니터링
        </h2>
        <div className="flex items-center gap-2">
          <Badge className="bg-stock-up/20 text-stock-up border-stock-up/30 text-xs">
            <Cloud className="w-3.5 h-3.5 mr-1" />
            Cloud Agent: 서버 자율 매매 중
          </Badge>
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

      {/* Server status */}
      <ServerStatusBanner />

      <Card className="border-primary/20">
        <CardContent className="p-4 text-xs text-muted-foreground">
          <p className="font-medium text-foreground mb-1">📊 10대 지표 기반 Cloud Agent 자율 매매 (서버 백그라운드 실행)</p>
          <p>✅ 진입: [합산 ≥ 50점] AND [호재 {'>'} 0] AND [RVOL {'>'} 1.5] AND [현재가 {'>'} VWAP] → 15% 자동 매수</p>
          <p>📈 피라미딩: 80점 돌파 시 +10% 추가 매수</p>
          <p>🛡️ 청산: -2.5% 손절 | 점수{'<'}40 근거소멸 | 목표가 50% 익절 → ATR×2 추격 익절</p>
          <p className="mt-1 text-primary font-medium">☁️ 브라우저를 닫아도 서버에서 1분 간격으로 자동 실행됩니다.</p>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">Top {sortedStocks.length}개 종목</Badge>
              {data?.allScanned && (
                <span className="text-xs text-muted-foreground">(총 {data.allScanned}개 스캔)</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" />
              <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
                <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <ScrollArea className="h-[calc(100vh-420px)] min-h-[400px]">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pr-3">
                  {sortedStocks.length === 0 ? (
                    <Card className="col-span-full">
                      <CardContent className="p-8 text-center text-muted-foreground">
                        분석 가능한 종목이 없습니다.
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
                        isTrading={false}
                        isAutoMode={true}
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
                  <CardHeader className="pb-2"><CardTitle className="text-sm">지표 상세</CardTitle></CardHeader>
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
