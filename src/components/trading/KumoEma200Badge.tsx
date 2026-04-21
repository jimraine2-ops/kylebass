import React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Cloud, TrendingUp } from "lucide-react";
import type { GoldenCloudTarget } from "@/hooks/useGoldenCloudTargets";

interface KumoEma200BadgeProps {
  target: GoldenCloudTarget;
  entryPrice: number;
  currentPrice: number;
}

/**
 * Mini visualization showing where the entry price and current price sit
 * relative to the Ichimoku Kumo cloud (top/bottom) and EMA200.
 *
 * Visual scale (vertical axis):
 *   - top    = max(currentPrice, kumoTop) * 1.05
 *   - bottom = min(ema200, kumoBottom) * 0.95
 *
 * Layers (back→front):
 *   1. Kumo cloud band (warning gradient)
 *   2. EMA200 horizontal line (primary)
 *   3. Entry price marker (muted)
 *   4. Current price marker (stock-up if above kumoTop, stock-down if below kumoBottom)
 */
export function KumoEma200Badge({ target, entryPrice, currentPrice }: KumoEma200BadgeProps) {
  const { kumoTop, kumoBottom, ema200 } = target;
  const top = Math.max(currentPrice, kumoTop, entryPrice) * 1.05;
  const bottom = Math.min(ema200, kumoBottom, entryPrice, currentPrice) * 0.95;
  const range = top - bottom || 1;

  // Convert price → y% (0 at top, 100 at bottom)
  const pct = (p: number) => Math.max(0, Math.min(100, ((top - p) / range) * 100));

  const kumoTopY = pct(kumoTop);
  const kumoBottomY = pct(kumoBottom);
  const ema200Y = pct(ema200);
  const entryY = pct(entryPrice);
  const currentY = pct(currentPrice);

  // Status: 안전(구름 위) / 구름 안 / 구름 아래
  const safeAboveKumo = currentPrice >= kumoTop;
  const insideKumo = currentPrice < kumoTop && currentPrice >= kumoBottom;
  const belowKumo = currentPrice < kumoBottom;

  const statusLabel = safeAboveKumo
    ? '☁️ 구름 위 안전 추격'
    : insideKumo
      ? '☁️ 구름 내부 (지지 테스트)'
      : '⚠️ 구름 이탈';
  const statusColor = safeAboveKumo
    ? 'border-stock-up/40 text-stock-up bg-stock-up/10'
    : insideKumo
      ? 'border-warning/40 text-warning bg-warning/10'
      : 'border-destructive/40 text-destructive bg-destructive/10';
  const aboveEma200 = currentPrice > ema200;

  return (
    <div className={cn(
      "flex items-stretch gap-2 px-2 py-1.5 rounded border",
      statusColor
    )}>
      {/* Mini chart canvas */}
      <div className="relative w-20 h-14 shrink-0 rounded bg-background/40 border border-border/40 overflow-hidden">
        {/* Kumo cloud band */}
        <div
          className="absolute left-0 right-0 bg-warning/25 border-y border-warning/50"
          style={{
            top: `${kumoTopY}%`,
            height: `${Math.max(2, kumoBottomY - kumoTopY)}%`,
          }}
          aria-label="Ichimoku Kumo"
        />
        {/* EMA200 line */}
        <div
          className="absolute left-0 right-0 border-t-2 border-dashed border-primary/70"
          style={{ top: `${ema200Y}%` }}
          aria-label="EMA200"
        />
        {/* Entry price marker */}
        <div
          className="absolute left-0 right-0 border-t border-muted-foreground/60"
          style={{ top: `${entryY}%` }}
          aria-label="진입가"
        >
          <span className="absolute -left-0.5 -top-1 w-1.5 h-1.5 rounded-full bg-muted-foreground" />
        </div>
        {/* Current price marker (animated) */}
        <div
          className={cn(
            "absolute left-0 right-0 border-t-2 transition-all",
            safeAboveKumo ? 'border-stock-up' : belowKumo ? 'border-stock-down' : 'border-warning'
          )}
          style={{ top: `${currentY}%` }}
          aria-label="현재가"
        >
          <span className={cn(
            "absolute -right-0.5 -top-1.5 w-2 h-2 rounded-full animate-pulse",
            safeAboveKumo ? 'bg-stock-up shadow-[0_0_6px_hsl(var(--stock-up))]'
              : belowKumo ? 'bg-stock-down shadow-[0_0_6px_hsl(var(--stock-down))]'
                : 'bg-warning shadow-[0_0_6px_hsl(var(--warning))]'
          )} />
        </div>
      </div>

      {/* Legend / status */}
      <div className="flex-1 min-w-0 text-[10px] leading-tight space-y-0.5">
        <div className="flex items-center gap-1 font-bold">
          <Cloud className={cn("w-3 h-3 shrink-0",
            safeAboveKumo ? 'text-stock-up' : insideKumo ? 'text-warning' : 'text-destructive'
          )} />
          <span className="truncate">{statusLabel}</span>
        </div>
        <div className="flex items-center gap-1.5 font-mono">
          <span className="text-warning">☁️상단 ${kumoTop.toFixed(2)}</span>
          <span className="text-muted-foreground">/</span>
          <span className="text-warning/70">하단 ${kumoBottom.toFixed(2)}</span>
        </div>
        <div className="flex items-center gap-1.5 font-mono">
          <TrendingUp className={cn("w-2.5 h-2.5", aboveEma200 ? 'text-primary' : 'text-destructive')} />
          <span className={aboveEma200 ? 'text-primary' : 'text-destructive'}>
            EMA200 ${ema200.toFixed(2)} {aboveEma200 ? '✓ 우상향 위' : '✗ 이탈'}
          </span>
          {target.newsBullishPct >= 60 ? (
            <Badge variant="outline" className="text-[8px] px-1 py-0 border-stock-up/40 text-stock-up ml-auto">📰{target.newsBullishPct}%</Badge>
          ) : target.newsBullishPct < 40 ? (
            <Badge variant="outline" className="text-[8px] px-1 py-0 border-stock-down/40 text-stock-down ml-auto">📰{target.newsBullishPct}%</Badge>
          ) : (
            <Badge variant="outline" className="text-[8px] px-1 py-0 border-muted-foreground/40 text-muted-foreground ml-auto">📰{target.newsBullishPct}%</Badge>
          )}
        </div>
      </div>
    </div>
  );
}
