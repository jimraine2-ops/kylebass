import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Crosshair, TrendingUp, RefreshCw, Cloud, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

interface Signal {
  symbol: string;
  currentPrice: number;
  lastOpen: number;
  lastClose: number;
  ema200: number;
  spanA: number;
  spanB: number;
  bullish: boolean;
  reason: string;
  limitBuyPrice: number;
  takeProfitPrice: number;
  candleCount: number;
}

interface Response {
  ok: boolean;
  generatedAt: string;
  scanned: number;
  signalCount: number;
  signals: Signal[];
  rejected: Signal[];
  maxPriceUsd: number;
}

async function fetchScan(): Promise<Response> {
  const { data, error } = await supabase.functions.invoke("micro-sniper", { body: {} });
  if (error) throw error;
  return data as Response;
}

export function MicroSniperPanel() {
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["micro-sniper-scan"],
    queryFn: fetchScan,
    refetchInterval: 5 * 60_000, // 🛡️ Free Tier 보호: 5분 주기
    staleTime: 4 * 60_000,
    refetchOnWindowFocus: false,
  });

  return (
    <Card className="bg-card/60 backdrop-blur border-primary/20 shadow-[0_0_30px_-15px_hsl(var(--primary)/0.5)]">
      <CardHeader className="pb-3 border-b border-border/40">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Crosshair className="w-4 h-4 text-primary" />
            <span>Micro-Sniper · 1m EMA200 × Ichimoku 양운 돌파</span>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] border-primary/40 text-primary font-mono">
              &lt; $5 USD · 300봉 정밀계산
            </Badge>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
        {data && (
          <p className="text-[10px] text-muted-foreground font-mono">
            스캔 {data.scanned}종목 · 시그널 {data.signalCount}건 · {new Date(data.generatedAt).toLocaleTimeString("ko-KR")}
          </p>
        )}
      </CardHeader>

      <CardContent className="p-3 space-y-2">
        {isLoading && (
          <div className="text-xs text-muted-foreground py-6 text-center font-mono">
            🛰️ Twelve Data 1m × 300봉 수집 중…
          </div>
        )}

        {data?.signals?.length === 0 && !isLoading && (
          <div className="text-xs text-muted-foreground py-6 text-center font-mono">
            현재 조건을 모두 충족하는 종목이 없습니다.
          </div>
        )}

        {data?.signals?.map((s) => (
          <SignalCard key={s.symbol} s={s} />
        ))}

        {data?.rejected && data.rejected.length > 0 && (
          <details className="pt-2 border-t border-border/40">
            <summary className="text-[10px] text-muted-foreground cursor-pointer hover:text-foreground">
              탈락 {data.rejected.length}건 보기
            </summary>
            <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-1.5">
              {data.rejected.map((r) => (
                <div key={r.symbol} className="text-[9px] font-mono p-1.5 rounded bg-muted/30 border border-border/40">
                  <div className="font-bold text-muted-foreground">{r.symbol}</div>
                  <div className="text-[8px] text-muted-foreground/70 truncate">{r.reason}</div>
                </div>
              ))}
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  );
}

function SignalCard({ s }: { s: Signal }) {
  return (
    <div className="rounded-lg border border-stock-up/40 bg-gradient-to-br from-stock-up/10 via-transparent to-primary/5 p-3 space-y-2 shadow-[0_0_20px_-10px_hsl(var(--stock-up)/0.5)]">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-base font-bold font-mono text-stock-up">{s.symbol}</span>
          <Badge className="bg-stock-up/20 text-stock-up border-stock-up/40 text-[9px]">
            <TrendingUp className="w-2.5 h-2.5 mr-1" />
            BULLISH BREAKOUT
          </Badge>
          <Badge variant="outline" className="text-[9px] font-mono border-primary/30">
            {s.candleCount}봉
          </Badge>
        </div>
        <div className="font-mono text-sm font-bold">${s.currentPrice.toFixed(4)}</div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px] font-mono">
        <Metric label="Open(1m)" value={`$${s.lastOpen.toFixed(4)}`} />
        <Metric label="EMA200" value={`$${s.ema200.toFixed(4)}`} accent="text-primary" />
        <Metric label="Span A" value={`$${s.spanA.toFixed(4)}`} accent="text-stock-up" />
        <Metric label="Span B" value={`$${s.spanB.toFixed(4)}`} accent="text-stock-down" />
      </div>

      <div className="flex items-center gap-3 pt-1 border-t border-border/40 flex-wrap">
        <div className="flex items-center gap-1.5 text-[10px] font-mono">
          <Target className="w-3 h-3 text-warning" />
          <span className="text-muted-foreground">LIMIT BUY</span>
          <span className="font-bold text-warning">${s.limitBuyPrice.toFixed(4)}</span>
          <span className="text-[9px] text-muted-foreground">(-0.95%)</span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-mono">
          <TrendingUp className="w-3 h-3 text-stock-up" />
          <span className="text-muted-foreground">TP</span>
          <span className="font-bold text-stock-up">${s.takeProfitPrice.toFixed(4)}</span>
          <span className="text-[9px] text-muted-foreground">(+1.50%)</span>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-cyan-400">
          <Cloud className="w-3 h-3" />
          <span>양운 상단 돌파</span>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded bg-background/60 border border-border/40 p-1.5">
      <div className="text-[9px] text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className={`font-bold ${accent ?? "text-foreground"}`}>{value}</div>
    </div>
  );
}
