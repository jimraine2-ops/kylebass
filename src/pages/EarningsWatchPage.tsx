import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEarningsWatch } from "@/hooks/useStockData";
import { useNavigate } from "react-router-dom";
import { Calendar, TrendingUp, TrendingDown, Clock, DollarSign, RefreshCw, AlertTriangle, Flame } from "lucide-react";

export default function EarningsWatchPage() {
  const { data, isLoading, refetch, isFetching } = useEarningsWatch();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'all' | 'lowPrice' | 'today'>('all');

  const earnings = data?.earnings || [];

  const filtered = earnings.filter((e: any) => {
    if (filter === 'lowPrice') return e.isLowPrice;
    if (filter === 'today') return e.daysUntil <= 0;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          실적 발표 예정 (48시간 이내)
        </h2>
        <div className="flex items-center gap-2">
          <Badge className="bg-warning/20 text-warning border-warning/30 text-xs">
            <AlertTriangle className="w-3.5 h-3.5 mr-1" />
            어닝 서프라이즈 감시 중
          </Badge>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isFetching ? 'animate-spin' : ''}`} />
            새로고침
          </Button>
        </div>
      </div>

      <Card className="border-warning/20">
        <CardContent className="p-3 text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">📅 Earnings Watch — 실적 발표 예정 종목 실시간 추적</p>
          <p>✅ 48시간 이내 분기 실적(Earnings Release) 예정 종목을 자동 필터링</p>
          <p>🎯 실적 발표 전 지표 점수 급상승 → 어닝 서프라이즈 선반영 확률 ↑ → 90% 익절 확률 모델 연동</p>
          <p>⚠️ 실적 발표 시즌 변동성 대비: 수익 발생 시 본절가 보호 강화</p>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2">
        <Badge variant={filter === 'all' ? 'default' : 'outline'} className="cursor-pointer text-xs" onClick={() => setFilter('all')}>
          전체 ({earnings.length})
        </Badge>
        <Badge variant={filter === 'lowPrice' ? 'default' : 'outline'} className="cursor-pointer text-xs" onClick={() => setFilter('lowPrice')}>
          ₩10,000 미만 ({earnings.filter((e: any) => e.isLowPrice).length})
        </Badge>
        <Badge variant={filter === 'today' ? 'default' : 'outline'} className="cursor-pointer text-xs" onClick={() => setFilter('today')}>
          오늘 ({earnings.filter((e: any) => e.daysUntil <= 0).length})
        </Badge>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            해당 조건의 실적 발표 예정 종목이 없습니다.
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="h-[calc(100vh-380px)] min-h-[400px]">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pr-3">
            {filtered.map((e: any, idx: number) => {
              const isUp = e.changePct >= 0;
              return (
                <Card
                  key={`${e.symbol}-${e.date}`}
                  className={`cursor-pointer transition-all hover:border-primary/40 ${
                    e.isLowPrice ? 'border-warning/40 bg-warning/5' : ''
                  }`}
                  onClick={() => navigate(`/stock/${e.symbol}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                          {idx + 1}
                        </div>
                        <div>
                          <span className="font-bold text-base">{e.symbol}</span>
                          <div className="flex items-center gap-1 mt-0.5">
                            <Badge variant="outline" className="text-[9px] px-1 py-0">
                              <Clock className="w-2.5 h-2.5 mr-0.5" />
                              {e.date} {e.hourLabel}
                            </Badge>
                            {e.daysUntil <= 0 && (
                              <Badge className="text-[9px] px-1 py-0 bg-destructive/20 text-destructive border-0">
                                <Flame className="w-2.5 h-2.5 mr-0.5" />오늘
                              </Badge>
                            )}
                            {e.isLowPrice && (
                              <Badge className="text-[9px] px-1 py-0 bg-warning/20 text-warning border-0">
                                저가주
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold font-mono">₩{e.priceKRW?.toLocaleString('ko-KR')}</p>
                        <p className={`text-sm font-mono ${isUp ? 'text-stock-up' : 'text-stock-down'}`}>
                          {isUp ? '+' : ''}{e.changePct}%
                          {isUp ? <TrendingUp className="w-3 h-3 inline ml-1" /> : <TrendingDown className="w-3 h-3 inline ml-1" />}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs mt-2">
                      {e.epsEstimate != null && (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <DollarSign className="w-3 h-3" />
                          <span>EPS 예상: ${e.epsEstimate}</span>
                        </div>
                      )}
                      {e.revenueEstimate != null && (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <DollarSign className="w-3 h-3" />
                          <span>매출 예상: ${(e.revenueEstimate / 1e6).toFixed(0)}M</span>
                        </div>
                      )}
                      {e.quarter && (
                        <div className="text-muted-foreground">
                          Q{e.quarter} {e.year}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
