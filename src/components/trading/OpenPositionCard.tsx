import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, TrendingDown, Shield, ArrowUp, ArrowDown, Activity, Radar, ShieldCheck, Target } from "lucide-react";
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
  if (aiReason.includes('15%') || aiReason.includes('슈퍼')) return { label: '🎯15%', color: 'bg-warning/20 text-warning border-warning/30' };
  if (aiReason.startsWith('[Quant]')) return { label: 'Quant', color: 'bg-stock-up/20 text-stock-up border-stock-up/30' };
  if (aiReason.startsWith('[Scalp]')) return { label: 'Scalp', color: 'bg-warning/20 text-warning border-warning/30' };
  return { label: 'Main', color: 'bg-primary/20 text-primary border-primary/30' };
}

function getScoreColor(score: number): string {
  if (score >= 55) return 'text-stock-up';
  if (score >= 45) return 'text-primary';
  if (score >= 35) return 'text-warning';
  return 'text-destructive';
}

function getScoreBgColor(score: number): string {
  if (score >= 55) return 'bg-stock-up/15 border-stock-up/40';
  if (score >= 45) return 'bg-primary/15 border-primary/40';
  if (score >= 35) return 'bg-warning/15 border-warning/40';
  return 'bg-destructive/15 border-destructive/40';
}

function getScoreLabel(score: number): string {
  if (score >= 55) return '강력 보유';
  if (score >= 45) return '보유 유지';
  if (score >= 35) return '주의';
  return '매도 검토';
}

function parseWinProbability(aiReason: string | null): number | null {
  if (!aiReason) return null;
  const match = aiReason.match(/\[예상 익절 확률:\s*(\d+)%\]/) || aiReason.match(/\[AI 승률 예측:\s*(\d+)%\]/);
  return match ? parseInt(match[1]) : null;
}

function parseWinReasons(aiReason: string | null): string[] {
  if (!aiReason) return [];
  const probMatch = aiReason.match(/\[예상 익절 확률:\s*\d+%\]\s*\[([^\]]+)\]/) || aiReason.match(/\[AI 승률 예측:\s*\d+%\]\s*\[([^\]]+)\]/);
  if (!probMatch) return [];
  return probMatch[1].split('+').filter(Boolean);
}

function getAIHoldingJudgment(score: number | null, pnlPct: number): { message: string; color: string; winProb: number } | null {
  if (score === null) return null;
  let winProb = 0;
  if (score >= 70) winProb = 90;
  else if (score >= 65) winProb = 85;
  else if (score >= 60) winProb = 80;
  else if (score >= 55) winProb = 75;
  else if (score >= 50) winProb = 60;
  else if (score >= 45) winProb = 45;
  else if (score >= 40) winProb = 30;
  else winProb = 15;
  if (pnlPct >= 2) winProb = Math.min(98, winProb + 10);
  else if (pnlPct >= 1) winProb = Math.min(95, winProb + 5);

  if (pnlPct < 0 && score >= 50) {
    return { message: `[AI 판단: 홀딩 권장 - 지표 양호] 눌림목 구간, 반등 대기`, color: 'text-stock-up', winProb };
  }
  if (pnlPct < 0 && score >= 40 && score < 50) {
    return { message: `[AI 판단: 주의 관찰 중] 지표 약화, 추세 감시`, color: 'text-warning', winProb };
  }
  if (pnlPct < 0 && score < 40) {
    return { message: `[AI 판단: 매도 검토] 추세 이탈 위험`, color: 'text-destructive', winProb };
  }
  if (pnlPct >= 0 && score >= 55) {
    return { message: `[AI 판단: 강력 보유] 추가 상승 기대`, color: 'text-stock-up', winProb };
  }
  if (pnlPct >= 0 && score >= 45) {
    return { message: `[AI 판단: 보유 유지] 안정 구간`, color: 'text-primary', winProb };
  }
  return { message: '', color: 'text-muted-foreground', winProb };
}

export function OpenPositionCard({ position: pos, onSelect, isSelected, livePrice, fxRate = 1350, liveScore, prevScore, onOpenModal }: OpenPositionCardProps) {
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

  const aiJudgment = getAIHoldingJudgment(score, unrealizedPnlPct);
  const isHoldingRecommended = !isProfit && score !== null && score >= 50;

  // ★ 익절 확률 파싱
  const winProb = parseWinProbability(pos.ai_reason);
  const is90ProbEntry = winProb !== null && winProb >= 90;

  // ★ 15% 목표가 & 진행률 계산
  const isSuperTarget = (pos.ai_reason || '').includes('15%') || (pos.ai_reason || '').includes('슈퍼');
  const targetPct = isSuperTarget ? 15 : (pos.take_profit && pos.price > 0)
    ? ((pos.take_profit - pos.price) / pos.price * 100)
    : 5;
  const targetProgress = targetPct > 0 ? Math.min(100, Math.max(0, (unrealizedPnlPct / targetPct) * 100)) : 0;
  const targetPriceKRW = Math.round(pos.price * (1 + targetPct / 100) * fxRate);

  return (
    <div
      className={cn(
        "p-3 rounded-lg bg-muted/50 border space-y-2 transition-all",
        onSelect && 'cursor-pointer hover:border-primary/40',
        isSelected ? 'border-primary ring-1 ring-primary/20' : 'border-border',
        isDanger && 'animate-pulse border-destructive/60 bg-destructive/5',
        isHoldingRecommended && 'border-stock-up/40 bg-stock-up/5',
        is90ProbEntry && !isDanger && 'border-amber-500/60 ring-1 ring-amber-500/20 bg-amber-500/5'
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

          {aiJudgment && aiJudgment.winProb > 0 && (
            <Badge variant="outline" className={cn(
              "text-[10px] px-2 py-0.5 gap-1 font-mono border",
              aiJudgment.winProb >= 70 ? 'border-stock-up/40 text-stock-up bg-stock-up/10' :
              aiJudgment.winProb >= 50 ? 'border-primary/40 text-primary bg-primary/10' :
              'border-warning/40 text-warning bg-warning/10'
            )}>
              🎯 익절확률 {aiJudgment.winProb}%
            </Badge>
          )}

          {(() => {
            const winProb = parseWinProbability(pos.ai_reason);
            if (winProb && winProb >= 90) {
              return (
                <Badge className="text-[10px] px-2 py-0.5 gap-1 bg-gradient-to-r from-amber-500 to-yellow-400 text-black border-amber-500/50 font-bold shadow-sm shadow-amber-500/30">
                  🏆 익절확률 {winProb}%
                </Badge>
              );
            }
            if (winProb && winProb >= 70) {
              return (
                <Badge variant="outline" className="text-[10px] px-2 py-0.5 gap-1 border-amber-500/40 text-amber-500 font-mono">
                  🎯 익절확률 {winProb}%
                </Badge>
              );
            }
            return null;
          })()}

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

      {/* ★ 목표가 진행률 게이지 */}
      <div className="flex items-center gap-2">
        <Target className={cn("w-3.5 h-3.5 shrink-0", isSuperTarget ? 'text-warning' : 'text-primary')} />
        <div className="flex-1">
          <div className="flex items-center justify-between text-[10px] mb-0.5">
            <span className={cn("font-semibold", isSuperTarget ? 'text-warning' : 'text-muted-foreground')}>
              {isSuperTarget ? '🎯 15% 슈퍼 타겟' : `목표 +${targetPct.toFixed(1)}%`}
            </span>
            <span className="text-muted-foreground font-mono">
              ₩{targetPriceKRW.toLocaleString('ko-KR')} | {unrealizedPnlPct.toFixed(1)}% / {targetPct.toFixed(1)}%
            </span>
          </div>
          <Progress
            value={targetProgress}
            className={cn("h-2", isSuperTarget ? '[&>div]:bg-warning' : '[&>div]:bg-primary')}
          />
        </div>
        <span className={cn("text-[10px] font-bold font-mono min-w-[40px] text-right",
          targetProgress >= 100 ? 'text-stock-up' : targetProgress >= 50 ? 'text-warning' : 'text-muted-foreground'
        )}>
          {targetProgress.toFixed(0)}%
        </span>
      </div>

      {/* AI 홀딩 판단 메시지 */}
      {aiJudgment && aiJudgment.message && (
        <div className={cn("flex items-center gap-2 text-[11px] font-semibold px-2 py-1 rounded",
          isHoldingRecommended ? 'bg-stock-up/10' : isDanger ? 'bg-destructive/10' : 'bg-muted'
        )}>
          {isHoldingRecommended ? (
            <ShieldCheck className="w-3.5 h-3.5 text-stock-up shrink-0" />
          ) : isDanger ? (
            <Shield className="w-3.5 h-3.5 text-destructive shrink-0" />
          ) : (
            <ShieldCheck className="w-3.5 h-3.5 text-primary shrink-0" />
          )}
          <span className={aiJudgment.color}>{aiJudgment.message}</span>
        </div>
      )}

      {/* ★ 변동성 구간 홀딩 상태 표시: -1%~-9% 하락 + 지표 50점 이상 */}
      {!isProfit && unrealizedPnlPct > -10 && unrealizedPnlPct < -1 && score !== null && score >= 50 && (
        <div className="flex items-center gap-2 text-[11px] font-semibold px-2 py-1 rounded bg-primary/10 border border-primary/20">
          <ShieldCheck className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="text-primary">[변동성 구간: 지표 기반 홀딩 중] 정상 흔들림 — 대시세 대기</span>
          <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-primary/30 text-primary ml-auto">
            손절 기준: -10%
          </Badge>
        </div>
      )}
      {/* -9%~-10% 근접 경고 */}
      {!isProfit && unrealizedPnlPct <= -10 && score !== null && score >= 50 && (
        <div className="flex items-center gap-2 text-[11px] font-semibold px-2 py-1 rounded bg-warning/10 border border-warning/20">
          <Shield className="w-3.5 h-3.5 text-warning shrink-0" />
          <span className="text-warning">[⚠️ -10% 도달] 지표 {score}점(≥50) 양호 — 수급 기반 홀딩 유지 중</span>
        </div>
      )}

      <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
        {(() => {
          const slPct = pos.price > 0 ? ((pos.stop_loss || 0) / pos.price - 1) * 100 : 0;
          const tpPct = pos.price > 0 ? ((pos.take_profit || 0) / pos.price - 1) * 100 : 0;
          const slAboveEntry = slPct > 0;
          return (
            <>
              <span className="flex items-center gap-1">
                <Shield className={cn("w-3 h-3", slAboveEntry ? 'text-stock-up' : 'text-destructive')} />
                SL: ₩{Math.round((pos.stop_loss || 0) * fxRate).toLocaleString('ko-KR')}
                <span className={cn("font-mono font-bold", slAboveEntry ? 'text-stock-up' : 'text-destructive')}>
                  ({slPct >= 0 ? '+' : ''}{slPct.toFixed(1)}%)
                </span>
              </span>
              <span className="flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-stock-up" />
                TP: ₩{Math.round((pos.take_profit || 0) * fxRate).toLocaleString('ko-KR')}
                <span className="text-stock-up font-mono font-bold">(+{tpPct.toFixed(0)}%)</span>
              </span>
            </>
          );
        })()}
        {pos.entry_score && score !== null && score !== pos.entry_score && (
          <span className="text-muted-foreground">
            진입 {pos.entry_score}점 → 현재 {score}점
          </span>
        )}
        {isDanger && (
          <span className="text-destructive font-bold animate-pulse">
            ⚠️ 지표 추세 이탈 — 40점 미만 시 자동 매도
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {onOpenModal && (
            <Button
              variant="outline"
              size="sm"
              className="h-5 px-2 text-[9px] gap-1 border-primary/30 text-primary hover:bg-primary/10"
              onClick={(e) => { e.stopPropagation(); onOpenModal(); }}
            >
              <Radar className="w-3 h-3" />
              레이더 차트
            </Button>
          )}
          {onSelect && (
            <span className="text-primary text-[9px] cursor-pointer">
              {isSelected ? '▲ 닫기' : '▼ 상세'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
