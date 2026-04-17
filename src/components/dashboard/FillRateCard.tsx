import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface FillStats {
  filled: number;
  failed: number;
  attempts: number;
  fillRate: number;
  topFailedSymbol: string | null;
  topFailedCount: number;
}

function getKstTodayStartUtcIso(): string {
  // KST midnight = UTC 15:00 previous day
  const now = new Date();
  const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const kstYear = kstNow.getUTCFullYear();
  const kstMonth = kstNow.getUTCMonth();
  const kstDate = kstNow.getUTCDate();
  // KST 00:00 → UTC = previous day 15:00
  const utcMs = Date.UTC(kstYear, kstMonth, kstDate) - 9 * 60 * 60 * 1000;
  return new Date(utcMs).toISOString();
}

export function FillRateCard() {
  const [stats, setStats] = useState<FillStats>({
    filled: 0,
    failed: 0,
    attempts: 0,
    fillRate: 100,
    topFailedSymbol: null,
    topFailedCount: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchStats = async () => {
      const sinceIso = getKstTodayStartUtcIso();
      const { data, error } = await supabase
        .from("agent_logs")
        .select("action, symbol, created_at")
        .in("action", ["exit", "fill_failed"])
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: false })
        .limit(500);

      if (cancelled || error) {
        if (!cancelled) setLoading(false);
        return;
      }

      const filled = (data || []).filter((r) => r.action === "exit").length;
      const failed = (data || []).filter((r) => r.action === "fill_failed").length;
      const attempts = filled + failed;
      const fillRate = attempts > 0 ? Math.round((filled / attempts) * 1000) / 10 : 100;

      // Top failed symbol
      const failCounts = new Map<string, number>();
      (data || [])
        .filter((r) => r.action === "fill_failed" && r.symbol)
        .forEach((r) => {
          const s = r.symbol as string;
          failCounts.set(s, (failCounts.get(s) || 0) + 1);
        });
      let topFailedSymbol: string | null = null;
      let topFailedCount = 0;
      failCounts.forEach((count, sym) => {
        if (count > topFailedCount) {
          topFailedSymbol = sym;
          topFailedCount = count;
        }
      });

      setStats({ filled, failed, attempts, fillRate, topFailedSymbol, topFailedCount });
      setLoading(false);
    };

    fetchStats();
    const id = setInterval(fetchStats, 10000); // 10초 자동 갱신
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // Color thresholds
  const rateColor =
    stats.fillRate >= 90
      ? "text-stock-up"
      : stats.fillRate >= 70
      ? "text-warning"
      : "text-destructive";
  const rateBg =
    stats.fillRate >= 90
      ? "from-stock-up/10 to-stock-up/5 border-stock-up/30"
      : stats.fillRate >= 70
      ? "from-warning/10 to-warning/5 border-warning/30"
      : "from-destructive/10 to-destructive/5 border-destructive/30";

  return (
    <Card className={`bg-gradient-to-br ${rateBg} border`}>
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <Activity className={`w-4 h-4 ${rateColor} animate-pulse`} />
            <span className="text-xs sm:text-sm font-semibold whitespace-nowrap">
              실전 체결률 (KST 오늘)
            </span>
            <Badge variant="outline" className="text-[10px] font-mono">
              10초 갱신
            </Badge>
          </div>

          <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
            {/* Fill Rate % */}
            <div className="text-right">
              <div className={`text-2xl sm:text-3xl font-bold tabular-nums ${rateColor}`}>
                {loading ? "—" : `${stats.fillRate.toFixed(1)}%`}
              </div>
              <div className="text-[10px] text-muted-foreground">체결률</div>
            </div>

            {/* Filled count */}
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-stock-up" />
              <div>
                <div className="text-base sm:text-lg font-bold text-stock-up tabular-nums">
                  {stats.filled}
                </div>
                <div className="text-[10px] text-muted-foreground">체결 확정</div>
              </div>
            </div>

            {/* Failed count */}
            <div className="flex items-center gap-1.5">
              <XCircle className="w-4 h-4 text-destructive" />
              <div>
                <div className="text-base sm:text-lg font-bold text-destructive tabular-nums">
                  {stats.failed}
                </div>
                <div className="text-[10px] text-muted-foreground">미체결 누적</div>
              </div>
            </div>

            {/* Attempts */}
            <div className="hidden md:block">
              <div className="text-base sm:text-lg font-bold tabular-nums text-foreground">
                {stats.attempts}
              </div>
              <div className="text-[10px] text-muted-foreground">총 시도</div>
            </div>
          </div>
        </div>

        {/* Top failed symbol notice */}
        {stats.topFailedSymbol && stats.topFailedCount >= 2 && (
          <div className="mt-2 pt-2 border-t border-border/50 flex items-center gap-2 text-[11px]">
            <span className="text-muted-foreground">최다 미체결 종목:</span>
            <Badge variant="destructive" className="font-mono text-[10px]">
              {stats.topFailedSymbol} ({stats.topFailedCount}회)
            </Badge>
            <span className="text-muted-foreground">— 수급 부족 의심</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
