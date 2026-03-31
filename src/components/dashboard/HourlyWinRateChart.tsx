import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from "recharts";
import { Clock, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

interface HourlyBucket {
  hour: string;
  wins: number;
  losses: number;
  total: number;
  winRate: number;
  pnl: number;
}

async function fetchHourlyWinRate(): Promise<HourlyBucket[]> {
  const { data, error } = await supabase
    .from("unified_trades")
    .select("closed_at, pnl, status")
    .eq("status", "closed")
    .not("closed_at", "is", null)
    .order("closed_at", { ascending: false })
    .limit(500);

  if (error || !data) return [];

  // Also include other closed statuses
  const { data: data2 } = await supabase
    .from("unified_trades")
    .select("closed_at, pnl, status")
    .neq("status", "open")
    .neq("status", "closed")
    .not("closed_at", "is", null)
    .order("closed_at", { ascending: false })
    .limit(500);

  const allTrades = [...(data || []), ...(data2 || [])];
  
  // Group by ET hour (UTC-4 for US Eastern)
  const buckets: Record<string, { wins: number; losses: number; pnl: number }> = {};
  
  // Initialize all hours
  for (let h = 4; h <= 20; h++) {
    const label = `${h}시`;
    buckets[label] = { wins: 0, losses: 0, pnl: 0 };
  }

  allTrades.forEach((t: any) => {
    if (!t.closed_at) return;
    const d = new Date(t.closed_at);
    const etHour = (d.getUTCHours() - 4 + 24) % 24; // Convert to ET
    if (etHour < 4 || etHour > 20) return;
    const label = `${etHour}시`;
    if (!buckets[label]) buckets[label] = { wins: 0, losses: 0, pnl: 0 };
    const pnl = t.pnl || 0;
    if (pnl > 0) buckets[label].wins++;
    else buckets[label].losses++;
    buckets[label].pnl += pnl;
  });

  return Object.entries(buckets)
    .map(([hour, v]) => ({
      hour,
      wins: v.wins,
      losses: v.losses,
      total: v.wins + v.losses,
      winRate: v.wins + v.losses > 0 ? Math.round((v.wins / (v.wins + v.losses)) * 100) : 0,
      pnl: Math.round(v.pnl * 1350),
    }))
    .filter((b) => b.total > 0)
    .sort((a, b) => parseInt(a.hour) - parseInt(b.hour));
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload as HourlyBucket;
  return (
    <div className="bg-popover border border-border rounded-lg p-2.5 shadow-lg text-xs space-y-1">
      <p className="font-bold text-foreground">{d.hour} (ET)</p>
      <p className="text-stock-up">승: {d.wins}회</p>
      <p className="text-stock-down">패: {d.losses}회</p>
      <p className="font-semibold">
        승률: <span className={d.winRate >= 60 ? "text-stock-up" : d.winRate >= 50 ? "text-warning" : "text-stock-down"}>{d.winRate}%</span>
      </p>
      <p className={`font-mono ${d.pnl >= 0 ? "text-stock-up" : "text-stock-down"}`}>
        PnL: {d.pnl >= 0 ? "+" : ""}₩{d.pnl.toLocaleString("ko-KR")}
      </p>
    </div>
  );
};

export function HourlyWinRateChart() {
  const { data: buckets = [], isLoading } = useQuery({
    queryKey: ["hourly-win-rate"],
    queryFn: fetchHourlyWinRate,
    refetchInterval: 30000,
  });

  const avgWinRate = buckets.length > 0
    ? Math.round(buckets.reduce((s, b) => s + b.winRate * b.total, 0) / Math.max(buckets.reduce((s, b) => s + b.total, 0), 1))
    : 0;

  const bestHour = buckets.reduce((best, b) => (b.winRate > (best?.winRate ?? 0) && b.total >= 2 ? b : best), buckets[0]);
  const worstHour = buckets.reduce((worst, b) => (b.winRate < (worst?.winRate ?? 100) && b.total >= 2 ? b : worst), buckets[0]);

  return (
    <Card>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-primary" />
            시간대별 승률 분석
          </span>
          <div className="flex items-center gap-1.5">
            {bestHour && (
              <Badge variant="outline" className="text-[9px] border-stock-up/30 text-stock-up gap-0.5">
                <TrendingUp className="w-2.5 h-2.5" />
                최고 {bestHour.hour} ({bestHour.winRate}%)
              </Badge>
            )}
            <Badge variant="outline" className="text-[10px]">
              평균 {avgWinRate}%
            </Badge>
          </div>
        </div>

        {isLoading ? (
          <div className="h-[180px] flex items-center justify-center text-xs text-muted-foreground">로딩 중...</div>
        ) : buckets.length === 0 ? (
          <div className="h-[180px] flex items-center justify-center text-xs text-muted-foreground">청산 데이터 없음</div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={buckets} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
              <XAxis dataKey="hour" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} className="fill-muted-foreground" tickFormatter={(v) => `${v}%`} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={60} stroke="hsl(var(--stock-up))" strokeDasharray="4 4" strokeOpacity={0.4} />
              <ReferenceLine y={50} stroke="hsl(var(--muted-foreground))" strokeDasharray="2 2" strokeOpacity={0.3} />
              <Bar dataKey="winRate" radius={[3, 3, 0, 0]} maxBarSize={28}>
                {buckets.map((b, i) => (
                  <Cell
                    key={i}
                    fill={b.winRate >= 65 ? "hsl(var(--stock-up))" : b.winRate >= 50 ? "hsl(var(--warning))" : "hsl(var(--stock-down))"}
                    fillOpacity={0.8}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}

        {/* Summary */}
        {buckets.length > 0 && (
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground pt-1 border-t border-border/30">
            <span>총 {buckets.reduce((s, b) => s + b.total, 0)}거래</span>
            {worstHour && worstHour.winRate < 50 && (
              <span className="text-stock-down">⚠ {worstHour.hour} 승률 {worstHour.winRate}% 주의</span>
            )}
            <span className="ml-auto text-[9px]">30초 자동갱신 · ET 기준</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
