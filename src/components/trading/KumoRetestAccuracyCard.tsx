import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Crosshair, TrendingDown, TrendingUp } from "lucide-react";
import { useKumoRetestStats } from "@/hooks/useKumoRetestStats";
import { formatStockName } from "@/lib/koreanStockMap";

export function KumoRetestAccuracyCard() {
  const { data, isLoading } = useKumoRetestStats();

  if (isLoading) {
    return (
      <Card className="border-cyan-500/30 bg-cyan-500/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Crosshair className="w-4 h-4 text-cyan-400" />
            ☁️ Kumo-Retest 마중가 정확도
          </CardTitle>
        </CardHeader>
        <CardContent><Skeleton className="h-24 w-full" /></CardContent>
      </Card>
    );
  }

  const stats = data || {
    totalLimitOrders: 0, filledAtOrBelowKumo: 0, fillAccuracyPct: 0,
    avgSlippagePct: 0, avgSlippageBps: 0, avgFillVsLimitPct: 0, recentSamples: [],
  };

  const accGood = stats.fillAccuracyPct >= 70;
  const slipGood = stats.avgSlippagePct <= 0.3;

  return (
    <Card className="border-cyan-500/30 bg-cyan-500/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2 flex-wrap">
          <Crosshair className="w-4 h-4 text-cyan-400" />
          <span className="text-cyan-400">☁️ Kumo-Retest 마중가 정확도</span>
          <Badge variant="outline" className="text-[10px] ml-auto">
            최근 {stats.totalLimitOrders}건 LIMIT 분석
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Top metrics */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-background/40 rounded-lg p-3 border border-border/40">
            <div className="text-[10px] text-muted-foreground mb-1">마중가 이하 체결률</div>
            <div className={`text-2xl font-bold font-mono ${accGood ? "text-stock-up" : "text-warning"}`}>
              {stats.fillAccuracyPct.toFixed(1)}%
            </div>
            <div className="text-[10px] text-muted-foreground mt-1">
              {stats.filledAtOrBelowKumo} / {stats.totalLimitOrders} 건 정타
            </div>
          </div>

          <div className="bg-background/40 rounded-lg p-3 border border-border/40">
            <div className="text-[10px] text-muted-foreground mb-1 flex items-center gap-1">
              평균 슬리피지 (체결가 vs 마중가)
              {stats.avgSlippagePct >= 0 ? (
                <TrendingUp className="w-3 h-3 text-stock-down" />
              ) : (
                <TrendingDown className="w-3 h-3 text-stock-up" />
              )}
            </div>
            <div className={`text-2xl font-bold font-mono ${slipGood ? "text-stock-up" : "text-warning"}`}>
              {stats.avgSlippagePct >= 0 ? "+" : ""}{stats.avgSlippagePct.toFixed(2)}%
            </div>
            <div className="text-[10px] text-muted-foreground mt-1">
              {stats.avgSlippageBps >= 0 ? "+" : ""}{stats.avgSlippageBps.toFixed(0)} bps
            </div>
          </div>
        </div>

        {/* Recent samples */}
        {stats.recentSamples.length > 0 && (
          <div className="space-y-1">
            <div className="text-[10px] text-muted-foreground font-semibold">
              최근 체결 (마중가 vs 실체결)
            </div>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {stats.recentSamples.map((s, idx) => {
                const good = s.slippagePct <= 0.5;
                return (
                  <div
                    key={`${s.symbol}-${idx}`}
                    className="flex items-center justify-between text-[11px] px-2 py-1.5 rounded bg-background/30 border border-border/20"
                  >
                    <span className="font-bold w-20 truncate">{formatStockName(s.symbol)}</span>
                    <span className="font-mono text-muted-foreground">
                      🪤${s.limitPrice.toFixed(s.limitPrice < 5 ? 4 : 2)}
                    </span>
                    <span className="font-mono">
                      → ${s.fillPrice.toFixed(s.fillPrice < 5 ? 4 : 2)}
                    </span>
                    {s.kumoTop != null && (
                      <span className="font-mono text-cyan-400/70 text-[10px]">
                        ☁️${s.kumoTop.toFixed(s.kumoTop < 5 ? 4 : 2)}
                      </span>
                    )}
                    <Badge
                      variant="outline"
                      className={`text-[9px] px-1 py-0 font-mono ${
                        good
                          ? "border-stock-up/40 text-stock-up"
                          : "border-warning/40 text-warning"
                      }`}
                    >
                      {s.slippagePct >= 0 ? "+" : ""}{s.slippagePct.toFixed(2)}%
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <p className="text-[10px] text-muted-foreground italic border-l-2 border-cyan-500/40 pl-2">
          "마중가(Kumo 상단 리테스트) 이하로 체결되면 정타. +0.5% 이내는 허용 슬리피지."
        </p>
      </CardContent>
    </Card>
  );
}
