import { useState, useCallback, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePennyStocks } from "@/hooks/useStockData";
import { scalpingAnalyze } from "@/lib/api";
import { TrendingUp, TrendingDown, Activity, Zap, Bot, Radio, Crown, BarChart3, Power } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

function RankBadge({ rank }: { rank: number }) {
  const colors = rank <= 3
    ? "bg-warning/20 text-warning border-warning/30"
    : "bg-muted text-muted-foreground border-border";
  return (
    <Badge variant="outline" className={`text-[10px] font-bold ${colors}`}>
      {rank <= 3 && <Crown className="w-2.5 h-2.5 mr-0.5" />}
      #{rank}
    </Badge>
  );
}

function VolumeBar({ surge }: { surge: number }) {
  const pct = Math.min(surge * 20, 100);
  return (
    <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden mt-1">
      <div
        className="h-full rounded-full bg-primary transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default function PennyStocksPage() {
  const { data, isLoading } = usePennyStocks();
  const [tradingSymbol, setTradingSymbol] = useState<string | null>(null);
  const [autoMode, setAutoMode] = useState(true);
  const prevSymbolsRef = useRef<Set<string>>(new Set());
  const autoTradeInProgress = useRef<Set<string>>(new Set());

  const stocks = data?.stocks || [];

  const handleScalpingTrade = useCallback(async (stock: any) => {
    if (autoTradeInProgress.current.has(stock.symbol)) return;
    autoTradeInProgress.current.add(stock.symbol);
    setTradingSymbol(stock.symbol);
    try {
      const result = await scalpingAnalyze(stock.symbol, stock.regularMarketPrice);
      if (result.trade) {
        toast.success(`TOP 10 신규 포착: [${stock.symbol}] 즉시 매수 집행 (${result.trade.quantity}주 @ $${result.trade.price})`);
      } else if (result.closedTrades?.length > 0) {
        result.closedTrades.forEach((ct: any) => {
          if (ct.closeReason || ct.reason) {
            toast.info(ct.closeReason || ct.reason);
          }
        });
      }
    } catch (err: any) {
      if (!err.message?.includes('Rate limit')) {
        toast.error(`매매 오류: ${err.message}`);
      }
    } finally {
      setTradingSymbol(null);
      autoTradeInProgress.current.delete(stock.symbol);
    }
  }, []);

  // Auto-scan loop: instantly trade new stocks appearing in TOP 10
  useEffect(() => {
    if (!autoMode || stocks.length === 0) return;

    const currentSymbols: Set<string> = new Set(stocks.map((s: any) => String(s.symbol)));
    const prevSymbols = prevSymbolsRef.current;

    // Find newly entered stocks
    const newEntries = stocks.filter((s: any) => !prevSymbols.has(s.symbol));

    // Update ref
    prevSymbolsRef.current = currentSymbols;

    // If this is the first load (prevSymbols was empty), trade all stocks
    const toTrade = prevSymbols.size === 0 ? stocks : newEntries;

    // Execute instant trades for new entries
    for (const stock of toTrade) {
      if (!autoTradeInProgress.current.has(stock.symbol)) {
        handleScalpingTrade(stock);
      }
    }
  }, [stocks, autoMode, handleScalpingTrade]);

  // Also periodically re-check existing positions (exit logic) every 30s
  useEffect(() => {
    if (!autoMode || stocks.length === 0) return;
    const interval = setInterval(() => {
      for (const stock of stocks) {
        if (!autoTradeInProgress.current.has(stock.symbol)) {
          handleScalpingTrade(stock);
        }
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [stocks, autoMode, handleScalpingTrade]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          Under $10 TOP 10
        </h2>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={autoMode ? "default" : "outline"}
            className="text-xs h-7"
            onClick={() => setAutoMode(!autoMode)}
          >
            <Power className="w-3 h-3 mr-1" />
            {autoMode ? '자동매매 ON' : '자동매매 OFF'}
          </Button>
          <Badge variant="outline" className="text-xs font-mono">
            <Radio className="w-3 h-3 mr-1" />
            30초 갱신
          </Badge>
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${autoMode ? 'bg-stock-up animate-pulse' : 'bg-muted-foreground'}`} />
            <span className="text-xs text-muted-foreground">{autoMode ? '자동매매 실행중' : '수동모드'}</span>
          </div>
        </div>
      </div>

      {/* Info Card */}
      <Card className="border-primary/30">
        <CardContent className="p-3 text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">🎯 Under $10 TOP 10 즉시 실행 시스템</p>
          <p>• TOP 10 리스트에 <span className="text-primary font-medium">진입 즉시 자동 매수</span> (점수 필터 없음, 실행 속도 우선)</p>
          <p>• 청산: <span className="text-primary font-medium">2~3% 도달 → 50% 익절</span> | 잔여 물량 → ATR×2 추격 손절</p>
          <p>• 손절: -2% 즉시 전량 매도 | 15분 타임컷 | 장 마감 30분 전 강제 청산</p>
          <p>• 종목당 전용 지갑(₩1,000,000)의 10% 배분</p>
        </CardContent>
      </Card>

      {/* Stock Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-40" />)}
        </div>
      ) : stocks.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            $10 미만 종목을 스캔 중입니다. 잠시 후 다시 확인해주세요.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {stocks.map((stock: any, idx: number) => {
            const isUp = (stock.regularMarketChange || 0) >= 0;
            const rank = idx + 1;
            return (
              <Card key={stock.symbol} className="relative overflow-hidden hover:border-primary/40 transition-all duration-500 ease-in-out hover:shadow-md group animate-in fade-in-0 slide-in-from-bottom-2">
                <CardContent className="p-4 space-y-2">
                  {/* Rank + Symbol */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <RankBadge rank={rank} />
                      <Link to={`/stock/${stock.symbol}`} className="font-bold text-sm hover:text-primary transition-colors">
                        {stock.symbol}
                      </Link>
                    </div>
                    {stock.isVolumeSurge && (
                      <Badge variant="destructive" className="text-[9px] px-1 py-0">
                        <Zap className="w-2.5 h-2.5 mr-0.5" />
                        급등
                      </Badge>
                    )}
                  </div>

                  {/* Price */}
                  <p className="text-2xl font-bold font-mono">
                    ${stock.regularMarketPrice?.toFixed(4)}
                  </p>

                  {/* Change */}
                  <div className={`flex items-center gap-1 ${isUp ? 'stock-up' : 'stock-down'}`}>
                    {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    <span className="text-xs font-mono">
                      {isUp ? '+' : ''}{stock.regularMarketChangePercent?.toFixed(2)}%
                    </span>
                  </div>

                  {/* Volume Strength */}
                  <div className="space-y-0.5">
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <BarChart3 className="w-2.5 h-2.5" />
                        거래량 강도
                      </span>
                      <span className="font-mono">{stock.volumeSurge?.toFixed(1)}x</span>
                    </div>
                    <VolumeBar surge={stock.volumeSurge || 0} />
                  </div>

                  {/* Composite Score */}
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground">복합점수</span>
                    <Badge variant="secondary" className="text-[10px] font-mono">
                      {stock.compositeScore || 0}점
                    </Badge>
                  </div>

                  {/* AI Trade Button */}
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-[10px] h-7 mt-1"
                    onClick={() => handleScalpingTrade(stock)}
                    disabled={tradingSymbol === stock.symbol}
                  >
                    <Bot className="w-3 h-3 mr-1" />
                    {tradingSymbol === stock.symbol ? '분석중...' : 'AI 즉시 매매'}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Scanned Info */}
      {data?.allScanned && (
        <p className="text-xs text-muted-foreground text-center">
          총 {data.allScanned}개 종목 스캔 → 상위 {stocks.length}개 타겟팅 중 {autoMode && '(자동매매 활성)'}
        </p>
      )}
    </div>
  );
}
