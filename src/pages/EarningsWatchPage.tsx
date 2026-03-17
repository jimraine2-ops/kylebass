import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CalendarDays, TrendingUp, Flame, Target, RefreshCw, Clock, ArrowUp, ArrowDown } from "lucide-react";

function useEarningsWatch() {
  return useQuery({
    queryKey: ['earnings-watch'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('earnings-watch');
      if (error) throw error;
      return data;
    },
    refetchInterval: 60 * 60 * 1000, // 1시간마다
    staleTime: 30 * 60 * 1000,
  });
}

function getHourLabel(hour: string) {
  if (hour === 'bmo') return '장전';
  if (hour === 'amc') return '장후';
  return '미정';
}

function getHourColor(hour: string) {
  if (hour === 'bmo') return 'text-primary border-primary/30';
  if (hour === 'amc') return 'text-warning border-warning/30';
  return 'text-muted-foreground';
}

export default function EarningsWatchPage() {
  const { data, isLoading, refetch, isFetching } = useEarningsWatch();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const stocks = data?.stocks || [];
  const dates = useMemo(() => {
    const d = new Set<string>();
    stocks.forEach((s: any) => d.add(s.date));
    return Array.from(d).sort();
  }, [stocks]);

  const filtered = useMemo(() => {
    if (!selectedDate) return stocks;
    return stocks.filter((s: any) => s.date === selectedDate);
  }, [stocks, selectedDate]);

  const preBuyCandidates = filtered.filter((s: any) => s.isPreBuy);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-primary" />
          실적 임박 필승주
        </h2>
        <div className="flex items-center gap-2">
          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs">
            📊 전 종목 실적 스캔
          </Badge>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isFetching ? 'animate-spin' : ''}`} />
            새로고침
          </Button>
        </div>
      </div>

      {/* Strategy Card */}
      <Card className="border-yellow-500/30 bg-yellow-500/5">
        <CardContent className="p-3 text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-yellow-400">🏆 실적 발표 임박 — 필승 패턴 감지 시 즉시 선취매</p>
          <p>✅ 타겟: [실적 발표 48시간 이내] 전 종목 → 실적 기대감 폭발 선점</p>
          <p>🎯 패턴 A/B/C 감지 + 65점↑ + 익절확률 90%↑ → 거래량 무관 즉시 매수</p>
          <p>🚨 실적주 필승 패턴 포착 시 "실적주 폭발 전조" 알림 | ⏰ 1시간 단위 스캔</p>
        </CardContent>
      </Card>

      {/* Stats Row */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className="text-[10px]">
          <CalendarDays className="w-3 h-3 mr-1" />
          전체: {stocks.length}개
        </Badge>
        <Badge variant="outline" className="text-[10px] border-yellow-500/40 text-yellow-400">
          <Target className="w-3 h-3 mr-1" />
          선취매 대상: {preBuyCandidates.length}개
        </Badge>
        {dates.map(d => (
          <Badge
            key={d}
            variant={selectedDate === d ? 'default' : 'outline'}
            className="text-[10px] cursor-pointer"
            onClick={() => setSelectedDate(selectedDate === d ? null : d)}
          >
            {d}
          </Badge>
        ))}
        {selectedDate && (
          <Badge variant="outline" className="text-[10px] cursor-pointer" onClick={() => setSelectedDate(null)}>
            전체 보기
          </Badge>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <CalendarDays className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>실적 발표 예정 종목이 없습니다.</p>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="h-[calc(100vh-380px)] min-h-[400px]">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pr-3">
            {filtered.map((stock: any) => (
              <EarningsCard key={stock.symbol} stock={stock} />
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

function EarningsCard({ stock }: { stock: any }) {
  const isPositive = stock.changePct >= 0;
  const scoreColor = stock.quantScore >= 70 ? 'text-yellow-400' : stock.quantScore >= 60 ? 'text-stock-up' : stock.quantScore >= 50 ? 'text-primary' : 'text-muted-foreground';
  const scoreBg = stock.quantScore >= 70 ? 'bg-yellow-500/20 border-yellow-500/50' : stock.quantScore >= 60 ? 'bg-stock-up/10 border-stock-up/30' : 'bg-muted/50 border-border';

  return (
    <Card className={`transition-all hover:shadow-md ${stock.isPreBuy ? 'border-yellow-500/50 shadow-[0_0_12px_rgba(234,179,8,0.15)]' : ''}`}>
      <CardContent className="p-3 space-y-2">
        {/* Top row: Symbol + Date */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm">{stock.symbol}</span>
            {stock.isPreBuy && (
              <Badge className="text-[9px] px-1.5 py-0 bg-yellow-500/20 text-yellow-400 border-yellow-500/50 font-bold">
                🎯 선취매
              </Badge>
            )}
            {stock.isHot && (
              <Badge variant="outline" className="text-[9px] px-1 py-0 border-destructive/40 text-destructive">
                <Flame className="w-2.5 h-2.5 mr-0.5" />HOT
              </Badge>
            )}
          </div>
          <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${getHourColor(stock.hour)}`}>
            <Clock className="w-2.5 h-2.5 mr-0.5" />
            {stock.date} {getHourLabel(stock.hour)}
          </Badge>
        </div>

        {/* Price row */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-lg font-bold font-mono">₩{stock.priceKRW?.toLocaleString('ko-KR')}</p>
            <p className="text-[10px] text-muted-foreground font-mono">${stock.price?.toFixed(2)}</p>
          </div>
          <div className={`text-right ${isPositive ? 'text-stock-up' : 'text-stock-down'}`}>
            <div className="flex items-center gap-0.5 text-sm font-bold font-mono">
              {isPositive ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />}
              {isPositive ? '+' : ''}{stock.changePct}%
            </div>
          </div>
        </div>

        {/* Score + Win Prob */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className={`text-[10px] font-mono font-bold ${scoreBg} ${scoreColor}`}>
            {stock.quantScore >= 70 ? '🏆' : ''} AI {stock.quantScore}점
          </Badge>
          <Badge variant="outline" className={`text-[10px] font-mono ${stock.winProb >= 88 ? 'border-yellow-500/50 text-yellow-400 bg-yellow-500/10' : stock.winProb >= 70 ? 'border-stock-up/40 text-stock-up' : 'border-muted'}`}>
            {stock.winProb >= 88 ? '🏆' : '📊'} 익절 {stock.winProb}%
          </Badge>
        </div>

        {/* Earnings estimate */}
        {(stock.epsEstimate != null || stock.revenueEstimate != null) && (
          <div className="text-[10px] text-muted-foreground border-t border-border/50 pt-1.5 space-y-0.5">
            {stock.epsEstimate != null && (
              <p>📈 EPS 예상: <span className="font-mono font-medium text-foreground">${stock.epsEstimate}</span>
                {stock.epsActual != null && <span className="ml-1">→ 실적: <span className={stock.epsActual >= stock.epsEstimate ? 'text-stock-up' : 'text-stock-down'}>${stock.epsActual}</span></span>}
              </p>
            )}
            {stock.revenueEstimate != null && (
              <p>💰 매출 예상: <span className="font-mono font-medium text-foreground">${(stock.revenueEstimate / 1e6).toFixed(1)}M</span></p>
            )}
            {stock.quarter && <p>📅 {stock.year} Q{stock.quarter}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
