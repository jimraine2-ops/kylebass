import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useStockQuotes, useChartData } from "@/hooks/useStockData";
import { XAxis, YAxis, Tooltip, ResponsiveContainer, Area, ComposedChart, Bar, Line } from "recharts";
import { TrendingUp, TrendingDown, Target, Shield } from "lucide-react";
import { useState, useMemo } from "react";
import CompanyNewsSection from "@/components/stock/CompanyNewsSection";
import { formatStockName, getKoreanName } from "@/lib/koreanStockMap";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { useWebSocketPrices } from "@/hooks/useWebSocketPrice";

// ===== Local technical indicator calculations =====
function calculateRSI(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) gains += change; else losses -= change;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  return 100 - (100 / (1 + avgGain / avgLoss));
}

function calculateEMA(data: number[], period: number): number {
  if (data.length === 0) return 0;
  if (data.length < period) return data.reduce((a, b) => a + b, 0) / data.length;
  const k = 2 / (period + 1);
  let ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < data.length; i++) ema = data[i] * k + ema * (1 - k);
  return ema;
}

function calculateMA(data: number[], period: number): number | null {
  if (data.length < period) return null;
  return data.slice(-period).reduce((a, b) => a + b, 0) / period;
}

function calculateMACD(closes: number[]) {
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);
  const macdLine = ema12 - ema26;
  const macdValues: number[] = [];
  for (let i = Math.max(0, closes.length - 9); i < closes.length; i++) {
    const e12 = calculateEMA(closes.slice(0, i + 1), 12);
    const e26 = calculateEMA(closes.slice(0, i + 1), 26);
    macdValues.push(e12 - e26);
  }
  const signal = macdValues.length > 0 ? macdValues.reduce((a, b) => a + b, 0) / macdValues.length : 0;
  return { macd: macdLine, signal, histogram: macdLine - signal };
}

export default function StockDetail() {
  const { symbol = 'AAPL' } = useParams();
  const { data: quotes } = useStockQuotes([symbol]);
  const { data: chartResponse, isLoading: chartLoading } = useChartData(symbol);
  const chartData = chartResponse?.chartData;
  const { rate: fxRate, isLive: fxLive, toKRW } = useExchangeRate();
  const ws = useWebSocketPrices([symbol]);
  const [entryPrice, setEntryPrice] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");

  const quote = quotes?.[0];
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

  // Calculate technical indicators locally from chart data
  const indicators = useMemo(() => {
    if (!chartData || chartData.length < 2) return null;
    const closes = chartData.map((d: any) => d.close).filter(Boolean);
    const volumes = chartData.map((d: any) => d.volume).filter(Boolean);
    if (closes.length < 5) return null;

    const rsi = calculateRSI(closes);
    const macd = calculateMACD(closes);
    const ma5 = calculateMA(closes, 5);
    const ma20 = calculateMA(closes, 20);
    const ma60 = calculateMA(closes, 60);
    const ma200 = calculateMA(closes, 200);
    const avgVolume = volumes.slice(-20).reduce((a: number, b: number) => a + b, 0) / Math.min(volumes.length, 20);
    const currentVolume = volumes[volumes.length - 1] || 0;
    const volumeRatio = avgVolume > 0 ? currentVolume / avgVolume : 1;
    const currentPrice = closes[closes.length - 1];

    return { rsi, macd, ma5, ma20, ma60, ma200, volumeRatio, currentPrice };
  }, [chartData]);

  // Chart data with MA overlays
  const enrichedChart = useMemo(() => {
    if (!chartData) return [];
    return chartData.map((d: any, i: number) => {
      const closes = chartData.slice(0, i + 1).map((c: any) => c.close);
      return {
        ...d,
        dateLabel: d.date?.slice(5),
        ma5: closes.length >= 5 ? closes.slice(-5).reduce((a: number, b: number) => a + b, 0) / 5 : null,
        ma20: closes.length >= 20 ? closes.slice(-20).reduce((a: number, b: number) => a + b, 0) / 20 : null,
      };
    });
  }, [chartData]);

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
            {livePrice ? `₩${Math.round(livePrice * fxRate).toLocaleString('ko-KR')}` : '—'}
          </p>
          <p className="text-xs text-muted-foreground font-mono">
            ${livePrice?.toFixed(2)} · {fxLive ? '실시간' : '고정'} ₩{fxRate.toLocaleString('ko-KR')}/USD
            {wsPrice ? ' 🟢' : ''}
          </p>
          <p className={`text-sm font-mono ${isUp ? 'text-stock-up' : 'text-stock-down'}`}>
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

      {/* Technical Indicators - Raw Data Display */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            기술적 지표 (수치 데이터)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!indicators ? (
            chartLoading ? <Skeleton className="h-40" /> : <p className="text-sm text-muted-foreground">차트 데이터 로딩 중...</p>
          ) : (
            <>
              {/* RSI */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium">RSI (14)</span>
                  <span className={`text-sm font-mono font-bold ${
                    indicators.rsi != null ? (indicators.rsi > 70 ? 'text-stock-down' : indicators.rsi < 30 ? 'text-stock-up' : 'text-muted-foreground') : ''
                  }`}>
                    {indicators.rsi?.toFixed(1) ?? 'N/A'}
                  </span>
                </div>
                {indicators.rsi != null && (
                  <>
                    <div className="h-2 bg-muted rounded-full overflow-hidden relative">
                      <div className="absolute inset-y-0 left-0 bg-stock-up rounded-full" style={{ width: '30%' }} />
                      <div className="absolute inset-y-0 left-[30%] bg-muted-foreground/30 rounded-full" style={{ width: '40%' }} />
                      <div className="absolute inset-y-0 left-[70%] bg-stock-down rounded-full" style={{ width: '30%' }} />
                      <div className="absolute top-0 bottom-0 w-1 bg-foreground rounded-full" style={{ left: `${Math.min(indicators.rsi, 100)}%` }} />
                    </div>
                    <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                      <span>과매도 (&lt;30)</span>
                      <span>중립</span>
                      <span>과매수 (&gt;70)</span>
                    </div>
                  </>
                )}
              </div>

              {/* MACD */}
              <div>
                <p className="text-sm font-medium mb-1">MACD</p>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="bg-muted rounded p-2 text-center">
                    <p className="text-muted-foreground">MACD</p>
                    <p className={`font-mono font-bold ${indicators.macd.macd >= 0 ? 'text-stock-up' : 'text-stock-down'}`}>
                      {indicators.macd.macd.toFixed(3)}
                    </p>
                  </div>
                  <div className="bg-muted rounded p-2 text-center">
                    <p className="text-muted-foreground">Signal</p>
                    <p className="font-mono font-bold">{indicators.macd.signal.toFixed(3)}</p>
                  </div>
                  <div className="bg-muted rounded p-2 text-center">
                    <p className="text-muted-foreground">Histogram</p>
                    <p className={`font-mono font-bold ${indicators.macd.histogram >= 0 ? 'text-stock-up' : 'text-stock-down'}`}>
                      {indicators.macd.histogram.toFixed(3)}
                    </p>
                  </div>
                </div>
                {indicators.macd.histogram >= 0 && indicators.macd.macd > indicators.macd.signal ? (
                  <Badge className="mt-2 bg-stock-up/20 text-stock-up border-0">🟢 골든크로스</Badge>
                ) : (
                  <Badge variant="destructive" className="mt-2 bg-stock-down/20 text-stock-down border-0">🔴 데드크로스</Badge>
                )}
              </div>

              {/* Moving Averages */}
              <div>
                <p className="text-sm font-medium mb-1">이동평균선</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  {[
                    { label: 'MA5', value: indicators.ma5 },
                    { label: 'MA20', value: indicators.ma20 },
                    { label: 'MA60', value: indicators.ma60 },
                    { label: 'MA200', value: indicators.ma200 },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-muted rounded p-2 text-center">
                      <p className="text-muted-foreground">{label}</p>
                      <p className={`font-mono font-bold ${
                        value != null && indicators.currentPrice
                          ? (indicators.currentPrice > value ? 'text-stock-up' : 'text-stock-down')
                          : ''
                      }`}>
                        {value != null ? `$${value.toFixed(2)}` : 'N/A'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Volume Ratio */}
              <div>
                <p className="text-sm font-medium mb-1">거래량 비율</p>
                <p className={`text-lg font-bold font-mono ${indicators.volumeRatio > 1.5 ? 'text-stock-up' : indicators.volumeRatio < 0.5 ? 'text-stock-down' : ''}`}>
                  {indicators.volumeRatio.toFixed(2)}x
                  <span className="text-xs text-muted-foreground ml-2">
                    {indicators.volumeRatio > 1.5 ? '평균 이상 (강세 신호)' : indicators.volumeRatio < 0.5 ? '평균 이하 (약세 신호)' : '평균 수준'}
                  </span>
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

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
                  <p className={`text-2xl font-bold font-mono ${rrRatio.ratio >= 2 ? 'text-stock-up' : rrRatio.ratio >= 1 ? 'text-warning' : 'text-stock-down'}`}>
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
