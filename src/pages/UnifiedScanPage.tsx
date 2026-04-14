import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuantSignals, usePennyStocks, useUnifiedPortfolio } from "@/hooks/useStockData";
import { useWebSocketPrices } from "@/hooks/useWebSocketPrice";
import { Target, BarChart3, Shield, Radio, RefreshCw, Cloud, ArrowUpDown, Flame, TrendingUp, Activity } from "lucide-react";
import { RadarChartCard, INDICATOR_LABELS } from "@/components/recommendation/RadarChartCard";
import { StockCard } from "@/components/recommendation/StockCard";
import StockCardItem from "@/components/penny/StockCardItem";
import { ServerStatusBanner } from "@/components/trading/ServerStatusBanner";
import { LiveSyncIndicator } from "@/components/trading/LiveSyncIndicator";

type SortKey = 'score' | 'changePct' | 'rvol';
type ViewMode = 'all' | 'large' | 'small';

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'score', label: '점수순' },
  { value: 'changePct', label: '상승률순' },
  { value: 'rvol', label: '거래량순' },
];

export default function UnifiedScanPage() {
  const { data: quantData, isLoading: quantLoading, refetch: quantRefetch, isFetching: quantFetching } = useQuantSignals();
  const { data: pennyData, isLoading: pennyLoading } = usePennyStocks();
  const { data: portfolioData } = useUnifiedPortfolio();
  const [selectedStock, setSelectedStock] = useState<any>(null);
  const [sortKey, setSortKey] = useState<SortKey>('score');
  const [viewMode, setViewMode] = useState<ViewMode>('all');

  const isLoading = quantLoading || pennyLoading;

  const largeStocks = quantData?.premium || [];
  const smallStocks = pennyData?.stocks || [];
  const openPositions = portfolioData?.openPositions || [];
  const holdingSymbols = new Set(openPositions.map((p: any) => String(p.symbol)));

  // WebSocket for small-cap real-time
  const wsSymbols = useMemo(() => smallStocks.map((s: any) => s.symbol), [smallStocks]);
  const { prices: wsPrices, isConnected: wsConnected, latencyMs } = useWebSocketPrices(wsSymbols);

  // Enrich small stocks with WS prices
  const enrichedSmallStocks = useMemo(() => {
    return smallStocks.map((s: any) => {
      const wsData = wsPrices.get(s.symbol);
      if (wsData && wsData.price > 0) {
        const newPrice = wsData.price;
        const change = newPrice - (s.previousClose || s.regularMarketPrice);
        const changePct = s.previousClose > 0 ? (change / s.previousClose) * 100 : s.regularMarketChangePercent;
        return { ...s, regularMarketPrice: newPrice, regularMarketChange: change, regularMarketChangePercent: changePct, isHot: changePct >= 10, wsLive: true, capType: 'small' };
      }
      return { ...s, wsLive: false, capType: 'small' };
    });
  }, [smallStocks, wsPrices]);

  // Combine and sort all stocks
  const allStocks = useMemo(() => {
    const large = largeStocks.map((s: any) => ({ ...s, capType: 'large' }));
    const small = enrichedSmallStocks.map((s: any) => ({
      ...s,
      totalScore: s.totalScore || s.quantScore || 0,
      capType: 'small',
    }));

    let combined = viewMode === 'large' ? large : viewMode === 'small' ? small : [...large, ...small];

    combined.sort((a: any, b: any) => {
      switch (sortKey) {
        case 'score': return (b.totalScore || 0) - (a.totalScore || 0);
        case 'changePct': return (b.changePct || b.regularMarketChangePercent || 0) - (a.changePct || a.regularMarketChangePercent || 0);
        case 'rvol': return (b.indicators?.rvol?.rvol || 0) - (a.indicators?.rvol?.rvol || 0);
        default: return 0;
      }
    });

    return combined.slice(0, 80);
  }, [largeStocks, enrichedSmallStocks, sortKey, viewMode]);

  const hotStocks = allStocks.filter((s: any) => (s.changePct || s.regularMarketChangePercent || 0) >= 10);
  const surgingStocks = allStocks.filter((s: any) => (s.changePct || s.regularMarketChangePercent || 0) >= 5);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Target className="w-5 h-5 text-primary" />
          통합 실시간 거래 현황
        </h2>
        <div className="flex items-center gap-2">
          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs">
            <Shield className="w-3.5 h-3.5 mr-1" />
            Finnhub×TwelveData 하이브리드 | Zero-Loss
          </Badge>
          <Button variant="outline" size="sm" onClick={() => quantRefetch()} disabled={quantFetching}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${quantFetching ? 'animate-spin' : ''}`} />
            새로고침
          </Button>
        </div>
      </div>

      <ServerStatusBanner />

      {/* Live Status */}
      <div className="rounded-lg p-3 flex items-center justify-between flex-wrap gap-2 border border-stock-up/50 bg-stock-up/5">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold bg-stock-up/20 text-stock-up">
            <div className={`w-2.5 h-2.5 rounded-full ${wsConnected ? 'bg-stock-up animate-pulse' : 'bg-muted-foreground'}`} />
            {wsConnected ? 'LIVE: WebSocket' : 'REST 폴링'}
          </div>
          <Badge variant="outline" className="text-[10px]">보유: {openPositions.length}/3</Badge>
          <Badge variant="outline" className="text-[10px] border-destructive/40 text-destructive">
            <Flame className="w-3 h-3 mr-1" />+10% 급등: {hotStocks.length}개
          </Badge>
          <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">
            <TrendingUp className="w-3 h-3 mr-1" />+5% 이상: {surgingStocks.length}개
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {wsConnected && (
            <Badge variant="outline" className="text-xs font-mono text-stock-up border-stock-up/30">
              <Activity className="w-3 h-3 mr-1" />{latencyMs}ms
            </Badge>
          )}
          <Badge variant="outline" className="text-xs font-mono"><Radio className="w-3 h-3 mr-1" />자동 갱신</Badge>
        </div>
      </div>

      <Card className="border-yellow-500/30 bg-yellow-500/5">
        <CardContent className="p-3 text-xs text-muted-foreground space-y-1.5">
          <p className="font-bold text-yellow-400 text-sm">🏆 Finnhub × Twelve Data 하이브리드 필승 전략</p>
          <p className="italic text-yellow-400/80">"Finnhub로 사냥감을 식별하고, Twelve Data로 심장을 쏜다. 100% 익절이 보장되지 않으면 방아쇠를 당기지 마라."</p>
          <div className="border-l-2 border-yellow-500/40 pl-2 space-y-0.5">
            <p className="font-semibold text-foreground">[Dual-Engine] 데이터 소스 역할 분담</p>
            <p>📰 Finnhub: 뉴스 감성 85%↑ 'Extreme Bullish' + 섹터 모멘텀 주도주 리스트</p>
            <p>📊 Twelve Data: 10대 지표(RSI·MACD·VWAP·볼린저) 0.1초 쿼리 + 호가·체결 감시</p>
          </div>
          <div className="border-l-2 border-stock-up/40 pl-2 space-y-0.5">
            <p className="font-semibold text-foreground">[Zero-Loss] The Golden Cross 진입</p>
            <p>🔒 ₩12,000↓ + Extreme Bullish + 수렴→발산 + 익절확률 90%↑ → ₩100만 5종목 집중</p>
            <p>🔒 +0.8% → SL 매수가+0.1% 강제 고정 (Zero-Risk Lock)</p>
          </div>
          <div className="border-l-2 border-primary/40 pl-2 space-y-0.5">
            <p className="font-semibold text-foreground">[Iron-Hold] 무패 & 30~50% 추격</p>
            <p>🛡️ 익절확률 90%+ → 눌림목 매도 금지 | 점수 45점 미만 붕괴 시까지 무제한 홀딩</p>
          </div>
          <div className="border-l-2 border-blue-500/40 pl-2 space-y-0.5">
            <p className="font-semibold text-foreground">[Anti-Latency] 데이터 시차 역이용 + 호가 장악</p>
            <p>🔮 예측형 선취매: 뉴스 전 지표 60점 돌파 시 2~3호가 아래 지정가 대기</p>
            <p>⏱️ Timestamp Guard: 1초↑ 지연 시 추격매수 차단 → Limit Order 자동 전환</p>
            <p>💧 Liquidity Guard: 진입금액 10배↑ 매수잔량 확인 → Passive Fill(호가 알박기)</p>
          </div>
          <div className="border-l-2 border-blue-500/40 pl-2 space-y-0.5">
            <p className="font-semibold text-foreground">[📉 Dip-Buy] 고유동성 하락봉 매입</p>
            <p>💰 거래대금 50억↑($3.7M) 대장주만 타격</p>
            <p>📉 25개봉 하락 + RSI 30↓ 반등 포착 → ₩100만 투입</p>
            <p>🎯 반등 2.0% 즉시 익절 | 체결강도 120%↑ 시 3.0% 트레일링 전환</p>
            <p>🛡️ 수익권 즉시 본절보호(+0.2%) 최우선 활성화</p>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-2">
          {Array.from({ length: 20 }).map((_, i) => <Skeleton key={i} className="h-36" />)}
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Badge variant={viewMode === 'all' ? 'default' : 'outline'} className="cursor-pointer text-xs" onClick={() => setViewMode('all')}>전체 ({allStocks.length})</Badge>
              <Badge variant={viewMode === 'large' ? 'default' : 'outline'} className="cursor-pointer text-xs" onClick={() => setViewMode('large')}>대형주 ({largeStocks.length})</Badge>
              <Badge variant={viewMode === 'small' ? 'default' : 'outline'} className="cursor-pointer text-xs" onClick={() => setViewMode('small')}>소형주 ({enrichedSmallStocks.length})</Badge>
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
                  {allStocks.length === 0 ? (
                    <Card className="col-span-full">
                      <CardContent className="p-8 text-center text-muted-foreground">스캔 중입니다...</CardContent>
                    </Card>
                  ) : (
                    allStocks.map((stock: any, idx: number) => (
                      <StockCard
                        key={`${stock.symbol}-${stock.capType}`}
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
                  {selectedStock?.indicators ? (
                    <RadarChartCard indicators={selectedStock.indicators} />
                  ) : (
                    <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
                      좌측 종목 클릭 시 레이더 차트 표시
                    </div>
                  )}
                </CardContent>
              </Card>
              {selectedStock?.indicators && (
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
