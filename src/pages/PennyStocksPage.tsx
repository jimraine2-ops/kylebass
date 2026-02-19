import { useState, useCallback, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePennyStocks, useScalpingPortfolio } from "@/hooks/useStockData";
import { scalpingAnalyze } from "@/lib/api";
import { TrendingUp, TrendingDown, Zap, Bot, Radio, Crown, BarChart3, Power, ShieldCheck, Crosshair, Flame, Eye } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import StockCardItem from "@/components/penny/StockCardItem";
import BriefingFeed from "@/components/penny/BriefingFeed";

export interface BriefingEntry {
  id: number;
  text: string;
  time: string;
  type: 'buy' | 'sell' | 'info';
}

let briefingId = 0;

export default function PennyStocksPage() {
  const { data, isLoading } = usePennyStocks();
  const { data: portfolioData } = useScalpingPortfolio();
  const [autoMode, setAutoMode] = useState(true);
  const [tradingSymbols, setTradingSymbols] = useState<Set<string>>(new Set());
  const [briefings, setBriefings] = useState<BriefingEntry[]>([]);
  const prevSymbolsRef = useRef<Set<string>>(new Set());
  const autoTradeInProgress = useRef<Set<string>>(new Set());

  const stocks = data?.stocks || [];
  const openPositions = portfolioData?.openPositions || [];
  const holdingSymbols = new Set(openPositions.map((p: any) => String(p.symbol)));

  // +20% filter: only these are auto-trade targets
  const hotStocks = stocks.filter((s: any) => (s.regularMarketChangePercent || 0) >= 10);
  const hotSymbols = new Set(hotStocks.map((s: any) => s.symbol));

  const addBriefing = useCallback((text: string, type: BriefingEntry['type']) => {
    const now = new Date();
    const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    setBriefings(prev => [{ id: ++briefingId, text, time, type }, ...prev].slice(0, 50));
  }, []);

  const handleScalpingTrade = useCallback(async (stock: any) => {
    if (autoTradeInProgress.current.has(stock.symbol)) return;
    autoTradeInProgress.current.add(stock.symbol);
    setTradingSymbols(prev => new Set(prev).add(stock.symbol));
    try {
      const result = await scalpingAnalyze(stock.symbol, stock.regularMarketPrice);
      if (result.trade) {
        const priceKRW = Math.round((result.trade.price || 0) * 1350).toLocaleString('ko-KR');
        const msg = `+20% 돌파 확인 - ${stock.symbol} 초단타 자동 매매 개시 (${result.trade.quantity}주 @ ₩${priceKRW})`;
        toast.success(msg);
        addBriefing(msg, 'buy');
      } else if (result.closedTrades?.length > 0) {
        result.closedTrades.forEach((ct: any) => {
          const reason = ct.closeReason || ct.reason;
          if (reason) {
            toast.info(reason);
            addBriefing(reason, 'sell');
          }
        });
      }
    } catch (err: any) {
      if (!err.message?.includes('Rate limit')) {
        toast.error(`매매 오류: ${err.message}`);
      }
    } finally {
      setTradingSymbols(prev => {
        const next = new Set(prev);
        next.delete(stock.symbol);
        return next;
      });
      autoTradeInProgress.current.delete(stock.symbol);
    }
  }, [addBriefing]);

  // Auto-scan: only trade +20% stocks
  useEffect(() => {
    if (!autoMode || hotStocks.length === 0) return;

    const currentHot: Set<string> = new Set(hotStocks.map((s: any) => String(s.symbol)));
    const prevSymbols = prevSymbolsRef.current;

    const newEntries = hotStocks.filter((s: any) => !prevSymbols.has(s.symbol));
    prevSymbolsRef.current = currentHot;

    const toTrade = prevSymbols.size === 0 ? hotStocks : newEntries;

    if (newEntries.length > 0 && prevSymbols.size > 0) {
      addBriefing(`🔥 +10% 돌파 종목 감지: ${newEntries.map((s: any) => `$${s.symbol}(+${s.regularMarketChangePercent?.toFixed(1)}%)`).join(', ')}`, 'info');
    }

    for (const stock of toTrade) {
      if (!autoTradeInProgress.current.has(stock.symbol)) {
        handleScalpingTrade(stock);
      }
    }
  }, [hotStocks, autoMode, handleScalpingTrade, addBriefing]);

  // Re-check exit conditions every 30s for held positions
  useEffect(() => {
    if (!autoMode || stocks.length === 0) return;
    const interval = setInterval(() => {
      for (const stock of stocks) {
        if (holdingSymbols.has(stock.symbol) && !autoTradeInProgress.current.has(stock.symbol)) {
          handleScalpingTrade(stock);
        }
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [stocks, autoMode, handleScalpingTrade]);

  const isTrading = tradingSymbols.size > 0;

  return (
    <div className="space-y-4">
      {/* Strategy Banner */}
      <div className="rounded-lg p-2 border border-destructive/40 bg-destructive/5 flex items-center justify-center gap-2">
        <Flame className="w-4 h-4 text-destructive" />
        <span className="text-xs font-bold text-destructive">소형주 실시간 거래 현황</span>
        <span className="text-[10px] text-muted-foreground">| ₩13,500 미만 TOP 50 실시간 모니터링 | +10% 이상만 자동 매매</span>
      </div>

      {/* AI Agent Status Bar */}
      <div className={`rounded-lg p-3 flex items-center justify-between flex-wrap gap-2 border ${autoMode ? 'border-primary/50 bg-primary/5' : 'border-border bg-muted/30'}`}>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold ${autoMode ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
            <div className={`w-2.5 h-2.5 rounded-full ${autoMode ? 'bg-primary animate-pulse' : 'bg-muted-foreground'}`} />
            {autoMode ? 'AI AGENT: ACTIVE & TRADING' : 'AI AGENT: STANDBY'}
          </div>
          {isTrading && (
            <Badge variant="outline" className="text-[10px] border-warning/50 text-warning animate-pulse">
              <Crosshair className="w-3 h-3 mr-1" />
              {tradingSymbols.size}개 종목 분석중
            </Badge>
          )}
          <Badge variant="outline" className="text-[10px]">
            <ShieldCheck className="w-3 h-3 mr-1" />
            보유: {openPositions.length}/10
          </Badge>
          <Badge variant="outline" className="text-[10px] border-destructive/40 text-destructive">
            <Flame className="w-3 h-3 mr-1" />
            +10% 타겟: {hotStocks.length}개
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs font-mono">
            <Radio className="w-3 h-3 mr-1" />
            30초 스캔
          </Badge>
          <Button
            size="sm"
            variant={autoMode ? "default" : "outline"}
            className="text-xs h-7"
            onClick={() => {
              setAutoMode(!autoMode);
              addBriefing(autoMode ? 'AI 자동매매 모드 OFF' : 'AI 자동매매 모드 ON - +20% 급등주 자율 거래 시작', 'info');
            }}
          >
            <Power className="w-3 h-3 mr-1" />
            {autoMode ? 'Full-Auto ON' : 'Full-Auto OFF'}
          </Button>
        </div>
      </div>

      {/* Live Briefing Feed */}
      <BriefingFeed briefings={briefings} />

      {/* Info Card */}
      <Card className="border-primary/30">
        <CardContent className="p-3 text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">🤖 Full-Auto +20% Surge Trading System</p>
          <p>• 100+ 종목 스캔 → <span className="text-primary font-medium">TOP 50 실시간 표시</span> → <span className="text-destructive font-medium">+10% 이상만 자동 매수</span></p>
          <p>• 청산: 2~3%→50% 익절 | ATR×1.5 추격 손절 | -2% 즉시 손절 | 15분 타임컷 | 장마감 강제 청산</p>
          <p>• 최대 동시 보유: 10종목 | 종목당 지갑의 10% 배분</p>
        </CardContent>
      </Card>

      {/* Stock Grid - TOP 50 */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-2">
          {Array.from({ length: 20 }).map((_, i) => <Skeleton key={i} className="h-36" />)}
        </div>
      ) : stocks.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            ₩13,500 미만 종목을 스캔 중입니다. 잠시 후 다시 확인해주세요.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-2">
          {stocks.map((stock: any, idx: number) => (
            <StockCardItem
              key={stock.symbol}
              stock={stock}
              rank={idx + 1}
              isHot={hotSymbols.has(stock.symbol)}
              isTrading={tradingSymbols.has(stock.symbol)}
              isHolding={holdingSymbols.has(stock.symbol)}
              autoMode={autoMode}
              onManualTrade={() => handleScalpingTrade(stock)}
            />
          ))}
        </div>
      )}

      {/* Scanned Info */}
      {data?.allScanned && (
        <p className="text-xs text-muted-foreground text-center">
          총 {data.allScanned}개 종목 스캔 → 상위 {stocks.length}개 모니터링 | 🔥 +20% 급등 {hotStocks.length}개 타겟 {autoMode && '| 🤖 AI Full-Auto 활성'}
        </p>
      )}
    </div>
  );
}
