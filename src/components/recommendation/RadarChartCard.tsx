import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from "recharts";
import { Badge } from "@/components/ui/badge";
import { BarChart3 } from "lucide-react";
import { useExchangeRate } from "@/hooks/useExchangeRate";

const INDICATOR_LABELS: Record<string, string> = {
  sentiment: '호재 감성',
  rvol: '상대 거래량',
  candle: 'VWAP/캔들',
  macd: 'MACD',
  rsi: 'RSI',
  bb: '볼린저 밴드',
  emaAlign: '이평선 정배열',
  gap: '갭 분석',
  squeeze: '숏 스퀴즈',
  aggression: '체결 강도',
  condensation: '수급 응축도',
};

export { INDICATOR_LABELS };

function formatTradingValueKRW(volumeUSD: number, rate: number): string {
  const krw = volumeUSD * rate;
  if (krw >= 1e8) return `${(krw / 1e8).toFixed(1)}억`;
  if (krw >= 1e4) return `${(krw / 1e4).toFixed(0)}만`;
  return `${krw.toFixed(0)}`;
}

interface RadarChartCardProps {
  indicators: any;
  volume?: number;
  price?: number;
  winProbability?: number | null;
  winReasons?: string[];
}

export function RadarChartCard({ indicators, volume, price, winProbability, winReasons }: RadarChartCardProps) {
  const { rate } = useExchangeRate();
  const data = Object.entries(INDICATOR_LABELS).map(([key, label]) => ({
    indicator: label,
    score: indicators?.[key]?.score || 0,
    details: indicators?.[key]?.details || '',
    fullMark: 10,
  }));

  const condensationScore = indicators?.condensation?.score || 0;
  const isAboutToExplode = condensationScore >= 7;
  const tradingValueUSD = (volume || 0) * (price || 0);

  return (
    <div className="space-y-2">
      {/* 실시간 거래대금 + 지표 요약 */}
      <div className="flex flex-wrap gap-1.5 items-center">
        {tradingValueUSD > 0 && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 gap-1 border-primary/30 text-primary font-mono">
            <BarChart3 className="w-3 h-3" />
            거래대금 ₩{formatTradingValueKRW(tradingValueUSD, rate)}
          </Badge>
        )}
        {isAboutToExplode && (
          <Badge className="text-[10px] px-1.5 py-0.5 bg-warning/20 text-warning border-warning/30">
            ⚡ 발산 직전 (응축도 {condensationScore}/10)
          </Badge>
        )}
        {Object.entries(indicators || {}).map(([key, ind]: [string, any]) => (
          <Badge
            key={key}
            variant={ind.score >= 8 ? "default" : ind.score >= 5 ? "secondary" : "outline"}
            className="text-[9px] px-1 py-0"
          >
            {INDICATOR_LABELS[key]}: {ind.score} {ind.details ? `(${ind.details})` : ''}
          </Badge>
        ))}
      </div>

      {/* 승률 예측 근거 요약 */}
      {winProbability && winProbability >= 70 && (
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${winProbability >= 90 ? 'bg-amber-500/10 border-amber-500/30' : 'bg-primary/10 border-primary/30'}`}>
          <span className={`text-sm font-bold ${winProbability >= 90 ? 'text-amber-500' : 'text-primary'}`}>
            🏆 AI 승률 {winProbability}%
          </span>
          {winReasons && winReasons.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {winReasons.map((reason, i) => (
                <Badge key={i} variant="outline" className={`text-[9px] px-1.5 py-0 ${winProbability >= 90 ? 'border-amber-500/30 text-amber-500' : 'border-primary/30 text-primary'}`}>
                  {reason}
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 레이더 차트 */}
      <ResponsiveContainer width="100%" height={300}>
        <RadarChart data={data}>
          <PolarGrid stroke="hsl(var(--border))" />
          <PolarAngleAxis dataKey="indicator" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} />
          <PolarRadiusAxis angle={30} domain={[0, 10]} tick={{ fontSize: 9 }} />
          <Radar name="점수" dataKey="score" stroke={isAboutToExplode ? "hsl(var(--warning))" : winProbability && winProbability >= 90 ? "#f59e0b" : "hsl(var(--primary))"} fill={isAboutToExplode ? "hsl(var(--warning))" : winProbability && winProbability >= 90 ? "#f59e0b" : "hsl(var(--primary))"} fillOpacity={isAboutToExplode ? 0.4 : winProbability && winProbability >= 90 ? 0.35 : 0.3} strokeWidth={2} />
          <Tooltip 
            contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} 
            formatter={(value: number, name: string, props: any) => [
              `${value}/10 — ${props.payload.details}`,
              name
            ]}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
