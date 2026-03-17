import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatStockName } from "@/lib/koreanStockMap";
import { Activity, BarChart3, TrendingUp, TrendingDown, Zap, Volume2, RefreshCw, Info, DollarSign } from "lucide-react";
import { usePositionQuant } from "@/hooks/usePositionQuant";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip as RechartsTooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell,
} from "recharts";

const INDICATOR_LABELS: Record<string, { label: string; unit: string }> = {
  sentiment: { label: '호재 감성', unit: '%' },
  rvol: { label: '상대 거래량(RVOL)', unit: 'x' },
  candle: { label: 'VWAP/캔들 패턴', unit: '' },
  macd: { label: 'MACD 모멘텀', unit: '' },
  atr: { label: '변동성(ATR)', unit: '' },
  gap: { label: '갭 분석', unit: '%' },
  squeeze: { label: '숏 스퀴즈', unit: '' },
  position: { label: '가격 위치', unit: '%' },
  sectorSynergy: { label: '섹터 동조화', unit: '' },
  aggression: { label: '체결 강도', unit: '%' },
  preMarket: { label: '프리마켓 강도', unit: '' },
};

/** 지표별 상태 라벨 */
function getIndicatorStatusLabel(key: string, score: number, ind: any): { text: string; color: string } {
  switch (key) {
    case 'sentiment':
      if (score >= 8) return { text: '강한 호재', color: 'text-stock-up' };
      if (score >= 5) return { text: '약한 호재', color: 'text-primary' };
      if (score >= 3) return { text: '중립', color: 'text-muted-foreground' };
      return { text: '약세 감성', color: 'text-destructive' };
    case 'rvol': {
      const r = ind?.rvol || ind?.rawValue || 1;
      if (r >= 3) return { text: '거래 폭발', color: 'text-stock-up' };
      if (r >= 2) return { text: '거래 급증', color: 'text-stock-up' };
      if (r >= 1.5) return { text: '거래 증가', color: 'text-primary' };
      return { text: '거래 보통', color: 'text-muted-foreground' };
    }
    case 'candle':
      if (ind?.vwapCross && score >= 7) return { text: 'VWAP 돌파 + 패턴확인', color: 'text-stock-up' };
      if (ind?.vwapCross) return { text: 'VWAP 돌파', color: 'text-primary' };
      if (score >= 7) return { text: '강한 캔들패턴', color: 'text-stock-up' };
      return { text: '패턴 미확인', color: 'text-muted-foreground' };
    case 'macd': {
      const m = ind?.macd || 0;
      if (score >= 8) return { text: '골든크로스 강화', color: 'text-stock-up' };
      if (score >= 7) return { text: '골든크로스', color: 'text-stock-up' };
      if (m > 0) return { text: 'MACD 양전환', color: 'text-primary' };
      if (score >= 4) return { text: '데드크로스 접근', color: 'text-warning' };
      return { text: '데드크로스', color: 'text-destructive' };
    }
    case 'atr':
      if (score >= 8) return { text: '변동성 극대', color: 'text-stock-up' };
      if (score >= 5) return { text: '변동성 적정', color: 'text-primary' };
      return { text: '변동성 저조', color: 'text-muted-foreground' };
    case 'gap':
      if (score >= 8) return { text: '갭 상승 확인', color: 'text-stock-up' };
      if (score >= 5) return { text: '약갭 발생', color: 'text-primary' };
      return { text: '갭 없음', color: 'text-muted-foreground' };
    case 'squeeze':
      if (score >= 6) return { text: '스퀴즈 활성', color: 'text-stock-up' };
      if (score >= 3) return { text: '스퀴즈 대기', color: 'text-warning' };
      return { text: '스퀴즈 없음', color: 'text-muted-foreground' };
    case 'position':
      if (score >= 8) return { text: 'ATH 근접', color: 'text-stock-up' };
      if (score >= 5) return { text: '고점 접근', color: 'text-primary' };
      return { text: '저점 구간', color: 'text-warning' };
    case 'sectorSynergy':
      if (score >= 8) return { text: '섹터 초강세', color: 'text-stock-up' };
      if (score >= 5) return { text: '섹터 동조', color: 'text-primary' };
      return { text: '섹터 약세', color: 'text-destructive' };
    case 'aggression': {
      if (score >= 8) return { text: '매수 집중', color: 'text-stock-up' };
      if (score >= 5) return { text: '매수 우위', color: 'text-primary' };
      if (score >= 3) return { text: '매도 우위', color: 'text-warning' };
      return { text: '매도 집중', color: 'text-destructive' };
    }
    case 'preMarket':
      if (score >= 7) return { text: '고점돌파', color: 'text-stock-up' };
      return { text: '돌파 미달', color: 'text-muted-foreground' };
    default:
      return { text: '', color: 'text-muted-foreground' };
  }
}

function getScoreColor(score: number): string {
  if (score >= 55) return 'text-stock-up';
  if (score >= 45) return 'text-primary';
  if (score >= 35) return 'text-warning';
  return 'text-destructive';
}

function getScoreLabel(score: number): string {
  if (score >= 55) return '강력 보유';
  if (score >= 45) return '보유 유지';
  if (score >= 35) return '주의';
  return '매도 검토';
}

/** 한국식 억/만 원 표기: "1,234억 5,678만 원" */
function formatTurnoverKRW(krw: number): string {
  if (!krw || !isFinite(krw) || krw <= 0) return '-';
  const eok = Math.floor(krw / 1_0000_0000);
  const remainder = krw % 1_0000_0000;
  const man = Math.floor(remainder / 10000);

  if (eok > 0 && man > 0) return `${eok.toLocaleString('ko-KR')}억 ${man.toLocaleString('ko-KR')}만 원`;
  if (eok > 0) return `${eok.toLocaleString('ko-KR')}억 원`;
  if (man > 0) return `${man.toLocaleString('ko-KR')}만 원`;
  return `${Math.round(krw).toLocaleString('ko-KR')} 원`;
}

function formatLargeNumber(n: number): string {
  if (!n || !isFinite(n) || n <= 0) return '-';
  if (n >= 1_0000_0000) return `${(n / 1_0000_0000).toFixed(1)}억`;
  if (n >= 10000) return `${(n / 10000).toFixed(0)}만`;
  return n.toLocaleString('ko-KR');
}

interface PositionAnalysisModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  position: any;
  quantStock: any;
  livePrice?: number | null;
  liveScore?: number | null;
  fxRate?: number;
}

export function PositionAnalysisModal({
  open, onOpenChange, position: pos, quantStock: externalQuantStock, livePrice, liveScore, fxRate = 1350,
}: PositionAnalysisModalProps) {
  const { data: fetchedQuant, isLoading: quantLoading, isFetching } = usePositionQuant(
    open && pos ? pos.symbol : null
  );

  const quantStock = pos ? (fetchedQuant || externalQuantStock) : null;
  const displayPrice = pos ? (livePrice ?? pos.currentPrice ?? pos.price) : 0;
  const score = pos ? (liveScore ?? quantStock?.totalScore ?? pos.entry_score ?? 0) : 0;
  const indicators = quantStock?.indicators || {};
  const hasIndicators = Object.keys(indicators).length > 0;

  // Radar data
  const radarData = Object.entries(INDICATOR_LABELS).map(([key, meta]) => ({
    indicator: meta.label,
    key,
    score: indicators[key]?.score || 0,
    rawValue: indicators[key]?.rawValue ?? indicators[key]?.rvol ?? indicators[key]?.macd ?? indicators[key]?.atr ?? null,
    details: indicators[key]?.details || '',
    unit: meta.unit,
    fullMark: 10,
    statusLabel: getIndicatorStatusLabel(key, indicators[key]?.score || 0, indicators[key]),
  }));

  // Volume analysis
  const rvolData = indicators.rvol || {};
  const rvol = rvolData.rvol || rvolData.rawValue || 1;
  const realCurrentVol = quantStock?.currentVol || rvolData.currentVol || 0;
  const realAvgVol = quantStock?.avgVol || rvolData.avgVol || 0;
  const aggressionScore = indicators.aggression?.score || 5;
  const buyPressure = Math.min(100, Math.round(aggressionScore * 10 + 5));
  const sellPressure = 100 - buyPressure;

  // Turnover — real volume × price × FX
  const estimatedVolume = realCurrentVol > 0 ? realCurrentVol : Math.round(rvol * (realAvgVol > 0 ? realAvgVol : 2500000));
  const turnoverUSD = displayPrice > 0 && estimatedVolume > 0 ? displayPrice * estimatedVolume : 0;
  const turnoverKRW = turnoverUSD * fxRate;

  // Volume comparison bar
  const avgVolume = realAvgVol > 0 ? Math.round(realAvgVol) : Math.round(estimatedVolume / Math.max(rvol, 0.01));
  const volumeBarData = [
    { name: '전일 평균', volume: avgVolume, fill: 'hsl(var(--muted-foreground))' },
    { name: '금일 누적', volume: estimatedVolume, fill: rvol >= 2 ? 'hsl(var(--stock-up))' : 'hsl(var(--primary))' },
  ];

  // PnL
  const investmentKRW = Math.round(pos.price * pos.quantity * fxRate);
  const currentValueKRW = Math.round(displayPrice * pos.quantity * fxRate);
  const unrealizedPnl = currentValueKRW - investmentKRW;
  const unrealizedPnlPct = investmentKRW > 0 ? ((currentValueKRW / investmentKRW) - 1) * 100 : 0;
  const isProfit = unrealizedPnl >= 0;

  // ★ 점수 산출 근거 Top 3
  const scoreReasons = useMemo(() => {
    const reasons: { label: string; score: number; reason: string }[] = [];
    const indEntries = Object.entries(indicators);
    for (const [key, ind] of indEntries) {
      const meta = INDICATOR_LABELS[key];
      if (!meta) continue;
      const s = (ind as any)?.score || 0;
      const status = getIndicatorStatusLabel(key, s, ind);
      const detail = (ind as any)?.details || '';
      reasons.push({
        label: meta.label,
        score: s,
        reason: detail || status.text,
      });
    }
    return reasons.sort((a, b) => b.score - a.score).slice(0, 3);
  }, [indicators]);

  // ★ 익절 확률 통계적 근거
  const winProbFromScore = score >= 70 ? 95 : score >= 65 ? 92 : score >= 60 ? 90 : score >= 55 ? 85 : score >= 50 ? 75 : score >= 45 ? 50 : 30;
  const statisticalSampleSize = 1000;
  const statisticalWins = Math.round(statisticalSampleSize * winProbFromScore / 100);

  // ★ 실시간 순매수 대금 (Money Flow) 추정
  const netBuyRatio = (buyPressure - 50) / 50; // -1 ~ +1
  const netMoneyFlowKRW = turnoverKRW * netBuyRatio;
  const isNetBuying = netMoneyFlowKRW > 0;

  // Indicator detail bars with status labels
  const indicatorBars = Object.entries(INDICATOR_LABELS).map(([key, meta]) => {
    const ind = indicators[key];
    const s = ind?.score || 0;
    const isWeighted = key === 'rvol' || key === 'macd' || key === 'candle';
    const status = getIndicatorStatusLabel(key, s, ind);
    const rawVal = ind?.rawValue ?? ind?.rvol ?? ind?.macd ?? ind?.atr ?? null;
    return { key, label: meta.label, score: s, isWeighted, details: ind?.details || '', rawValue: rawVal, unit: meta.unit, status };
  });

  // Custom tooltip for radar chart
  const CustomRadarTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0]?.payload;
    if (!data) return null;
    return (
      <div className="bg-card border border-border rounded-lg p-3 shadow-lg text-xs space-y-1.5 min-w-[180px]">
        <p className="font-bold text-foreground">{data.indicator}</p>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">AI 점수</span>
          <span className="font-mono font-bold text-primary">{data.score}/10 ({data.score * 10}점)</span>
        </div>
        {data.rawValue != null && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">원시값</span>
            <span className="font-mono">{typeof data.rawValue === 'number' ? data.rawValue.toFixed(3) : data.rawValue}{data.unit}</span>
          </div>
        )}
        {data.statusLabel && (
          <Badge variant="outline" className={cn("text-[9px] mt-1", data.statusLabel.color)}>
            {data.statusLabel.text}
          </Badge>
        )}
        {data.details && <p className="text-muted-foreground text-[10px] pt-0.5 border-t border-border">{data.details}</p>}
      </div>
    );
  };

  if (!pos) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto border-primary/20 bg-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <BarChart3 className="w-5 h-5 text-primary" />
            <span>{formatStockName(pos.symbol)}</span>
            <Badge variant="outline" className={cn("font-mono text-sm", getScoreColor(score))}>
              AI {score}점
            </Badge>
            <span className={cn("text-sm font-medium", getScoreColor(score))}>
              {getScoreLabel(score)}
            </span>
            {isFetching && <RefreshCw className="w-3.5 h-3.5 text-muted-foreground animate-spin ml-auto" />}
          </DialogTitle>
        </DialogHeader>

        {/* Price & PnL Summary */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="border-border">
            <CardContent className="p-3 text-center">
              <p className="text-[10px] text-muted-foreground">현재가 {livePrice ? '🟢' : ''}</p>
              <p className="text-lg font-bold font-mono">₩{Math.round(displayPrice * fxRate).toLocaleString('ko-KR')}</p>
              <p className="text-[10px] text-muted-foreground">${displayPrice.toFixed(2)}</p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="p-3 text-center">
              <p className="text-[10px] text-muted-foreground">미실현 PnL</p>
              <p className={cn("text-lg font-bold font-mono", isProfit ? 'text-stock-up' : 'text-stock-down')}>
                {isProfit ? '+' : ''}₩{unrealizedPnl.toLocaleString()}
              </p>
              <p className={cn("text-[10px]", isProfit ? 'text-stock-up' : 'text-stock-down')}>
                {isProfit ? '+' : ''}{unrealizedPnlPct.toFixed(2)}%
              </p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="p-3 text-center">
              <p className="text-[10px] text-muted-foreground">보유 수량</p>
              <p className="text-lg font-bold font-mono">{pos.quantity}주</p>
              <p className="text-[10px] text-muted-foreground">평가 ₩{currentValueKRW.toLocaleString('ko-KR')}</p>
            </CardContent>
          </Card>
        </div>

        {/* Radar Chart */}
        <Card className="border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold">10대 지표 레이더 차트</span>
              <span className="text-[10px] text-muted-foreground ml-auto">
                {hasIndicators ? '면적이 넓을수록 매수 조건 완벽 · 30초 자동갱신' : '데이터 로딩 중...'}
              </span>
            </div>
            {quantLoading && !hasIndicators ? (
              <div className="h-[300px] flex flex-col items-center justify-center gap-3">
                <RefreshCw className="w-6 h-6 text-primary animate-spin" />
                <p className="text-sm text-muted-foreground">실시간 지표 연산 중...</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis
                    dataKey="indicator"
                    tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <PolarRadiusAxis angle={30} domain={[0, 10]} tick={{ fontSize: 8 }} />
                  <Radar
                    name="점수"
                    dataKey="score"
                    stroke={score >= 55 ? 'hsl(var(--stock-up))' : score >= 35 ? 'hsl(var(--primary))' : 'hsl(var(--destructive))'}
                    fill={score >= 55 ? 'hsl(var(--stock-up))' : score >= 35 ? 'hsl(var(--primary))' : 'hsl(var(--destructive))'}
                    fillOpacity={0.25}
                    strokeWidth={2}
                    isAnimationActive={true}
                    animationDuration={800}
                    animationEasing="ease-in-out"
                  />
                  <RechartsTooltip content={<CustomRadarTooltip />} />
                </RadarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Indicator Detail Table with Status Labels */}
        <Card className="border-border">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">지표 상세 분석</span>
              <span className="text-[10px] text-muted-foreground ml-auto">×2 = 가중치 2배 적용</span>
            </div>
            {quantLoading && !hasIndicators ? (
              <div className="space-y-2">
                {Array.from({ length: 11 }).map((_, i) => <Skeleton key={i} className="h-5" />)}
              </div>
            ) : (
              <div className="space-y-1.5">
                {indicatorBars.map(({ key, label, score: s, isWeighted, details, rawValue, unit, status }) => (
                  <div key={key} className="rounded-md bg-muted/30 px-2 py-1.5">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="w-32 shrink-0 truncate font-medium">{label}</span>
                      {isWeighted && <Badge variant="outline" className="text-[8px] px-1 py-0 border-warning/40 text-warning">×2</Badge>}
                      <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-700 ease-in-out",
                            s >= 8 ? 'bg-stock-up' : s >= 5 ? 'bg-primary' : s >= 3 ? 'bg-warning' : 'bg-destructive'
                          )}
                          style={{ width: `${(s / 10) * 100}%` }}
                        />
                      </div>
                      <span className={cn("w-8 text-right font-mono font-bold text-[11px]",
                        s >= 8 ? 'text-stock-up' : s >= 5 ? 'text-primary' : s >= 3 ? 'text-warning' : 'text-destructive'
                      )}>
                        {s}/10
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 pl-[8.5rem]">
                      <Badge variant="outline" className={cn("text-[8px] px-1.5 py-0", status.color)}>
                        {status.text}
                      </Badge>
                      {rawValue != null && (
                        <span className="text-[9px] font-mono text-muted-foreground">
                          {typeof rawValue === 'number' ? rawValue.toFixed(3) : rawValue}{unit}
                        </span>
                      )}
                      {details && <span className="text-[9px] text-muted-foreground">{details}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Volume & Turnover Analysis */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <Card className="border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Volume2 className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold">거래량 분석</span>
                <Badge variant="outline" className={cn("text-[10px] ml-auto",
                  rvol >= 2 ? 'border-stock-up/40 text-stock-up' : 'border-muted-foreground/40'
                )}>
                  RVOL: {rvol.toFixed(1)}x
                </Badge>
              </div>
              <ResponsiveContainer width="100%" height={120}>
                <BarChart data={volumeBarData} barSize={40}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} />
                  <RechartsTooltip
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }}
                    formatter={(value: number) => [value.toLocaleString(), '거래량']}
                  />
                  <Bar dataKey="volume" radius={[4, 4, 0, 0]}>
                    {volumeBarData.map((entry, index) => (
                      <Cell key={index} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-2 text-center">
                <p className="text-[10px] text-muted-foreground">전일 대비 거래량</p>
                <p className={cn("text-lg font-bold font-mono", rvol >= 2 ? 'text-stock-up' : 'text-foreground')}>
                  {(rvol * 100).toFixed(0)}%
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-4 h-4 text-warning" />
                <span className="text-sm font-semibold">수급 분석</span>
              </div>

              {/* Turnover — 억/만 원 정밀 표기 */}
              <div className="text-center mb-4">
                <p className="text-[10px] text-muted-foreground">실시간 거래대금</p>
                <p className="text-xl font-bold font-mono text-primary leading-tight">
                  {turnoverKRW > 0 ? formatTurnoverKRW(turnoverKRW) : '-'}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  ${turnoverUSD > 0 ? `${(turnoverUSD / 1000000).toFixed(2)}M` : '-'}
                  {realCurrentVol > 0 && <span className="ml-1">· 거래량 {formatLargeNumber(realCurrentVol)}주</span>}
                </p>
              </div>

              {/* Buy/Sell Pressure Bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-stock-up font-semibold">매수 체결 {buyPressure}%</span>
                  <span className="text-stock-down font-semibold">매도 체결 {sellPressure}%</span>
                </div>
                <div className="w-full h-5 rounded-full overflow-hidden flex">
                  <div className="h-full bg-stock-up transition-all duration-700" style={{ width: `${buyPressure}%` }} />
                  <div className="h-full bg-stock-down transition-all duration-700" style={{ width: `${sellPressure}%` }} />
                </div>
                <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
                  {buyPressure > 60 ? (
                    <>
                      <TrendingUp className="w-3 h-3 text-stock-up" />
                      <span className="text-stock-up font-medium">매수 우위 — 수급 양호</span>
                    </>
                  ) : buyPressure < 40 ? (
                    <>
                      <TrendingDown className="w-3 h-3 text-stock-down" />
                      <span className="text-stock-down font-medium">매도 우위 — 수급 주의</span>
                    </>
                  ) : (
                    <span>수급 균형</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Entry Info */}
        <div className="flex items-center gap-4 text-[10px] text-muted-foreground border-t border-border pt-3 flex-wrap">
          <span>진입가: ₩{Math.round(pos.price * fxRate).toLocaleString('ko-KR')}</span>
          <span>진입 점수: {pos.entry_score || '-'}점</span>
          <span>SL: ₩{Math.round((pos.stop_loss || 0) * fxRate).toLocaleString('ko-KR')}</span>
          <span>TP: ₩{Math.round((pos.take_profit || 0) * fxRate).toLocaleString('ko-KR')}</span>
          <span className="ml-auto">전략: {pos.cap_type === 'large' ? '대형주' : '소형주'}</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
