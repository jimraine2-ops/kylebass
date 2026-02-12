import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePennyStocks, useRealtimeStockQuotes } from "@/hooks/useStockData";
import { aiAnalyzeAndTrade } from "@/lib/api";
import { TrendingUp, TrendingDown, Activity, Zap, Filter, Bot, Radio } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

// Track previous prices for flash animation
function usePriceFlash(currentPrice: number | undefined, symbol: string) {
  const prevPrice = useRef<number | undefined>(undefined);
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);

  useEffect(() => {
    if (currentPrice !== undefined && prevPrice.current !== undefined) {
      if (currentPrice > prevPrice.current) {
        setFlash('up');
      } else if (currentPrice < prevPrice.current) {
        setFlash('down');
      }
      const timer = setTimeout(() => setFlash(null), 600);
      return () => clearTimeout(timer);
    }
    prevPrice.current = currentPrice;
  }, [currentPrice, symbol]);

  useEffect(() => {
    prevPrice.current = currentPrice;
  }, [currentPrice]);

  return flash;
}

function PriceCell({ stock }: { stock: any }) {
  const flash = usePriceFlash(stock.regularMarketPrice, stock.symbol);
  const isUp = (stock.regularMarketChange || 0) >= 0;

  return (
    <Link
      to={`/stock/${stock.symbol}`}
      className={`block rounded-lg border border-border p-4 hover:border-primary/40 transition-all hover:shadow-sm relative overflow-hidden ${
        flash === 'up' ? 'animate-flash-green' : flash === 'down' ? 'animate-flash-red' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-bold text-sm">{stock.symbol}</span>
        <div className="flex items-center gap-1">
          {stock.isVolumeSurge && (
            <Badge variant="destructive" className="text-[9px] px-1 py-0">
              <Zap className="w-2.5 h-2.5 mr-0.5" />
              거래량↑
            </Badge>
          )}
          <Badge variant="outline" className="text-[10px]">
            {stock.shortName?.slice(0, 12) || stock.symbol}
          </Badge>
        </div>
      </div>
      <p className={`text-2xl font-bold font-mono ${flash === 'up' ? 'stock-up' : flash === 'down' ? 'stock-down' : ''}`}>
        ${stock.regularMarketPrice?.toFixed(4)}
      </p>
      <div className={`flex items-center gap-1 mt-1 ${isUp ? 'stock-up' : 'stock-down'}`}>
        {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
        <span className="text-xs font-mono">
          {isUp ? '+' : ''}{stock.regularMarketChange?.toFixed(4)} ({isUp ? '+' : ''}{stock.regularMarketChangePercent?.toFixed(2)}%)
        </span>
      </div>
      {stock.volumeSurge > 0 && (
        <div className="text-[10px] text-muted-foreground mt-1 font-mono">
          Vol: {(stock.regularMarketVolume || 0).toLocaleString()} ({stock.volumeSurge?.toFixed(1)}x avg)
        </div>
      )}
    </Link>
  );
}

export default function PennyStocksPage() {
  const [minPrice, setMinPrice] = useState(0.7);
  const [maxPrice, setMaxPrice] = useState(1.5);
  const { data, isLoading } = usePennyStocks(minPrice, maxPrice);
  const [tradingSymbol, setTradingSymbol] = useState<string | null>(null);

  const stocks = data?.stocks || [];

  // Realtime quotes for filtered penny stocks (3s refresh)
  const pennySymbols = stocks.slice(0, 20).map((s: any) => s.symbol);
  const { data: realtimeQuotes } = useRealtimeStockQuotes(pennySymbols, pennySymbols.length > 0);

  // Merge realtime prices into stocks
  const mergedStocks = stocks.map((s: any) => {
    const rt = realtimeQuotes?.find((q: any) => q.symbol === s.symbol);
    return rt ? { ...s, ...rt, volumeSurge: s.volumeSurge, isVolumeSurge: s.isVolumeSurge } : s;
  });

  const handleAITrade = useCallback(async (stock: any) => {
    setTradingSymbol(stock.symbol);
    try {
      const result = await aiAnalyzeAndTrade(stock.symbol, stock.regularMarketPrice);
      if (result.trade) {
        toast.success(`AI가 ${stock.symbol} ${result.trade.quantity}주를 $${result.trade.price}에 매수했습니다!`);
      } else {
        toast.info(`AI 판단: ${result.decision?.action} (신뢰도: ${result.decision?.confidence}%) - ${result.decision?.reason}`);
      }
    } catch (err: any) {
      toast.error(`AI 거래 오류: ${err.message}`);
    } finally {
      setTradingSymbol(null);
    }
  }, []);

  return (
    <div className="space-y-6">
      {/* Live Indicator */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          소형주 실시간 스크리너
        </h2>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-stock-up animate-pulse" />
            <span className="text-xs text-muted-foreground">실시간 업데이트 중</span>
          </div>
          <Badge variant="outline" className="font-mono text-xs">
            <Radio className="w-3 h-3 mr-1" />
            3초 갱신
          </Badge>
        </div>
      </div>

      {/* Filter Controls */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Filter className="w-4 h-4" />
            가격 필터
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground">최소가:</label>
              <input
                type="number"
                step="0.1"
                value={minPrice}
                onChange={(e) => setMinPrice(+e.target.value)}
                className="w-20 px-2 py-1 rounded bg-muted border border-border text-sm font-mono"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground">최대가:</label>
              <input
                type="number"
                step="0.1"
                value={maxPrice}
                onChange={(e) => setMaxPrice(+e.target.value)}
                className="w-20 px-2 py-1 rounded bg-muted border border-border text-sm font-mono"
              />
            </div>
            <Badge variant="secondary">{stocks.length}개 종목 발견</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Stock Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : mergedStocks.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            해당 가격 범위에 종목이 없습니다. 필터를 조정해보세요.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {mergedStocks.map((stock: any) => (
            <div key={stock.symbol} className="relative">
              <PriceCell stock={stock} />
              <Button
                size="sm"
                variant="outline"
                className="absolute top-2 right-2 text-[10px] h-6 px-2"
                onClick={(e) => {
                  e.preventDefault();
                  handleAITrade(stock);
                }}
                disabled={tradingSymbol === stock.symbol}
              >
                <Bot className="w-3 h-3 mr-1" />
                {tradingSymbol === stock.symbol ? '분석중...' : 'AI 거래'}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
