import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuantSignals } from "@/hooks/useStockData";
import { aiAnalyzeAndTrade } from "@/lib/api";
import { TrendingUp, TrendingDown, Bot, Target, Zap, BarChart3, Shield, Radio, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from "recharts";

const INDICATOR_LABELS: Record<string, string> = {
  sentiment: '호재 감성',
  rvol: '상대 거래량',
  candle: '캔들 패턴',
  atr: '변동성(ATR)',
  gap: '갭 분석',
  squeeze: '숏 스퀴즈',
  position: '가격 위치',
  sectorSynergy: '섹터 동조화',
  aggression: '체결 강도',
  preMarket: '프리마켓',
};

function RadarChartCard({ indicators }: { indicators: any }) {
  const data = Object.entries(INDICATOR_LABELS).map(([key, label]) => ({
    indicator: label,
    score: indicators?.[key]?.score || 0,
    fullMark: 10,
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <RadarChart data={data}>
        <PolarGrid stroke="hsl(var(--border))" />
        <PolarAngleAxis dataKey="indicator" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
        <PolarRadiusAxis angle={30} domain={[0, 10]} tick={{ fontSize: 9 }} />
        <Radar name="점수" dataKey="score" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} strokeWidth={2} />
        <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

function ScoreBar({ score, max = 100 }: { score: number; max?: number }) {
  const pct = Math.min((score / max) * 100, 100);
  const color = pct >= 85 ? 'bg-stock-up' : pct >= 60 ? 'bg-warning' : 'bg-stock-down';
  return (
    <div className="w-full bg-muted rounded-full h-2">
      <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function RecommendationPage() {
  const { data, isLoading, refetch, isFetching } = useQuantSignals();
  const [tradingSymbol, setTradingSymbol] = useState<string | null>(null);
  const [selectedStock, setSelectedStock] = useState<any>(null);

  const recommendations = data?.recommendations || [];

  const handleAITrade = useCallback(async (stock: any) => {
    setTradingSymbol(stock.symbol);
    try {
      const result = await aiAnalyzeAndTrade(stock.symbol, stock.price, undefined, stock.totalScore, stock.indicators);
      if (result.trade) {
        toast.success(`AI가 ${stock.symbol} ${result.trade.quantity}주를 $${result.trade.price}에 매수! [Score: ${stock.totalScore}]`);
      } else {
        toast.info(`AI 판단: ${result.decision?.action} (${result.decision?.confidence}%) - ${result.decision?.reason}`);
      }
    } catch (err: any) {
      toast.error(`거래 오류: ${err.message}`);
    } finally {
      setTradingSymbol(null);
    }
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Target className="w-5 h-5 text-primary" />
          10대 지표 종목 추천
        </h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isFetching ? 'animate-spin' : ''}`} />
            새로고침
          </Button>
          <Badge variant="outline" className="font-mono text-xs">
            <Radio className="w-3 h-3 mr-1" />
            2분 자동갱신
          </Badge>
        </div>
      </div>

      {/* Info Banner */}
      <Card className="border-primary/20">
        <CardContent className="p-4 text-xs text-muted-foreground">
          <p className="font-medium text-foreground mb-1">📊 10대 전문 지표 기반 AI 퀀트 분석</p>
          <p>감성분석 · RVOL · 캔들패턴 · ATR변동성 · 갭분석 · 숏스퀴즈 · 가격위치 · 섹터동조화 · 체결강도 · 프리마켓</p>
          <p className="mt-1">합산 85점 이상 + 필수 조건 충족 시 AI 자동 매수 실행</p>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : recommendations.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            분석 가능한 종목이 없습니다. 잠시 후 다시 시도해주세요.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Stock List */}
          <div className="lg:col-span-2 space-y-3">
            {recommendations.map((stock: any, idx: number) => {
              const isUp = (stock.changePct || 0) >= 0;
              const isSelected = selectedStock?.symbol === stock.symbol;
              return (
                <Card
                  key={stock.symbol}
                  className={`cursor-pointer transition-all hover:border-primary/40 ${isSelected ? 'border-primary ring-1 ring-primary/20' : ''}`}
                  onClick={() => setSelectedStock(stock)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                          {idx + 1}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold">{stock.symbol}</span>
                            <span className="text-lg font-bold font-mono">${stock.price?.toFixed(2)}</span>
                            <span className={`text-sm font-mono ${isUp ? 'stock-up' : 'stock-down'}`}>
                              {isUp ? '+' : ''}{stock.changePct?.toFixed(2)}%
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <p className="text-2xl font-bold font-mono">{stock.totalScore}</p>
                          <p className="text-[10px] text-muted-foreground">/100점</p>
                        </div>
                        <Button
                          size="sm"
                          variant={stock.totalScore >= 85 ? "default" : "outline"}
                          onClick={(e) => { e.stopPropagation(); handleAITrade(stock); }}
                          disabled={tradingSymbol === stock.symbol}
                          className="text-xs"
                        >
                          <Bot className="w-3 h-3 mr-1" />
                          {tradingSymbol === stock.symbol ? '분석중...' : 'AI 매매'}
                        </Button>
                      </div>
                    </div>
                    <ScoreBar score={stock.totalScore} />
                    <div className="flex flex-wrap gap-1 mt-2">
                      {Object.entries(stock.indicators || {}).map(([key, ind]: [string, any]) => (
                        <Badge
                          key={key}
                          variant={ind.score >= 8 ? "default" : ind.score >= 5 ? "secondary" : "outline"}
                          className="text-[9px] px-1.5 py-0"
                        >
                          {INDICATOR_LABELS[key]}: {ind.score}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Radar Chart Detail */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  {selectedStock ? `${selectedStock.symbol} 지표 레이더` : '종목을 선택하세요'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selectedStock ? (
                  <RadarChartCard indicators={selectedStock.indicators} />
                ) : (
                  <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
                    좌측 종목 클릭 시 레이더 차트 표시
                  </div>
                )}
              </CardContent>
            </Card>

            {selectedStock && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">지표 상세</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {Object.entries(selectedStock.indicators || {}).map(([key, ind]: [string, any]) => (
                    <div key={key} className="flex items-start justify-between text-xs border-b border-border/50 pb-1.5">
                      <div>
                        <p className="font-medium">{INDICATOR_LABELS[key]}</p>
                        <p className="text-muted-foreground text-[10px]">{ind.details}</p>
                      </div>
                      <Badge variant={ind.score >= 8 ? "default" : ind.score >= 5 ? "secondary" : "outline"} className="text-[10px] shrink-0">
                        {ind.score}/10
                      </Badge>
                    </div>
                  ))}
                  {selectedStock.trailingStop > 0 && (
                    <div className="flex items-center gap-2 mt-2 p-2 rounded bg-muted text-xs">
                      <Shield className="w-3.5 h-3.5 text-warning" />
                      <span>추적 손절선: <span className="font-mono font-bold">${selectedStock.trailingStop?.toFixed(4)}</span></span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
