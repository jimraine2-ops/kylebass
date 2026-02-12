import { useState, useCallback, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePennyStocks, useScalpingPortfolio } from "@/hooks/useStockData";
import { scalpingAnalyze } from "@/lib/api";
import { TrendingUp, TrendingDown, Activity, Zap, Bot, Radio, Crown, BarChart3, Power, ShieldCheck, Crosshair } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

interface BriefingEntry {
  id: number;
  text: string;
  time: string;
  type: 'buy' | 'sell' | 'info';
}

let briefingId = 0;

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
  const { data: portfolioData } = useScalpingPortfolio();
  const [autoMode, setAutoMode] = useState(true);
  const [tradingSymbols, setTradingSymbols] = useState<Set<string>>(new Set());
  const [briefings, setBriefings] = useState<BriefingEntry[]>([]);
  const prevSymbolsRef = useRef<Set<string>>(new Set());
  const autoTradeInProgress = useRef<Set<string>>(new Set());

  const stocks = data?.stocks || [];
  const openPositions = portfolioData?.openPositions || [];
  const holdingSymbols = new Set(openPositions.map((p: any) => String(p.symbol)));

  const addBriefing = useCallback((text: string, type: BriefingEntry['type']) => {
    const now = new Date();
    const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    setBriefings(prev => [{ id: ++briefingId, text, time, type }, ...prev].slice(0, 30));
  }, []);

  const handleScalpingTrade = useCallback(async (stock: any) => {
    if (autoTradeInProgress.current.has(stock.symbol)) return;
    autoTradeInProgress.current.add(stock.symbol);
    setTradingSymbols(prev => new Set(prev).add(stock.symbol));
    try {
      const result = await scalpingAnalyze(stock.symbol, stock.regularMarketPrice);
      if (result.trade) {
        const msg = `AI가 $${stock.symbol} 종목에서 강한 수급을 발견하여 0.2초 만에 매수를 완료했습니다 (${result.trade.quantity}주 @ $${result.trade.price})`;
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
      } else if (result.decision?.action === 'HOLD' && result.decision?.reason) {
        // Silent in auto mode - no spam
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

  // Auto-scan loop: instantly trade new stocks appearing in TOP 10
  useEffect(() => {
    if (!autoMode || stocks.length === 0) return;

    const currentSymbols: Set<string> = new Set(stocks.map((s: any) => String(s.symbol)));
    const prevSymbols = prevSymbolsRef.current;

    const newEntries = stocks.filter((s: any) => !prevSymbols.has(s.symbol));
    prevSymbolsRef.current = currentSymbols;

    const toTrade = prevSymbols.size === 0 ? stocks : newEntries;

    if (newEntries.length > 0 && prevSymbols.size > 0) {
      addBriefing(`TOP 10 리스트 변동 감지: ${newEntries.map((s: any) => s.symbol).join(', ')} 신규 진입`, 'info');
    }

    for (const stock of toTrade) {
      if (!autoTradeInProgress.current.has(stock.symbol)) {
        handleScalpingTrade(stock);
      }
    }
  }, [stocks, autoMode, handleScalpingTrade, addBriefing]);

  // Periodically re-check existing positions (exit logic) every 30s
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

  const isTrading = tradingSymbols.size > 0;

  return (
    <div className="space-y-4">
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
              addBriefing(autoMode ? 'AI 자동매매 모드 OFF' : 'AI 자동매매 모드 ON - 전종목 자율 거래 시작', 'info');
            }}
          >
            <Power className="w-3 h-3 mr-1" />
            {autoMode ? 'Full-Auto ON' : 'Full-Auto OFF'}
          </Button>
        </div>
      </div>

      {/* Live Briefing Feed */}
      {briefings.length > 0 && (
        <Card className="border-primary/20">
          <CardContent className="p-0">
            <ScrollArea className="h-[100px]">
              <div className="p-3 space-y-1">
                {briefings.map(b => (
                  <div key={b.id} className="flex items-start gap-2 text-[11px] animate-in fade-in-0 slide-in-from-top-1 duration-300">
                    <span className="text-muted-foreground font-mono shrink-0">{b.time}</span>
                    <span className={`${b.type === 'buy' ? 'text-primary font-medium' : b.type === 'sell' ? 'text-warning font-medium' : 'text-muted-foreground'}`}>
                      {b.type === 'buy' ? '🟢' : b.type === 'sell' ? '🔴' : '📡'} {b.text}
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Info Card */}
      <Card className="border-primary/30">
        <CardContent className="p-3 text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">🤖 Full-Auto Direct Trading System</p>
          <p>• AI 에이전트가 TOP 10 리스트를 감시하여 <span className="text-primary font-medium">신규 종목 포착 즉시 자동 매수</span></p>
          <p>• 청산: 2~3%→50% 익절 | ATR×2 추격 손절 | -2% 즉시 손절 | 15분 타임컷 | 장마감 강제 청산</p>
          <p>• 최대 동시 보유: 10종목 | 종목당 지갑의 10% 배분</p>
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
            const isCurrentlyTrading = tradingSymbols.has(stock.symbol);
            const isHolding = holdingSymbols.has(stock.symbol);
            
            // Glow effect classes
            const glowClass = isCurrentlyTrading
              ? 'border-warning/60 shadow-[0_0_15px_rgba(234,179,8,0.3)] ring-1 ring-warning/30'
              : isHolding
              ? 'border-primary/50 shadow-[0_0_10px_rgba(var(--primary),0.2)] ring-1 ring-primary/20'
              : 'hover:border-primary/40';

            return (
              <Card key={stock.symbol} className={`relative overflow-hidden transition-all duration-500 ease-in-out hover:shadow-md group animate-in fade-in-0 slide-in-from-bottom-2 ${glowClass}`}>
                {/* Trading indicator overlay */}
                {isCurrentlyTrading && (
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-warning via-primary to-warning animate-pulse" />
                )}
                {isHolding && !isCurrentlyTrading && (
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary/60" />
                )}

                <CardContent className="p-4 space-y-2">
                  {/* Rank + Symbol + Status */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <RankBadge rank={rank} />
                      <Link to={`/stock/${stock.symbol}`} className="font-bold text-sm hover:text-primary transition-colors">
                        {stock.symbol}
                      </Link>
                    </div>
                    <div className="flex items-center gap-1">
                      {isCurrentlyTrading && (
                        <Badge className="text-[8px] px-1 py-0 bg-warning/20 text-warning border-warning/30 animate-pulse">
                          <Bot className="w-2.5 h-2.5 mr-0.5" />
                          매매중
                        </Badge>
                      )}
                      {isHolding && !isCurrentlyTrading && (
                        <Badge className="text-[8px] px-1 py-0 bg-primary/20 text-primary border-primary/30">
                          보유중
                        </Badge>
                      )}
                      {stock.isVolumeSurge && (
                        <Badge variant="destructive" className="text-[9px] px-1 py-0">
                          <Zap className="w-2.5 h-2.5 mr-0.5" />
                          급등
                        </Badge>
                      )}
                    </div>
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

                  {/* Auto mode: status indicator instead of button */}
                  {autoMode ? (
                    <div className="w-full text-center text-[10px] h-7 mt-1 flex items-center justify-center rounded-md border border-border/50 bg-muted/30 text-muted-foreground">
                      <Bot className="w-3 h-3 mr-1" />
                      {isCurrentlyTrading ? '🔄 AI 분석 실행중...' : isHolding ? '✅ AI 자동 관리중' : '⏳ AI 감시중'}
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full text-[10px] h-7 mt-1"
                      onClick={() => handleScalpingTrade(stock)}
                      disabled={tradingSymbols.has(stock.symbol)}
                    >
                      <Bot className="w-3 h-3 mr-1" />
                      {tradingSymbols.has(stock.symbol) ? '분석중...' : '수동 매매'}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Scanned Info */}
      {data?.allScanned && (
        <p className="text-xs text-muted-foreground text-center">
          총 {data.allScanned}개 종목 스캔 → 상위 {stocks.length}개 타겟팅 중 {autoMode && '| 🤖 AI Full-Auto 모드 활성'}
        </p>
      )}
    </div>
  );
}
