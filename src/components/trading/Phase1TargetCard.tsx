import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Target, TrendingDown } from "lucide-react";
import { formatStockName } from "@/lib/koreanStockMap";
import { useExchangeRate } from "@/hooks/useExchangeRate";

interface Phase1Target {
  symbol: string;
  price: number;
  ema25: number;
  emaGapPct: number;
  avgDollarVolUSD: number;
  limitPriceUSD: number;
  capType: 'large' | 'small';
}

export function Phase1TargetCard() {
  const { rate: fxRate } = useExchangeRate();

  const { data: latestLog, isLoading } = useQuery({
    queryKey: ['phase1-targets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agent_logs')
        .select('created_at, message, details')
        .like('message', '[Phase1] ✅%')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    refetchInterval: 5000,
  });

  const targets: Phase1Target[] = (latestLog?.details as any)?.targets || [];
  const builtAt = latestLog?.created_at
    ? new Date(latestLog.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;

  return (
    <Card className="border-warning/40 bg-gradient-to-br from-warning/5 via-background to-primary/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2 flex-wrap">
          <Target className="w-4 h-4 text-warning animate-pulse" />
          🎯 Phase 1 그물망 타겟 유니버스
          <Badge variant="outline" className="text-[10px] font-mono border-warning/40 text-warning">
            EMA25 정밀 산출 · Polygon.io
          </Badge>
          {builtAt && (
            <Badge variant="outline" className="text-[10px] font-mono ml-auto">
              빌드: {builtAt}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-xs text-muted-foreground text-center py-3">타겟 유니버스 로딩 중...</p>
        ) : targets.length === 0 ? (
          <div className="text-xs text-muted-foreground text-center py-4 space-y-1">
            <p>⏳ 타겟 유니버스 빌드 대기 중</p>
            <p className="text-[10px] opacity-70">Polygon.io 5 req/min 한도로 점진 누적 (사이클당 4종목)</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
            {targets.map((t, idx) => {
              const limitKRW = Math.floor(t.limitPriceUSD * fxRate);
              const priceKRW = Math.floor(t.price * fxRate);
              const ema25KRW = Math.floor(t.ema25 * fxRate);
              return (
                <div
                  key={t.symbol}
                  className="border border-border/50 rounded-lg p-2 bg-background/60 backdrop-blur-sm hover:border-warning/60 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <Badge variant="secondary" className="text-[9px] px-1 py-0">#{idx + 1}</Badge>
                    <span className="text-[9px] font-mono text-muted-foreground">
                      {t.capType === 'large' ? '🏛️대형' : '💎소형'}
                    </span>
                  </div>
                  <div className="font-bold text-sm font-mono text-primary truncate">{t.symbol}</div>
                  <div className="text-[10px] text-muted-foreground truncate mb-1.5">{formatStockName(t.symbol)}</div>

                  <div className="space-y-1 text-[10px]">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">현재가</span>
                      <span className="font-mono">${t.price.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">EMA25</span>
                      <span className="font-mono">${t.ema25.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">EMA갭</span>
                      <span className="font-mono text-stock-down flex items-center gap-0.5">
                        <TrendingDown className="w-2.5 h-2.5" />
                        {(t.emaGapPct * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="border-t border-border/40 pt-1 mt-1">
                      <div className="flex justify-between items-center">
                        <span className="text-warning font-semibold">🎯 마중가</span>
                        <div className="text-right">
                          <div className="font-mono font-bold text-warning">${t.limitPriceUSD.toFixed(2)}</div>
                          <div className="font-mono text-[9px] text-muted-foreground">₩{limitKRW.toLocaleString('ko-KR')}</div>
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-between text-[9px] text-muted-foreground">
                      <span>20일 평균거래대금</span>
                      <span className="font-mono">${(t.avgDollarVolUSD / 1e6).toFixed(2)}M</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="mt-2 pt-2 border-t border-border/30 text-[9px] text-muted-foreground flex items-center justify-between flex-wrap gap-1">
          <span>📐 마중가 = EMA25 × 0.93 (7% 아래 그물망 알박기)</span>
          <span>필터: 가격 ≤ $9 · 20일 거래대금 ≥ $2.22M · 현재가 ≤ EMA25-5%</span>
        </div>
      </CardContent>
    </Card>
  );
}
