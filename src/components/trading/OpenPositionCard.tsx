import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Shield, ArrowUp, ArrowDown, Activity, Radar } from "lucide-react";
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

function getStrategyTag(aiReason: string | null): { label: string; color: string } {
  if (!aiReason) return { label: 'Main', color: 'bg-primary/20 text-primary border-primary/30' };
  if (aiReason.startsWith('[Quant]')) return { label: 'Quant', color: 'bg-stock-up/20 text-stock-up border-stock-up/30' };
  if (aiReason.startsWith('[Scalp]')) return { label: 'Scalp', color: 'bg-warning/20 text-warning border-warning/30' };
  return { label: 'Main', color: 'bg-primary/20 text-primary border-primary/30' };
}

function getScoreColor(score: number): string {
  if (score >= 60) return 'text-stock-up';
  if (score >= 50) return 'text-primary';
  if (score >= 40) return 'text-warning';
  return 'text-destructive';
}

function getScoreBgColor(score: number): string {
  if (score >= 60) return 'bg-stock-up/15 border-stock-up/40';
  if (score >= 50) return 'bg-primary/15 border-primary/40';
  if (score >= 40) return 'bg-warning/15 border-warning/40';
  return 'bg-destructive/15 border-destructive/40';
}

function getScoreLabel(score: number): string {
  if (score >= 60) return '강력 보유';
  if (score >= 50) return '보유 유지';
  if (score >= 40) return '주의';
  return '매도 검토';
}

export function OpenPositionCard({ position: pos, onSelect, isSelected, livePrice, fxRate = 1350, liveScore, prevScore }: OpenPositionCardProps) {
  const displayPrice = livePrice ?? pos.currentPrice ?? pos.price;
  const investmentKRW = Math.round(pos.price * pos.quantity * fxRate);
  const currentValueKRW = Math.round(displayPrice * pos.quantity * fxRate);
  const unrealizedPnl = currentValueKRW - investmentKRW;
  const unrealizedPnlPct = investmentKRW > 0 ? ((currentValueKRW / investmentKRW) - 1) * 100 : 0;
  const isProfit = unrealizedPnl >= 0;
  const pnlColor = isProfit ? 'text-stock-up' : 'text-stock-down';
  const tag = getStrategyTag(pos.ai_reason);

  const score = liveScore ?? pos.entry_score ?? null;
  const scoreChanged = score !== null && prevScore !== null && prevScore !== undefined ? score - prevScore : 0;
  const isDanger = score !== null && score < 40;

  return (
    <div
      className={cn(
        "p-3 rounded-lg bg-muted/50 border space-y-2 transition-all",
        onSelect && 'cursor-pointer hover:border-primary/40',
        isSelected ? 'border-primary ring-1 ring-primary/20' : 'border-border',
        isDanger && 'animate-pulse border-destructive/60 bg-destructive/5'
      )}
      onClick={onSelect}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${tag.color}`}>
            {tag.label}
          </Badge>
          <span className="font-bold text-sm">{formatStockName(pos.symbol)}</span>
          <span className="text-xs text-muted-foreground">{pos.quantity}주 @ ₩{Math.round((pos.price || 0) * fxRate).toLocaleString('ko-KR')}</span>

          {/* ★ Live AI Score Badge */}
          {score !== null && (
            <Badge variant="outline" className={cn("text-[10px] px-2 py-0.5 gap-1 font-mono font-bold border", getScoreBgColor(score))}>
              <Activity className={cn("w-3 h-3", getScoreColor(score))} />
              <span className={getScoreColor(score)}>AI {score}점</span>
              {scoreChanged !== 0 && (
                <span className={cn("flex items-center text-[9px]", scoreChanged > 0 ? 'text-stock-up' : 'text-stock-down')}>
                  {scoreChanged > 0 ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />}
                  {Math.abs(scoreChanged)}
                </span>
              )}
            </Badge>
          )}
          {score !== null && (
            <span className={cn("text-[9px] font-medium", getScoreColor(score))}>
              {getScoreLabel(score)}
            </span>
          )}

          <Badge variant="outline" className="text-[10px]">
            신뢰도: {pos.ai_confidence}%
          </Badge>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-muted-foreground">현재가{livePrice ? ' 🟢' : ''}</p>
            <p className="text-sm font-mono font-bold">₩{Math.round(displayPrice * fxRate).toLocaleString('ko-KR')}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">미실현 PnL</p>
            <p className={cn("text-sm font-mono font-bold", pnlColor)}>
              {isProfit ? '+' : ''}₩{unrealizedPnl.toLocaleString()}
              <span className="text-[10px] ml-1">({isProfit ? '+' : ''}{unrealizedPnlPct.toFixed(2)}%)</span>
            </p>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <Shield className="w-3 h-3 text-destructive" />
          SL: ₩{Math.round((pos.stop_loss || 0) * fxRate).toLocaleString('ko-KR')}
        </span>
        <span className="flex items-center gap-1">
          {isProfit ? <TrendingUp className="w-3 h-3 text-stock-up" /> : <TrendingDown className="w-3 h-3 text-stock-down" />}
          TP: ₩{Math.round((pos.take_profit || 0) * fxRate).toLocaleString('ko-KR')}
        </span>
        {pos.entry_score && score !== null && score !== pos.entry_score && (
          <span className="text-muted-foreground">
            진입 {pos.entry_score}점 → 현재 {score}점
          </span>
        )}
        {isDanger && (
          <span className="text-destructive font-bold animate-pulse">
            ⚠️ 지표 악화 — 조기 매도 검토 중
          </span>
        )}
        {onSelect && (
          <span className="text-primary text-[9px] ml-auto">
            {isSelected ? '▲ 레이더 차트 닫기' : '▼ 클릭하여 레이더 차트 보기'}
          </span>
        )}
      </div>
    </div>
  );
}
