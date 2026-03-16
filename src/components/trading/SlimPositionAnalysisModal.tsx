import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatStockName } from "@/lib/koreanStockMap";
import { Activity, BarChart3, TrendingUp, TrendingDown, Zap, Volume2, RefreshCw } from "lucide-react";
import { usePositionQuant } from "@/hooks/usePositionQuant";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip as RechartsTooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell,
} from "recharts";

const INDICATOR_LABELS: Record<string, { label: string; unit: string }> = {
  sentiment: { label: '호재 감성', unit: '%' },
  rvol: { label: '상대 거래량', unit: 'x' },
  candle: { label: 'VWAP/캔들', unit: '' },
  macd: { label: 'MACD', unit: '' },
  atr: { label: 'ATR', unit: '' },
  gap: { label: '갭 분석', unit: '%' },
  squeeze: { label: '숏 스퀴즈', unit: '' },
  position: { label: '가격 위치', unit: '%' },
  sectorSynergy: { label: '섹터 동조', unit: '' },
  aggression: { label: '체결 강도', unit: '%' },
  preMarket: { label: '프리마켓', unit: '' },
};

function formatTurnoverKRW(krw: number): string {
  if (!krw || !isFinite(krw) || krw <= 0) return '-';
  const eok = Math.floor(krw / 1_0000_0000);
  const man = Math.floor((krw % 1_0000_0000) / 10000);
  if (eok > 0 && man > 0) return `${eok.toLocaleString('ko-KR')}억 ${man.toLocaleString('ko-KR')}만 원`;
  if (eok > 0) return `${eok.toLocaleString('ko-KR')}억 원`;
  if (man > 0) return `${man.toLocaleString('ko-KR')}만 원`;
  return `${Math.round(krw).toLocaleString('ko-KR')} 원`;
}

function getScoreColor(score: number): string {
  if (score >= 55) return 'text-[hsl(var(--stock-up))]';
  if (score >= 45) return 'text-primary';
  if (score >= 35) return 'text-warning';
  return 'text-destructive';
}

interface SlimPositionAnalysisModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  position: any;
  quantStock: any;
  livePrice?: number | null;
  liveScore?: number | null;
  fxRate?: number;
}

export function SlimPositionAnalysisModal({
  open, onOpenChange, position: pos, quantStock: externalQuantStock, livePrice, liveScore, fxRate = 1350,
}: SlimPositionAnalysisModalProps) {
  const { data: fetchedQuant, isLoading: quantLoading, isFetching } = usePositionQuant(
    open && pos ? pos.symbol : null
  );

  if (!pos) return null;

  const quantStock = fetchedQuant || externalQuantStock;
  const displayPrice = livePrice ?? pos.currentPrice ?? pos.price;
  const score = liveScore ?? quantStock?.totalScore ?? pos.entry_score ?? 0;
  const indicators = quantStock?.indicators || {};
  const hasIndicators = Object.keys(indicators).length > 0;

  // Radar data
  const radarData = Object.entries(INDICATOR_LABELS).map(([key, meta]) => ({
    indicator: meta.label,
    score: indicators[key]?.score || 0,
    fullMark: 10,
  }));

  // Volume
  const rvolData = indicators.rvol || {};
  const rvol = rvolData.rvol || rvolData.rawValue || 1;
  const realCurrentVol = quantStock?.currentVol || rvolData.currentVol || 0;
  const realAvgVol = quantStock?.avgVol || rvolData.avgVol || 0;
  const aggressionScore = indicators.aggression?.score || 5;
  const buyPressure = Math.min(100, Math.round(aggressionScore * 10 + 5));
  const sellPressure = 100 - buyPressure;

  const estimatedVolume = realCurrentVol > 0 ? realCurrentVol : Math.round(rvol * (realAvgVol > 0 ? realAvgVol : 2500000));
  const turnoverUSD = displayPrice > 0 && estimatedVolume > 0 ? displayPrice * estimatedVolume : 0;
  const turnoverKRW = turnoverUSD * fxRate;

  // PnL
  const investmentKRW = Math.round(pos.price * pos.quantity * fxRate);
  const currentValueKRW = Math.round(displayPrice * pos.quantity * fxRate);
  const unrealizedPnl = currentValueKRW - investmentKRW;
  const unrealizedPnlPct = investmentKRW > 0 ? ((currentValueKRW / investmentKRW) - 1) * 100 : 0;
  const isProfit = unrealizedPnl >= 0;

  // Volume bars
  const avgVolume = realAvgVol > 0 ? Math.round(realAvgVol) : Math.round(estimatedVolume / Math.max(rvol, 0.01));
  const volumeBarData = [
    { name: '전일', volume: avgVolume, fill: 'hsl(var(--muted-foreground))' },
    { name: '금일', volume: estimatedVolume, fill: rvol >= 2 ? 'hsl(var(--stock-up))' : 'hsl(var(--primary))' },
  ];

  // Indicator bars sorted by score desc
  const indicatorBars = Object.entries(INDICATOR_LABELS)
    .map(([key, meta]) => ({
      key,
      label: meta.label,
      score: indicators[key]?.score || 0,
    }))
    .sort((a, b) => b.score - a.score);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-[95vw] max-h-[95vh] overflow-y-auto border-primary/20 bg-card p-4">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="w-4 h-4 text-primary" />
            {formatStockName(pos.symbol)}
            <Badge variant="outline" className={cn("font-mono text-sm ml-auto", getScoreColor(score))}>
              AI {score}점
            </Badge>
            {isFetching && <RefreshCw className="w-3 h-3 text-muted-foreground animate-spin" />}
          </DialogTitle>
        </DialogHeader>

        {/* Turnover Hero */}
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-3 text-center">
            <p className="text-[10px] text-muted-foreground">💰 실시간 거래대금</p>
            <p className="text-2xl font-black font-mono text-primary leading-tight">
              {turnoverKRW > 0 ? formatTurnoverKRW(turnoverKRW) : '-'}
            </p>
            <p className="text-[10px] text-muted-foreground">
              ${turnoverUSD > 0 ? `${(turnoverUSD / 1000000).toFixed(2)}M` : '-'} · RVOL {rvol.toFixed(1)}x
            </p>
          </CardContent>
        </Card>

        {/* PnL Summary */}
        <div className="grid grid-cols-2 gap-2">
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-[10px] text-muted-foreground">현재가 {livePrice ? '🟢' : ''}</p>
              <p className="text-lg font-bold font-mono">₩{Math.round(displayPrice * fxRate).toLocaleString('ko-KR')}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-[10px] text-muted-foreground">미실현 PnL</p>
              <p className={cn("text-lg font-bold font-mono", isProfit ? 'text-[hsl(var(--stock-up))]' : 'text-[hsl(var(--stock-down))]')}>
                {isProfit ? '+' : ''}{unrealizedPnlPct.toFixed(2)}%
              </p>
              <p className={cn("text-[10px] font-mono", isProfit ? 'text-[hsl(var(--stock-up))]' : 'text-[hsl(var(--stock-down))]')}>
                {isProfit ? '+' : ''}₩{unrealizedPnl.toLocaleString()}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Radar Chart - Large */}
        <Card className="border-primary/20">
          <CardContent className="p-3">
            <p className="text-xs font-semibold mb-1 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-primary" />
              10대 지표 레이더
            </p>
            {quantLoading && !hasIndicators ? (
              <div className="h-[260px] flex items-center justify-center">
                <RefreshCw className="w-5 h-5 text-primary animate-spin" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis dataKey="indicator" tick={{ fontSize: 8, fill: 'hsl(var(--muted-foreground))' }} />
                  <PolarRadiusAxis angle={30} domain={[0, 10]} tick={{ fontSize: 7 }} />
                  <Radar
                    name="점수"
                    dataKey="score"
                    stroke={score >= 55 ? 'hsl(var(--stock-up))' : score >= 35 ? 'hsl(var(--primary))' : 'hsl(var(--destructive))'}
                    fill={score >= 55 ? 'hsl(var(--stock-up))' : score >= 35 ? 'hsl(var(--primary))' : 'hsl(var(--destructive))'}
                    fillOpacity={0.3}
                    strokeWidth={2}
                    isAnimationActive={true}
                    animationDuration={600}
                  />
                  <RechartsTooltip
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }}
                    formatter={(value: number) => [`${value}/10`, '점수']}
                  />
                </RadarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Indicator Bars - Compact */}
        <div className="space-y-1">
          {indicatorBars.map(({ key, label, score: s }) => (
            <div key={key} className="flex items-center gap-2 text-[10px]">
              <span className="w-16 shrink-0 truncate text-muted-foreground">{label}</span>
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    s >= 8 ? 'bg-[hsl(var(--stock-up))]' : s >= 5 ? 'bg-primary' : s >= 3 ? 'bg-warning' : 'bg-destructive'
                  )}
                  style={{ width: `${(s / 10) * 100}%` }}
                />
              </div>
              <span className={cn("w-6 text-right font-mono font-bold",
                s >= 8 ? 'text-[hsl(var(--stock-up))]' : s >= 5 ? 'text-primary' : s >= 3 ? 'text-warning' : 'text-destructive'
              )}>
                {s}
              </span>
            </div>
          ))}
        </div>

        {/* Buy/Sell Pressure */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-[hsl(var(--stock-up))] font-semibold flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> 매수 {buyPressure}%
            </span>
            <span className="text-[hsl(var(--stock-down))] font-semibold flex items-center gap-1">
              매도 {sellPressure}% <TrendingDown className="w-3 h-3" />
            </span>
          </div>
          <div className="w-full h-3 rounded-full overflow-hidden flex">
            <div className="h-full bg-[hsl(var(--stock-up))] transition-all duration-700" style={{ width: `${buyPressure}%` }} />
            <div className="h-full bg-[hsl(var(--stock-down))] transition-all duration-700" style={{ width: `${sellPressure}%` }} />
          </div>
        </div>

        {/* Entry Info */}
        <div className="flex items-center gap-3 text-[9px] text-muted-foreground pt-2 border-t border-border flex-wrap">
          <span>진입 ₩{Math.round(pos.price * fxRate).toLocaleString('ko-KR')}</span>
          <span>수량 {pos.quantity}주</span>
          <span>SL ₩{Math.round((pos.stop_loss || 0) * fxRate).toLocaleString('ko-KR')}</span>
          <span>TP ₩{Math.round((pos.take_profit || 0) * fxRate).toLocaleString('ko-KR')}</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
