import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useStockQuotes, useChartData, useTechnicalAnalysis, useSentimentAnalysis } from "@/hooks/useStockData";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Area, AreaChart, ComposedChart } from "recharts";
import { TrendingUp, TrendingDown, Brain, Target, Shield, AlertTriangle } from "lucide-react";
import { useState, useMemo } from "react";
import CompanyNewsSection from "@/components/stock/CompanyNewsSection";
import { formatStockName, getKoreanName } from "@/lib/koreanStockMap";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { useWebSocketPrices } from "@/hooks/useWebSocketPrice";

export default function StockDetail() {
  const { symbol = 'AAPL' } = useParams();
  const { data: quotes } = useStockQuotes([symbol]);
  const { data: chartResponse, isLoading: chartLoading } = useChartData(symbol);
  const chartData = chartResponse?.chartData;
  const { data: analysis, isLoading: analysisLoading } = useTechnicalAnalysis(symbol, chartData);
  const { data: sentiment } = useSentimentAnalysis(symbol);
  const { rate: fxRate, isLive: fxLive, toKRW } = useExchangeRate();
  const ws = useWebSocketPrices([symbol]);
  const [entryPrice, setEntryPrice] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");

  const wsPrice = ws.getPrice(symbol);
  const livePrice = wsPrice ?? quote?.regularMarketPrice;
  const isUp = (quote?.regularMarketChange || 0) >= 0;

  // R/R Ratio calculation
  const rrRatio = useMemo(() => {
    const entry = parseFloat(entryPrice);
    const sl = parseFloat(stopLoss);
    const tp = parseFloat(takeProfit);
    if (!entry || !sl || !tp || entry === sl) return null;
    const risk = Math.abs(entry - sl);
    const reward = Math.abs(tp - entry);
    return { ratio: reward / risk, risk, reward, riskPercent: (risk / entry) * 100, rewardPercent: (reward / entry) * 100 };
  }, [entryPrice, stopLoss, takeProfit]);

  // Auto-fill from AI recommendation
  useMemo(() => {
    if (analysis?.recommendation && quote?.regularMarketPrice) {
      if (!entryPrice) setEntryPrice(quote.regularMarketPrice.toFixed(2));
      if (!stopLoss && analysis.recommendation.stopLoss) setStopLoss(analysis.recommendation.stopLoss.toFixed(2));
      if (!takeProfit && analysis.recommendation.takeProfit) setTakeProfit(analysis.recommendation.takeProfit.toFixed(2));
    }
  }, [analysis, quote]);

  // Chart data with MA overlays
  const enrichedChart = useMemo(() => {
    if (!chartData) return [];
    return chartData.map((d: any, i: number) => {
      const closes = chartData.slice(0, i + 1).map((c: any) => c.close);
      return {
        ...d,
        dateLabel: d.date?.slice(5), // MM-DD
        ma5: closes.length >= 5 ? closes.slice(-5).reduce((a: number, b: number) => a + b, 0) / 5 : null,
        ma20: closes.length >= 20 ? closes.slice(-20).reduce((a: number, b: number) => a + b, 0) / 20 : null,
      };
    });
  }, [chartData]);

  const rec = analysis?.recommendation;
  const recColor = rec?.recommendation === '매수' ? 'stock-up' : rec?.recommendation === '매도' ? 'stock-down' : 'text-warning';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            {getKoreanName(symbol) || symbol}
            <span className="text-lg text-muted-foreground font-mono">({symbol})</span>
            {quote && (
              <Badge variant={isUp ? "default" : "destructive"} className="text-xs">
                {isUp ? '▲' : '▼'} {Math.abs(quote.regularMarketChangePercent || 0).toFixed(2)}%
              </Badge>
            )}
          </h1>
          <p className="text-muted-foreground text-sm">{quote?.shortName || symbol}</p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold font-mono">
            {quote?.regularMarketPrice ? `₩${((quote.regularMarketPrice) * 1350).toLocaleString('ko-KR', { maximumFractionDigits: 0 })}` : '—'}
          </p>
          <p className="text-xs text-muted-foreground font-mono">${quote?.regularMarketPrice?.toFixed(2)}</p>
          <p className={`text-sm font-mono ${isUp ? 'stock-up' : 'stock-down'}`}>
            {isUp ? '+' : ''}{quote?.regularMarketChangePercent?.toFixed(2)}%
          </p>
        </div>
      </div>

      {/* Price Chart with MAs */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">가격 차트 & 이동평균선</CardTitle>
        </CardHeader>
        <CardContent>
          {chartLoading ? <Skeleton className="h-64" /> : (
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={enrichedChart}>
                <XAxis dataKey="dateLabel" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                <Area type="monotone" dataKey="close" fill="hsl(var(--primary) / 0.1)" stroke="hsl(var(--primary))" strokeWidth={2} name="종가" />
                <Line type="monotone" dataKey="ma5" stroke="hsl(var(--chart-4))" strokeWidth={1} dot={false} name="MA5" />
                <Line type="monotone" dataKey="ma20" stroke="hsl(var(--chart-5))" strokeWidth={1} dot={false} name="MA20" />
                <Bar dataKey="volume" fill="hsl(var(--muted-foreground) / 0.15)" yAxisId="volume" name="거래량" />
                <YAxis yAxisId="volume" orientation="right" tick={false} width={0} domain={[0, (max: number) => max * 5]} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Technical Indicators */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" />
              기술적 지표
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {analysisLoading ? <Skeleton className="h-40" /> : analysis ? (
              <>
                {/* RSI */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium">RSI (14)</span>
                    <span className={`text-sm font-mono font-bold ${analysis.rsi > 70 ? 'stock-down' : analysis.rsi < 30 ? 'stock-up' : 'text-muted-foreground'}`}>
                      {analysis.rsi?.toFixed(1)}
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden relative">
                    <div className="absolute inset-y-0 left-0 bg-stock-up rounded-full" style={{ width: '30%' }} />
                    <div className="absolute inset-y-0 left-[30%] bg-muted-foreground/30 rounded-full" style={{ width: '40%' }} />
                    <div className="absolute inset-y-0 left-[70%] bg-stock-down rounded-full" style={{ width: '30%' }} />
                    <div className="absolute top-0 bottom-0 w-1 bg-foreground rounded-full" style={{ left: `${Math.min(analysis.rsi, 100)}%` }} />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                    <span>과매도 (&lt;30)</span>
                    <span>중립</span>
                    <span>과매수 (&gt;70)</span>
                  </div>
                </div>

                {/* MACD */}
                <div>
                  <p className="text-sm font-medium mb-1">MACD</p>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="bg-muted rounded p-2 text-center">
                      <p className="text-muted-foreground">MACD</p>
                      <p className={`font-mono font-bold ${analysis.macd?.macd >= 0 ? 'stock-up' : 'stock-down'}`}>
                        {analysis.macd?.macd?.toFixed(3)}
                      </p>
                    </div>
                    <div className="bg-muted rounded p-2 text-center">
                      <p className="text-muted-foreground">Signal</p>
                      <p className="font-mono font-bold">{analysis.macd?.signal?.toFixed(3)}</p>
                    </div>
                    <div className="bg-muted rounded p-2 text-center">
                      <p className="text-muted-foreground">Histogram</p>
                      <p className={`font-mono font-bold ${analysis.macd?.histogram >= 0 ? 'stock-up' : 'stock-down'}`}>
                        {analysis.macd?.histogram?.toFixed(3)}
                      </p>
                    </div>
                  </div>
                  {analysis.macd?.histogram >= 0 && analysis.macd?.macd > analysis.macd?.signal ? (
                    <Badge className="mt-2 bg-stock-up/20 stock-up border-0">🟢 골든크로스</Badge>
                  ) : (
                    <Badge variant="destructive" className="mt-2 bg-stock-down/20 stock-down border-0">🔴 데드크로스</Badge>
                  )}
                </div>

                {/* Volume */}
                <div>
                  <p className="text-sm font-medium mb-1">거래량 비율</p>
                  <p className={`text-lg font-bold font-mono ${analysis.volumeRatio > 1.5 ? 'stock-up' : analysis.volumeRatio < 0.5 ? 'stock-down' : ''}`}>
                    {analysis.volumeRatio?.toFixed(2)}x
                    <span className="text-xs text-muted-foreground ml-2">
                      {analysis.volumeRatio > 1.5 ? '평균 이상 (강세 신호)' : analysis.volumeRatio < 0.5 ? '평균 이하 (약세 신호)' : '평균 수준'}
                    </span>
                  </p>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">차트 데이터 로딩 후 분석됩니다</p>
            )}
          </CardContent>
        </Card>

        {/* AI Recommendation */}
        <Card className={rec ? `border-l-4 ${rec.recommendation === '매수' ? 'border-l-stock-up' : rec.recommendation === '매도' ? 'border-l-stock-down' : 'border-l-warning'}` : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Brain className="w-4 h-4 text-primary" />
              AI 매매 추천
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analysisLoading ? <Skeleton className="h-40" /> : rec ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className={`text-2xl font-bold ${recColor}`}>{rec.recommendation}</span>
                  <Badge variant="outline" className="font-mono">신뢰도 {rec.confidence}%</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{rec.summary}</p>
                <div className="space-y-1">
                  {rec.reasons?.map((reason: string, i: number) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <span className="text-primary mt-0.5">•</span>
                      <span>{reason}</span>
                    </div>
                  ))}
                </div>
                {sentiment?.warning && (
                  <div className="flex items-center gap-2 p-2 rounded bg-stock-down/10 text-xs">
                    <AlertTriangle className="w-3 h-3 text-stock-down shrink-0" />
                    <span className="stock-down">{sentiment.warning}</span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">분석 중...</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Company News */}
      <CompanyNewsSection symbol={symbol} />

      {/* R/R Calculator */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            손익비 (R/R Ratio) 계산기
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label className="text-xs">진입가</Label>
              <Input type="number" value={entryPrice} onChange={e => setEntryPrice(e.target.value)} placeholder="0.00" className="font-mono mt-1" />
            </div>
            <div>
              <Label className="text-xs">손절가</Label>
              <Input type="number" value={stopLoss} onChange={e => setStopLoss(e.target.value)} placeholder="0.00" className="font-mono mt-1" />
            </div>
            <div>
              <Label className="text-xs">익절가</Label>
              <Input type="number" value={takeProfit} onChange={e => setTakeProfit(e.target.value)} placeholder="0.00" className="font-mono mt-1" />
            </div>
            <div className="flex items-end">
              {rrRatio ? (
                <div className={`w-full p-3 rounded-lg text-center ${rrRatio.ratio >= 2 ? 'bg-stock-up/10' : rrRatio.ratio >= 1 ? 'bg-warning/10' : 'bg-stock-down/10'}`}>
                  <p className="text-xs text-muted-foreground">손익비</p>
                  <p className={`text-2xl font-bold font-mono ${rrRatio.ratio >= 2 ? 'stock-up' : rrRatio.ratio >= 1 ? 'text-warning' : 'stock-down'}`}>
                    1:{rrRatio.ratio.toFixed(1)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    위험 {rrRatio.riskPercent.toFixed(1)}% / 보상 {rrRatio.rewardPercent.toFixed(1)}%
                  </p>
                </div>
              ) : (
                <div className="w-full p-3 rounded-lg bg-muted text-center">
                  <p className="text-xs text-muted-foreground">값을 입력하세요</p>
                </div>
              )}
            </div>
          </div>
          {rrRatio && (
            <div className="mt-3 p-3 rounded-lg bg-muted text-xs">
              {rrRatio.ratio >= 3 ? '🟢 매우 좋은 기회입니다. 손익비가 3:1 이상입니다.' :
               rrRatio.ratio >= 2 ? '🟡 좋은 기회입니다. 손익비가 2:1 이상입니다.' :
               rrRatio.ratio >= 1 ? '🟠 보통 수준입니다. 추가 분석을 권장합니다.' :
               '🔴 위험한 거래입니다. 보상 대비 위험이 큽니다.'}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
