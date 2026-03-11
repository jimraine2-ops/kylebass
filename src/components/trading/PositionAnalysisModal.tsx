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
  sentiment: { label: '호재 감성', unit: '건' },
  rvol: { label: '상대 거래량(RVOL)', unit: 'x' },
  candle: { label: 'VWAP/캔들 패턴', unit: '' },
  macd: { label: 'MACD 모멘텀', unit: '' },
  atr: { label: '변동성(ATR)', unit: '%' },
  gap: { label: '갭 분석', unit: '%' },
  squeeze: { label: '숏 스퀴즈', unit: '%' },
  position: { label: '가격 위치', unit: '' },
  sectorSynergy: { label: '섹터 동조화', unit: '' },
  aggression: { label: '체결 강도', unit: '' },
  preMarket: { label: '프리마켓 강도', unit: '%' },
};

function getScoreColor(score: number): string {
  if (score >= 60) return 'text-stock-up';
  if (score >= 50) return 'text-primary';
  if (score >= 40) return 'text-warning';
  return 'text-destructive';
}

function getScoreLabel(score: number): string {
  if (score >= 60) return '강력 보유';
  if (score >= 50) return '보유 유지';
  if (score >= 40) return '주의';
  return '매도 검토';
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
  // ★ Self-fetch quant data when modal is open
  const { data: fetchedQuant, isLoading: quantLoading, isFetching } = usePositionQuant(
    open && pos ? pos.symbol : null
  );

  if (!pos) return null;

  // Prefer freshly fetched data, fallback to external
  const quantStock = fetchedQuant || externalQuantStock;
  const displayPrice = livePrice ?? pos.currentPrice ?? pos.price;
  const score = liveScore ?? quantStock?.totalScore ?? pos.entry_score ?? 0;
  const indicators = quantStock?.indicators || {};
  const hasIndicators = Object.keys(indicators).length > 0;

  // Radar data
  const radarData = Object.entries(INDICATOR_LABELS).map(([key, meta]) => ({
    indicator: meta.label,
    score: indicators[key]?.score || 0,
    rawValue: indicators[key]?.rawValue ?? indicators[key]?.rvol ?? null,
    details: indicators[key]?.details || '',
    unit: meta.unit,
    fullMark: 10,
  }));

  // Volume analysis from indicators — use real data from edge function
  const rvolData = indicators.rvol || {};
  const rvol = rvolData.rvol || rvolData.rawValue || 1;
  const realCurrentVol = quantStock?.currentVol || rvolData.currentVol || 0;
  const realAvgVol = quantStock?.avgVol || rvolData.avgVol || 0;
  const aggressionScore = indicators.aggression?.score || 5;
  const buyPressure = Math.min(100, Math.round(aggressionScore * 10 + 5));
  const sellPressure = 100 - buyPressure;

  // Turnover — use real volume if available, else estimate
  const estimatedVolume = realCurrentVol > 0 ? realCurrentVol : Math.round(rvol * (realAvgVol > 0 ? realAvgVol : 2500000));
  const turnoverUSD = displayPrice > 0 && estimatedVolume > 0 ? displayPrice * estimatedVolume : 0;
  const turnoverKRW = turnoverUSD * fxRate;

  // Volume comparison bar data — use real avg if available
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

  // Indicator detail bars
  const indicatorBars = Object.entries(INDICATOR_LABELS).map(([key, meta]) => {
    const ind = indicators[key];
    const s = ind?.score || 0;
    const isWeighted = key === 'rvol' || key === 'macd' || key === 'candle';
    return { key, label: meta.label, score: s, isWeighted, details: ind?.details || '', rawValue: ind?.rawValue ?? ind?.rvol ?? null, unit: meta.unit };
  });

  // Custom tooltip for radar chart
  const CustomRadarTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0]?.payload;
    if (!data) return null;
    return (
      <div className="bg-card border border-border rounded-lg p-2.5 shadow-lg text-xs space-y-1">
        <p className="font-bold text-foreground">{data.indicator}</p>
        <p className="text-primary font-mono">점수: <span className="font-bold">{data.score}/10</span> (100점 환산: {data.score * 10}점)</p>
        {data.details && <p className="text-muted-foreground text-[10px]">{data.details}</p>}
        {data.rawValue != null && (
          <p className="text-muted-foreground text-[10px]">원시값: {typeof data.rawValue === 'number' ? data.rawValue.toFixed(2) : data.rawValue}{data.unit}</p>
        )}
      </div>
    );
  };

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
                {hasIndicators ? '면적이 넓을수록 매수 조건 완벽' : '데이터 로딩 중...'}
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
                    stroke={score >= 60 ? 'hsl(var(--stock-up))' : score >= 40 ? 'hsl(var(--primary))' : 'hsl(var(--destructive))'}
                    fill={score >= 60 ? 'hsl(var(--stock-up))' : score >= 40 ? 'hsl(var(--primary))' : 'hsl(var(--destructive))'}
                    fillOpacity={0.25}
                    strokeWidth={2}
                    animationDuration={800}
                  />
                  <RechartsTooltip content={<CustomRadarTooltip />} />
                </RadarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Indicator Detail Bars */}
        <Card className="border-border">
          <CardContent className="p-4 space-y-2">
            <span className="text-sm font-semibold">지표 상세</span>
            {quantLoading && !hasIndicators ? (
              <div className="space-y-2">
                {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-4" />)}
              </div>
            ) : (
              indicatorBars.map(({ key, label, score: s, isWeighted, details, rawValue, unit }) => (
                <div key={key} className="space-y-0.5">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="w-28 shrink-0 truncate">{label}</span>
                    {isWeighted && <Badge variant="outline" className="text-[8px] px-1 py-0 border-warning/40 text-warning">×2</Badge>}
                    <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-500",
                          s >= 8 ? 'bg-stock-up' : s >= 5 ? 'bg-primary' : s >= 3 ? 'bg-warning' : 'bg-destructive'
                        )}
                        style={{ width: `${(s / 10) * 100}%` }}
                      />
                    </div>
                    <span className={cn("w-8 text-right font-mono font-bold",
                      s >= 8 ? 'text-stock-up' : s >= 5 ? 'text-primary' : s >= 3 ? 'text-warning' : 'text-destructive'
                    )}>
                      {s}/10
                    </span>
                  </div>
                  {details && (
                    <p className="text-[10px] text-muted-foreground pl-[7.5rem]">{details}</p>
                  )}
                </div>
              ))
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

              {/* Turnover */}
              <div className="text-center mb-4">
                <p className="text-[10px] text-muted-foreground">실시간 거래대금</p>
                <p className="text-2xl font-bold font-mono text-primary">
                  ₩{turnoverKRW > 0 ? formatLargeNumber(turnoverKRW) : '-'}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  ${turnoverUSD > 0 ? `${(turnoverUSD / 1000000).toFixed(1)}M` : '-'}
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
