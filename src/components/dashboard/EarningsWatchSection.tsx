import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarDays, Flame, Target, RefreshCw, Clock, ArrowUp, ArrowDown } from "lucide-react";

function useEarningsWatch() {
  return useQuery({
    queryKey: ['earnings-watch'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('earnings-watch');
      if (error) throw error;
      return data;
    },
    refetchInterval: 5 * 60 * 1000,
    staleTime: 2 * 60 * 1000,
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

export function EarningsWatchSection() {
  const { data, isLoading, refetch, isFetching } = useEarningsWatch();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

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
  const displayStocks = showAll ? filtered : filtered.slice(0, 6);

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-[10px]">
          📊 전 종목 실적 스캔
        </Badge>
        <Badge variant="outline" className="text-[10px]">
          <CalendarDays className="w-3 h-3 mr-1" />
          전체: {stocks.length}개
        </Badge>
        <Badge variant="outline" className="text-[10px] border-yellow-500/40 text-yellow-400">
          <Target className="w-3 h-3 mr-1" />
          선취매: {preBuyCandidates.length}개
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
        <Button variant="ghost" size="sm" className="h-6 text-[10px] ml-auto" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`w-3 h-3 mr-1 ${isFetching ? 'animate-spin' : ''}`} />
          새로고침
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground text-sm">
            <CalendarDays className="w-6 h-6 mx-auto mb-2 opacity-50" />
            실적 발표 예정 종목이 없습니다.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {displayStocks.map((stock: any) => (
              <EarningsCardCompact key={stock.symbol} stock={stock} />
            ))}
          </div>
          {filtered.length > 6 && (
            <div className="text-center">
              <Button variant="outline" size="sm" className="text-xs" onClick={() => setShowAll(!showAll)}>
                {showAll ? '접기' : `전체 ${filtered.length}개 보기`}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function EarningsCardCompact({ stock }: { stock: any }) {
  const isPositive = stock.changePct >= 0;
  const scoreColor = stock.quantScore >= 70 ? 'text-yellow-400' : stock.quantScore >= 60 ? 'text-stock-up' : stock.quantScore >= 50 ? 'text-primary' : 'text-muted-foreground';

  return (
    <Card className={`transition-all hover:shadow-md ${stock.isPreBuy ? 'border-yellow-500/50 shadow-[0_0_8px_rgba(234,179,8,0.12)]' : ''}`}>
      <CardContent className="p-3 space-y-1.5">
        {/* Row 1: Symbol + schedule */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-sm">{stock.symbol}</span>
            {stock.isPreBuy && (
              <Badge className="text-[8px] px-1 py-0 bg-yellow-500/20 text-yellow-400 border-yellow-500/50 font-bold">
                🎯 선취매
              </Badge>
            )}
            {stock.isHot && (
              <Badge variant="outline" className="text-[8px] px-1 py-0 border-destructive/40 text-destructive">
                <Flame className="w-2.5 h-2.5" />
              </Badge>
            )}
          </div>
          <Badge variant="outline" className={`text-[8px] px-1 py-0 ${getHourColor(stock.hour)}`}>
            <Clock className="w-2.5 h-2.5 mr-0.5" />
            {stock.date} {getHourLabel(stock.hour)}
          </Badge>
        </div>

        {/* Row 2: Price + change */}
        <div className="flex items-center justify-between">
          <div>
            <span className="text-base font-bold font-mono">₩{stock.priceKRW?.toLocaleString('ko-KR')}</span>
            <span className="text-[10px] text-muted-foreground font-mono ml-1.5">${stock.price?.toFixed(2)}</span>
          </div>
          <span className={`flex items-center gap-0.5 text-xs font-bold font-mono ${isPositive ? 'text-stock-up' : 'text-stock-down'}`}>
            {isPositive ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
            {isPositive ? '+' : ''}{stock.changePct}%
          </span>
        </div>

        {/* Row 3: Score badges */}
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className={`text-[9px] font-mono font-bold ${scoreColor}`}>
            AI {stock.quantScore}점
          </Badge>
          <Badge variant="outline" className={`text-[9px] font-mono ${stock.winProb >= 88 ? 'border-yellow-500/50 text-yellow-400 bg-yellow-500/10' : stock.winProb >= 70 ? 'border-stock-up/40 text-stock-up' : ''}`}>
            익절 {stock.winProb}%
          </Badge>
          {stock.epsEstimate != null && (
            <span className="text-[9px] text-muted-foreground ml-auto font-mono">
              EPS ${stock.epsEstimate}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
