import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, Shield, ArrowUp, ArrowDown, Activity, Radar, Target } from "lucide-react";
import { formatStockName } from "@/lib/koreanStockMap";
import { cn } from "@/lib/utils";

interface OpenPositionCardProps {
  position: any;
  onSelect?: () => void;
  isSelected?: boolean;
  livePrice?: number | null;
  fxRate?: number;
  liveScore?: number | null;
  prevScore?: number | null;
  onOpenModal?: () => void;
}

function getScoreColor(score: number): string {
  if (score >= 55) return 'text-stock-up';
  if (score >= 45) return 'text-primary';
  if (score >= 35) return 'text-warning';
  return 'text-destructive';
}

function parseWinProbability(aiReason: string | null): number | null {
  if (!aiReason) return null;
  const match = aiReason.match(/\[예상 익절 확률:\s*(\d+)%\]/) || aiReason.match(/\[AI 승률 예측:\s*(\d+)%\]/);
  return match ? parseInt(match[1]) : null;
}

export function OpenPositionCard({ position: pos, onSelect, isSelected, livePrice, fxRate = 1350, liveScore, prevScore, onOpenModal }: OpenPositionCardProps) {
  const displayPrice = livePrice ?? pos.currentPrice ?? pos.price;
  const investmentKRW = Math.round(pos.price * pos.quantity * fxRate);
  const currentValueKRW = Math.round(displayPrice * pos.quantity * fxRate);
  const unrealizedPnl = currentValueKRW - investmentKRW;
  const unrealizedPnlPct = investmentKRW > 0 ? ((currentValueKRW / investmentKRW) - 1) * 100 : 0;
  const isProfit = unrealizedPnl >= 0;
  const pnlColor = isProfit ? 'text-stock-up' : 'text-stock-down';

  const score = liveScore ?? pos.entry_score ?? null;
  const scoreChanged = score !== null && prevScore !== null && prevScore !== undefined ? score - prevScore : 0;
  const isDanger = score !== null && score < 40;

  const winProb = parseWinProbability(pos.ai_reason);
  const is90Prob = winProb !== null && winProb >= 90;

  const isSuperTarget = (pos.ai_reason || '').includes('15%') || (pos.ai_reason || '').includes('슈퍼');
  const targetPct = isSuperTarget ? 15 : (pos.take_profit && pos.price > 0)
    ? ((pos.take_profit - pos.price) / pos.price * 100) : 5;
  const targetProgress = targetPct > 0 ? Math.min(100, Math.max(0, (unrealizedPnlPct / targetPct) * 100)) : 0;

  return (
    <div
      className={cn(
        "p-2.5 rounded-lg bg-muted/30 border transition-all",
        onSelect && 'cursor-pointer hover:border-primary/40',
        isSelected ? 'border-primary ring-1 ring-primary/20' : 'border-border/50',
        isDanger && 'border-destructive/50 bg-destructive/5',
        is90Prob && !isDanger && 'border-amber-500/40 bg-amber-500/5'
      )}
      onClick={onSelect}
    >
      {/* Row 1: Symbol + Score + PnL */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-bold text-sm truncate">{formatStockName(pos.symbol)}</span>
          <span className="text-[10px] text-muted-foreground shrink-0">{pos.quantity}주</span>

          {score !== null && (
            <span className={cn("text-[11px] font-mono font-bold flex items-center gap-0.5", getScoreColor(score))}>
              <Activity className="w-3 h-3" />
              {score}점
              {scoreChanged !== 0 && (
                <span className={cn("flex items-center", scoreChanged > 0 ? 'text-stock-up' : 'text-stock-down')}>
                  {scoreChanged > 0 ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />}
                </span>
              )}
            </span>
          )}

          {is90Prob && (
            <Badge className="text-[9px] px-1.5 py-0 bg-gradient-to-r from-amber-500 to-yellow-400 text-black border-0 font-bold">
              🏆{winProb}%
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className="text-[11px] font-mono text-muted-foreground">
            ₩{Math.round(displayPrice * fxRate).toLocaleString('ko-KR')}
          </span>
          <span className={cn("text-sm font-mono font-bold", pnlColor)}>
            {isProfit ? '+' : ''}₩{unrealizedPnl.toLocaleString()}
            <span className="text-[10px] ml-0.5">({isProfit ? '+' : ''}{unrealizedPnlPct.toFixed(1)}%)</span>
          </span>
        </div>
      </div>

      {/* Row 2: Target progress + SL/TP compact */}
      <div className="flex items-center gap-2 mt-1.5">
        <Target className={cn("w-3 h-3 shrink-0", isSuperTarget ? 'text-warning' : 'text-muted-foreground')} />
        <Progress
          value={targetProgress}
          className={cn("h-1.5 flex-1", isSuperTarget ? '[&>div]:bg-warning' : '[&>div]:bg-primary')}
        />
        <span className="text-[10px] font-mono text-muted-foreground w-8 text-right">{targetProgress.toFixed(0)}%</span>

        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 ml-1">
          <Shield className="w-2.5 h-2.5" />
          {((pos.stop_loss / pos.price - 1) * 100).toFixed(0)}%
        </span>
        <span className="text-[10px] text-stock-up flex items-center gap-0.5">
          <TrendingUp className="w-2.5 h-2.5" />
          +{targetPct.toFixed(0)}%
        </span>

        {onOpenModal && (
          <Button
            variant="ghost"
            size="sm"
            className="h-5 px-1.5 text-[9px] gap-0.5 text-muted-foreground hover:text-primary ml-auto"
            onClick={(e) => { e.stopPropagation(); onOpenModal(); }}
          >
            <Radar className="w-3 h-3" />
          </Button>
        )}
      </div>

      {/* Row 3: Status messages (only when needed) */}
      {isDanger && (
        <p className="text-[10px] text-destructive font-medium mt-1">⚠️ 지표 추세 이탈 — 40점 미만 자동 매도</p>
      )}
      {!isProfit && unrealizedPnlPct > -10 && unrealizedPnlPct < -1 && score !== null && score >= 50 && (
        <p className="text-[10px] text-primary font-medium mt-1">🛡️ 변동성 구간 홀딩 — 지표 양호</p>
      )}
    </div>
  );
}
