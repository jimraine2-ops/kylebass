import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from "recharts";

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

export function RadarChartCard({ indicators }: { indicators: any }) {
  const data = Object.entries(INDICATOR_LABELS).map(([key, label]) => ({
    indicator: label,
    score: indicators?.[key]?.score || 0,
    fullMark: 10,
  }));

  // 수급 응축도가 높으면(≥7) 발산 직전 상태 표시
  const condensationScore = indicators?.condensation?.score || 0;
  const isAboutToExplode = condensationScore >= 7;

  return (
    <ResponsiveContainer width="100%" height={300}>
      <RadarChart data={data}>
        <PolarGrid stroke="hsl(var(--border))" />
        <PolarAngleAxis dataKey="indicator" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} />
        <PolarRadiusAxis angle={30} domain={[0, 10]} tick={{ fontSize: 9 }} />
        <Radar name="점수" dataKey="score" stroke={isAboutToExplode ? "hsl(var(--warning))" : "hsl(var(--primary))"} fill={isAboutToExplode ? "hsl(var(--warning))" : "hsl(var(--primary))"} fillOpacity={isAboutToExplode ? 0.4 : 0.3} strokeWidth={2} />
        <Tooltip 
          contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} 
          formatter={(value: number, name: string) => [`${value}/10`, name]}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
