import { useState, useMemo, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuantSignals, usePennyStocks, useUnifiedPortfolio } from "@/hooks/useStockData";
import { useWebSocketPrices } from "@/hooks/useWebSocketPrice";
import { Target, BarChart3, Shield, Radio, RefreshCw, Cloud, ArrowUpDown, Flame, TrendingUp, Activity, Sparkles } from "lucide-react";
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

const NEW_BADGE_DURATION_MS = 30000; // 30초

export default function UnifiedScanPage() {
  const { data: quantData, isLoading: quantLoading, refetch: quantRefetch, isFetching: quantFetching } = useQuantSignals();
  const { data: pennyData, isLoading: pennyLoading } = usePennyStocks();
  const { data: portfolioData } = useUnifiedPortfolio();
  const [selectedStock, setSelectedStock] = useState<any>(null);
  const [sortKey, setSortKey] = useState<SortKey>('score');
  const [viewMode, setViewMode] = useState<ViewMode>('all');

  // ★ NEW 배지 추적: symbol → 최초 발견 시각
  const knownSymbolsRef = useRef<Set<string>>(new Set());
  const [newSymbols, setNewSymbols] = useState<Map<string, number>>(new Map());

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

    return combined.slice(0, 100);
  }, [largeStocks, enrichedSmallStocks, sortKey, viewMode]);

  // ★ NEW 배지 감지: 새로 나타난 종목 추적
  useEffect(() => {
    if (allStocks.length === 0) return;
    const now = Date.now();
    const currentSymbolsList: string[] = allStocks.map((s: any) => String(s.symbol));
    const newMap = new Map(newSymbols);

    // 새로운 종목 감지
    for (const sym of currentSymbolsList) {
      if (!knownSymbolsRef.current.has(sym)) {
        newMap.set(sym, now);
        knownSymbolsRef.current.add(sym);
      }
    }

    // 30초 경과한 NEW 배지 제거
    for (const [sym, ts] of newMap) {
      if (now - ts > NEW_BADGE_DURATION_MS) {
        newMap.delete(sym);
      }
    }

    if (newMap.size !== newSymbols.size) {
      setNewSymbols(newMap);
    }
  }, [allStocks]);

  // 30초 타이머로 NEW 배지 만료 체크
  useEffect(() => {
    if (newSymbols.size === 0) return;
    const timer = setInterval(() => {
      const now = Date.now();
      setNewSymbols(prev => {
        const next = new Map(prev);
        for (const [sym, ts] of next) {
          if (now - ts > NEW_BADGE_DURATION_MS) next.delete(sym);
        }
        return next.size !== prev.size ? next : prev;
      });
    }, 5000);
    return () => clearInterval(timer);
  }, [newSymbols.size]);

  const hotStocks = allStocks.filter((s: any) => (s.changePct || s.regularMarketChangePercent || 0) >= 10);
  const surgingStocks = allStocks.filter((s: any) => (s.changePct || s.regularMarketChangePercent || 0) >= 5);
  const pendingStocks = allStocks.filter((s: any) => (s.totalScore || 0) >= 60 && (s.totalScore || 0) < 65);
  const newCount = newSymbols.size;

  return (
    <div className="space-y-4">
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-12px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Target className="w-5 h-5 text-primary" />
          통합 실시간 거래 현황
        </h2>
        <div className="flex items-center gap-2">
          <Badge className="bg-stock-up/20 text-stock-up border-stock-up/30 text-xs">
            <Cloud className="w-3.5 h-3.5 mr-1" />
            Cloud Agent: 전 종목 롤링 스캔 중
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
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold bg-stock-up/20 text-stock-up">
            <div className={`w-2.5 h-2.5 rounded-full ${wsConnected ? 'bg-stock-up animate-pulse' : 'bg-muted-foreground'}`} />
            {wsConnected ? 'LIVE: WebSocket' : 'REST 폴링'}
          </div>
          <Badge variant="outline" className="text-[10px]">보유: {openPositions.length}/15</Badge>
          <Badge variant="outline" className="text-[10px] border-destructive/40 text-destructive">
            <Flame className="w-3 h-3 mr-1" />+10% 급등: {hotStocks.length}개
          </Badge>
          <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">
            <TrendingUp className="w-3 h-3 mr-1" />+5% 이상: {surgingStocks.length}개
          </Badge>
          <Badge variant="outline" className="text-[10px] border-warning/40 text-warning">
            ⏳ 대기(60~64점): {pendingStocks.length}개
          </Badge>
          {newCount > 0 && (
            <Badge className="text-[10px] bg-primary/20 text-primary border-primary/40 animate-pulse gap-0.5">
              <Sparkles className="w-3 h-3" />
              신규 유입: {newCount}개
            </Badge>
          )}
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

      <Card className="border-primary/20">
        <CardContent className="p-3 text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">📊 전 종목 실시간 롤링 스캐너 — NYSE/NASDAQ/AMEX 무제한 순환 스캔 | 신규 수급 유입 즉시 업데이트</p>
          <p>✅ 진입: [합산 ≥ 65점] AND [익절확률 ≥ 85%] → 즉시 매수 | 🔥RVOL 3x 상대적 급등주 실시간 포착</p>
          <p>⚡ 롤링: 1분 주기 전 종목 순환 → 거래대금·점수 급등 신규 종목 즉시 리스트 업데이트 | [NEW] 배지 30초 노출</p>
          <p>💰 교체: 보유 종목보다 익절확률 95%↑ 신규 종목 감지 시 즉시 교체 매매 검토</p>
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
                        isNew={newSymbols.has(stock.symbol)}
                        isReplacementCandidate={stock.totalScore >= 75 && !holdingSymbols.has(stock.symbol)}
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
