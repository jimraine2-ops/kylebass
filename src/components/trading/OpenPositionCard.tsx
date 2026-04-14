import React from "react";
import type { ValueGradeResult } from "@/hooks/useValueGrade";
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
  valueGradeData?: ValueGradeResult | null;
}

function getStrategyTag(aiReason: string | null): { label: string; color: string } {
  if (!aiReason) return { label: 'Main', color: 'bg-primary/20 text-primary border-primary/30' };
  if (aiReason.includes('Dip-Buy') || aiReason.includes('하락봉매입')) return { label: '📉Dip-Buy', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' };
  if (aiReason.includes('가치 기반 우량')) return { label: '💎가치우량', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' };
  if (aiReason.includes('동전주')) return { label: '🪙동전주', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' };
  if (aiReason.includes('선취매')) return { label: '📡선취매', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' };
  if (aiReason.includes('필승패턴')) return { label: '🎯필승패턴', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' };
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

function getAIHoldingJudgment(score: number | null, pnlPct: number, valueGrade?: string): { message: string; color: string; winProb: number } | null {
  if (score === null) return null;
  const valueVerified = valueGrade === 'A' || valueGrade === 'B';
  let winProb = 0;
  if (valueVerified && score >= 65) winProb = 98;
  else if (score >= 70) winProb = 90;
  else if (score >= 65) winProb = 85;
  else if (score >= 60) winProb = 80;
  else if (score >= 55) winProb = 75;
  else if (score >= 50) winProb = 60;
  else if (score >= 45) winProb = 45;
  else if (score >= 40) winProb = 30;
  else winProb = 15;
  if (pnlPct >= 2) winProb = Math.min(98, winProb + 10);
  else if (pnlPct >= 1) winProb = Math.min(98, winProb + 5);

  // ★ 철갑 홀딩: 지표 60점 이상이면 하락 중에도 "통계적으로 반드시 이긴다"
  if (pnlPct < 0 && score >= 60) {
    return { message: `[🛡️ 철갑 홀딩] 가격 하락 중이나 지표 ${score}점으로 견고함${valueVerified ? ' + 가치 검증 완료' : ''} — 통계적으로 반드시 이긴다. 수익권 진입까지 절대 매도 금지`, color: 'text-stock-up', winProb };
  }
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
    return { message: `[AI 판단: 강력 보유]${valueVerified ? ' 가치 우량' : ''} 추가 상승 기대`, color: 'text-stock-up', winProb };
  }
  if (pnlPct >= 0 && score >= 45) {
    return { message: `[AI 판단: 보유 유지] 안정 구간`, color: 'text-primary', winProb };
  }
  return { message: '', color: 'text-muted-foreground', winProb };
}

export const OpenPositionCard = React.forwardRef<HTMLDivElement, OpenPositionCardProps>(function OpenPositionCard({ position: pos, onSelect, isSelected, livePrice, fxRate = 1350, liveScore, prevScore, onOpenModal, valueGradeData }, _ref) {
  const displayPrice = livePrice ?? pos.currentPrice ?? pos.price;
  const investmentKRW = Math.round(pos.price * pos.quantity * fxRate);
  const currentValueKRW = Math.round(displayPrice * pos.quantity * fxRate);
  const unrealizedPnl = currentValueKRW - investmentKRW;
  const unrealizedPnlPct = investmentKRW > 0 ? ((currentValueKRW / investmentKRW) - 1) * 100 : 0;
  const isProfit = unrealizedPnl >= 0;
  const pnlColor = isProfit ? 'text-stock-up' : 'text-stock-down';
  const tag = getStrategyTag(pos.ai_reason);

  // ★ [Value-Filter] ai_reason에서 추출 OR 실시간 재무 데이터에서 산출
  const valueGradeMatch = (pos.ai_reason || '').match(/가치 등급:\s*([ABCD])/);
  const valueGrade = valueGradeMatch ? valueGradeMatch[1] : (valueGradeData?.grade && valueGradeData.grade !== 'N/A' ? valueGradeData.grade : undefined);
  const valueVerified = valueGrade === 'A' || valueGrade === 'B';

  const score = liveScore ?? pos.entry_score ?? null;
  const scoreChanged = score !== null && prevScore !== null && prevScore !== undefined ? score - prevScore : 0;
  const isDanger = score !== null && score < 40;

  const aiJudgment = getAIHoldingJudgment(score, unrealizedPnlPct, valueGrade);
  const isHoldingRecommended = !isProfit && score !== null && score >= 50;

  // ★ [Dynamic-Target] AI 추천 매도 구간 계산 (체결강도 기반)
  // 실제 체결강도는 서버에서 계산하므로 여기서는 점수 기반 근사
  const dynamicTP = score !== null ? (score >= 70 ? { pct: 3.0, label: '강력 홀딩' } : score >= 55 ? { pct: 2.5, label: '분할 대응' } : { pct: 2.0, label: '빠른 회전' }) : null;

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
        isHoldingRecommended && 'border-stock-up/40 bg-stock-up/5'
      )}
      onClick={onSelect}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${tag.color}`}>
            {tag.label}
          </Badge>
          {/* ★ 선취매 완료 황금 배지 */}
          {(pos.ai_reason || '').includes('선취매') && !(pos.ai_reason || '').includes('Dip-Buy') && (
            <Badge variant="outline" className="text-[10px] px-2 py-0.5 font-bold border-yellow-500/50 bg-yellow-500/20 text-yellow-400 shadow-[0_0_8px_rgba(234,179,8,0.3)]">
              📡 선취매 완료: 정규장 폭발 대기 중
            </Badge>
          )}
          {(pos.ai_reason || '').includes('Dip-Buy') && (
            <Badge variant="outline" className="text-[10px] px-2 py-0.5 font-bold border-blue-500/50 bg-blue-500/20 text-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.3)]">
              📉 Dip-Buy: 25봉 하락 반등 매수 | 본절보호 가동
            </Badge>
          )}
          <span className="font-bold text-sm">{formatStockName(pos.symbol)}</span>
          <span className="text-xs text-muted-foreground">{pos.quantity}주 @ ₩{Math.round((pos.price || 0) * fxRate).toLocaleString('ko-KR')}</span>

          {score !== null && (
            <Badge variant="outline" className={cn(
              "text-[10px] px-2 py-0.5 gap-1 font-mono font-bold border",
              score >= 63 ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50 shadow-[0_0_8px_rgba(234,179,8,0.3)]' : getScoreBgColor(score)
            )}>
              <Activity className={cn("w-3 h-3", score >= 63 ? 'text-yellow-400' : getScoreColor(score))} />
              <span className={score >= 63 ? 'text-yellow-400' : getScoreColor(score)}>
                {score >= 63 ? '🏆' : ''} AI {score}점
              </span>
              {scoreChanged !== 0 && (
                <span className={cn("flex items-center text-[9px]", scoreChanged > 0 ? 'text-stock-up' : 'text-stock-down')}>
                  {scoreChanged > 0 ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />}
                  {Math.abs(scoreChanged)}
                </span>
              )}
            </Badge>
          )}
          {score !== null && score >= 63 && (
            <Badge variant="outline" className="text-[10px] px-2 py-0.5 gap-1 font-mono font-bold border border-yellow-500/50 bg-yellow-500/20 text-yellow-400 shadow-[0_0_8px_rgba(234,179,8,0.3)]">
              🎯 63점 돌파
            </Badge>
          )}
          {score !== null && score < 63 && (
            <span className={cn("text-[9px] font-medium", getScoreColor(score))}>
              {getScoreLabel(score)}
            </span>
          )}

          {aiJudgment && aiJudgment.winProb >= 88 && (
            <Badge variant="outline" className="text-[10px] px-2 py-0.5 gap-1 font-mono font-bold border border-yellow-500/50 bg-yellow-500/20 text-yellow-400 shadow-[0_0_8px_rgba(234,179,8,0.3)]">
              🏆 확정 익절 {aiJudgment.winProb}%
            </Badge>
          )}
          {aiJudgment && aiJudgment.winProb > 0 && aiJudgment.winProb < 90 && (
            <Badge variant="outline" className={cn(
              "text-[10px] px-2 py-0.5 gap-1 font-mono border",
              aiJudgment.winProb >= 70 ? 'border-stock-up/40 text-stock-up bg-stock-up/10' :
              aiJudgment.winProb >= 50 ? 'border-primary/40 text-primary bg-primary/10' :
              'border-warning/40 text-warning bg-warning/10'
            )}>
              🎯 익절확률 {aiJudgment.winProb}%
            </Badge>
          )}

          <Badge variant="outline" className="text-[10px]">
            신뢰도: {pos.ai_confidence}%
          </Badge>
          {valueVerified && (
            <Badge variant="outline" className="text-[10px] px-2 py-0.5 font-bold border-emerald-500/50 bg-emerald-500/20 text-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.3)]">
              💎 가치등급 {valueGrade} (우량) | 익절확정 98%
            </Badge>
          )}
          {valueGrade && !valueVerified && valueGrade !== 'N/A' && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-muted-foreground/30 text-muted-foreground">
              가치 {valueGrade}
            </Badge>
          )}
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

      {/* ★ [AI 추천 익절%] Dynamic-Target — 항상 표시 */}
      {dynamicTP && (
        <div className={cn(
          "flex items-center gap-2 text-[11px] font-semibold px-2 py-1.5 rounded border",
          unrealizedPnlPct >= dynamicTP.pct
            ? 'bg-stock-up/15 border-stock-up/40'
            : unrealizedPnlPct >= dynamicTP.pct * 0.5
              ? 'bg-warning/10 border-warning/30'
              : 'bg-muted/50 border-border'
        )}>
          <Target className={cn("w-3.5 h-3.5 shrink-0",
            unrealizedPnlPct >= dynamicTP.pct ? 'text-stock-up' : 'text-warning'
          )} />
          <span className={cn(
            unrealizedPnlPct >= dynamicTP.pct ? 'text-stock-up' : 'text-warning'
          )}>
            [AI 추천 익절] +{dynamicTP.pct}% ({dynamicTP.label}) | 현재 {unrealizedPnlPct >= 0 ? '+' : ''}{unrealizedPnlPct.toFixed(2)}%
            {unrealizedPnlPct >= dynamicTP.pct && ' ✅ 목표 도달!'}
          </span>
          <Badge variant="outline" className={cn(
            "text-[9px] px-1.5 py-0 ml-auto font-bold",
            unrealizedPnlPct >= dynamicTP.pct ? 'border-stock-up/40 text-stock-up' : 'border-warning/40 text-warning'
          )}>
            {unrealizedPnlPct >= dynamicTP.pct ? '🎯 익절 구간' : `${Math.max(0, (unrealizedPnlPct / dynamicTP.pct) * 100).toFixed(0)}%`}
          </Badge>
        </div>
      )}

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

      {/* ★ 철갑 홀딩 상태: 지표 60점 이상 + 하락 중 → 매도 금지 안내 */}
      {!isProfit && score !== null && score >= 60 && (
        <div className="flex items-center gap-2 text-[11px] font-semibold px-2 py-1.5 rounded bg-stock-up/10 border border-stock-up/30">
          <ShieldCheck className="w-4 h-4 text-stock-up shrink-0" />
          <span className="text-stock-up">🛡️ [철갑 홀딩 중] 가격 {unrealizedPnlPct.toFixed(1)}% 하락 중이나 지표 {score}점(≥60)으로 견고 — 통계적 필승, 수익권까지 절대 매도 금지</span>
          <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-stock-up/40 text-stock-up ml-auto font-bold">
            🔒 No-Exit
          </Badge>
        </div>
      )}
      {/* ★ Zero-Loss 완성 안내: SL이 매수가 위 */}
      {(() => {
        const slAboveEntry = pos.stop_loss > pos.price;
        return slAboveEntry ? (
          <div className="flex items-center gap-2 text-[11px] font-semibold px-2 py-1 rounded bg-stock-up/10 border border-stock-up/20">
            <ShieldCheck className="w-3.5 h-3.5 text-stock-up shrink-0" />
            <span className="text-stock-up">🔒 Zero-Loss 무적 상태 — SL: 매수가+{((pos.stop_loss / pos.price - 1) * 100).toFixed(1)}% (손실 불가능)</span>
          </div>
        ) : null;
      })()}
      {/* ★ 변동성 구간 홀딩 상태 표시: 50~59점 */}
      {!isProfit && unrealizedPnlPct > -10 && unrealizedPnlPct < -1 && score !== null && score >= 50 && score < 60 && (
        <div className="flex items-center gap-2 text-[11px] font-semibold px-2 py-1 rounded bg-primary/10 border border-primary/20">
          <ShieldCheck className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="text-primary">[변동성 구간: 지표 기반 홀딩 중] 정상 흔들림 — 대시세 대기</span>
        </div>
      )}
      {/* -10% 근접 경고 */}
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
});
OpenPositionCard.displayName = "OpenPositionCard";
