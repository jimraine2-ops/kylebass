import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatStockName } from "@/lib/koreanStockMap";
import {
  Brain, TrendingUp, TrendingDown, AlertTriangle, Target,
  BarChart3, BookOpen, Lightbulb, ShieldCheck, Gauge, Ban
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell
} from "recharts";

function useLearningReport() {
  return useQuery({
    queryKey: ['learning-report'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('ai-learning-report', {
        body: { action: 'report' },
      });
      if (error) throw error;
      return data;
    },
    refetchInterval: 60000,
    retry: 2,
  });
}

export default function LearningReportPage() {
  const { data, isLoading } = useLearningReport();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Brain className="w-5 h-5 text-primary" />
          AI 학습 보고서
        </h2>
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40" />)}
      </div>
    );
  }

  const summary = data?.summary || {};
  const dailyChart = data?.dailyChart || [];
  const aiComment = data?.aiComment || '';
  const lossNotes = data?.lossNotes || [];
  const worstSymbols = data?.worstSymbols || [];
  const bestSymbols = data?.bestSymbols || [];
  const blacklist = data?.blacklist || [];
  const sectorWeights = data?.sectorWeights || [];
  const lossPatterns = data?.lossPatterns || {};

  const learningProgress = Math.min(100, Math.round((summary.totalDataPoints || 0) / 5));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Brain className="w-5 h-5 text-primary" />
          소형주 AI 학습 보고서
        </h2>
        <div className="flex items-center gap-2">
          <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px]">
            📊 분석 데이터: {summary.totalDataPoints || 0}건
          </Badge>
          <Badge className="bg-stock-up/20 text-stock-up border-stock-up/30 text-[10px]">
            🔄 최적화 사이클: {summary.optimizationCycles || 0}회
          </Badge>
        </div>
      </div>

      {/* AI 분석 코멘트 */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-warning" />
            AI 분석 코멘트
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm whitespace-pre-line">{aiComment}</p>
        </CardContent>
      </Card>

      {/* 학습 진척도 + 기대 수익 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Gauge className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">학습 진척도</span>
            </div>
            <Progress value={learningProgress} className="h-3 mb-1" />
            <p className="text-[10px] text-muted-foreground">{summary.totalDataPoints || 0}건 학습 / 500건 목표</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Target className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">다음 거래 기대 수익</span>
            </div>
            <p className={`text-xl font-bold font-mono ${(summary.expectedReturn || 0) >= 0 ? 'text-stock-up' : 'text-stock-down'}`}>
              {(summary.expectedReturn || 0) >= 0 ? '+' : ''}₩{(summary.expectedReturn || 0).toLocaleString()}
            </p>
            <p className="text-[10px] text-muted-foreground">최근 20건 평균 기반</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">권장 진입 기준</span>
            </div>
            <p className="text-xl font-bold font-mono">+{summary.recommendedThreshold || 15}%</p>
            <p className="text-[10px] text-muted-foreground">승률 기반 동적 조정</p>
          </CardContent>
        </Card>
      </div>

      {/* 핵심 성과 KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">승률</span>
            </div>
            <p className="text-xl font-bold font-mono">{summary.winRate || 0}%</p>
            <p className="text-[10px] text-muted-foreground">{summary.wins || 0}승 {summary.losses || 0}패</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-stock-up" />
              <span className="text-xs text-muted-foreground">평균 수익</span>
            </div>
            <p className="text-xl font-bold font-mono text-stock-up">+₩{(summary.avgWinPnl || 0).toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="w-4 h-4 text-stock-down" />
              <span className="text-xs text-muted-foreground">평균 손실</span>
            </div>
            <p className="text-xl font-bold font-mono text-stock-down">₩{(summary.avgLossPnl || 0).toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Target className="w-4 h-4 text-warning" />
              <span className="text-xs text-muted-foreground">손익비</span>
            </div>
            <p className="text-xl font-bold font-mono">{summary.profitFactor || 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* 일별 승률 추이 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            일별 승률 추이
          </CardTitle>
        </CardHeader>
        <CardContent>
          {dailyChart.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={dailyChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number, name: string) => [
                    name === 'winRate' ? `${v}%` : `₩${v.toLocaleString()}`,
                    name === 'winRate' ? '승률' : 'PnL'
                  ]}
                />
                <Bar dataKey="winRate" name="winRate" radius={[4, 4, 0, 0]}>
                  {dailyChart.map((entry: any, idx: number) => (
                    <Cell key={idx} fill={entry.winRate >= 50 ? 'hsl(var(--stock-up))' : 'hsl(var(--stock-down))'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
              거래 데이터가 없습니다.
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 수익 우수 종목 */}
        <Card className="border-stock-up/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-stock-up" />
              수익 우수 종목 (가중치 ↑)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {bestSymbols.length === 0 ? (
              <p className="text-xs text-muted-foreground">데이터 부족</p>
            ) : bestSymbols.map((s: any) => (
              <div key={s.symbol} className="flex items-center justify-between p-2 rounded bg-stock-up/5 border border-stock-up/20">
                <span className="text-sm font-bold">{formatStockName(s.symbol)}</span>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-muted-foreground">{s.count}건</span>
                  <span className="font-mono font-bold text-stock-up">+₩{s.totalProfit.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* 손실 다발 종목 */}
        <Card className="border-stock-down/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-stock-down" />
              손실 다발 종목 (진입 금지 후보)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {worstSymbols.length === 0 ? (
              <p className="text-xs text-muted-foreground">데이터 부족</p>
            ) : worstSymbols.map((s: any) => (
              <div key={s.symbol} className="flex items-center justify-between p-2 rounded bg-stock-down/5 border border-stock-down/20">
                <span className="text-sm font-bold">{formatStockName(s.symbol)}</span>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-muted-foreground">{s.count}건</span>
                  <span className="font-mono font-bold text-stock-down">₩{s.totalLoss.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* 진입 금지 블랙리스트 */}
      {blacklist.length > 0 && (
        <Card className="border-destructive/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Ban className="w-4 h-4 text-destructive" />
              자동 진입 금지 종목 (3회 이상 손절)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {blacklist.map((b: any) => (
                <Badge key={b.symbol} variant="destructive" className="text-xs">
                  {formatStockName(b.symbol)} — {b.lossCount}회 손절 (₩{b.totalLoss.toLocaleString()})
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 오답 노트 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-warning" />
            오답 노트 — 손절 종목 상세 분석
          </CardTitle>
        </CardHeader>
        <CardContent>
          {lossNotes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">손절 데이터가 없습니다.</p>
          ) : (
            <ScrollArea className="h-[350px]">
              <div className="space-y-3">
                {lossNotes.map((note: any, i: number) => (
                  <div key={i} className="p-3 rounded-lg bg-muted/50 border border-stock-down/20 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm">{formatStockName(note.symbol)}</span>
                      <Badge variant="destructive" className="text-[9px]">
                        {note.pnlPct >= 0 ? '+' : ''}{note.pnlPct}%
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                      <span>매수: ₩{Math.round((note.entryPrice || 0) * 1350).toLocaleString()}</span>
                      <span>매도: ₩{Math.round((note.exitPrice || 0) * 1350).toLocaleString()}</span>
                      <span>PnL: ₩{(note.pnl || 0).toLocaleString()}</span>
                      {note.entryScore && <span>진입점수: +{note.entryScore}%</span>}
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate">📝 {note.reason}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {note.openedAt ? new Date(note.openedAt).toLocaleString('ko-KR') : ''} → {note.closedAt ? new Date(note.closedAt).toLocaleString('ko-KR') : ''}
                    </p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* 종목별 가중치 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-warning" />
            종목별 가중치 추천
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sectorWeights.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">데이터 부족</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {sectorWeights.map((s: any) => (
                <div key={s.symbol} className={`p-2 rounded border text-xs ${
                  s.weight === 'HIGH' ? 'border-stock-up/30 bg-stock-up/5' :
                  s.weight === 'LOW' ? 'border-stock-down/30 bg-stock-down/5' :
                  'border-border bg-muted/30'
                }`}>
                  <p className="font-bold">{formatStockName(s.symbol)}</p>
                  <p className="text-muted-foreground">{s.trades}건 | 평균 ₩{s.avgPnl.toLocaleString()}</p>
                  <Badge variant={s.weight === 'HIGH' ? 'default' : s.weight === 'LOW' ? 'destructive' : 'secondary'} className="text-[9px] mt-1">
                    {s.weight === 'HIGH' ? '↑ 가중' : s.weight === 'LOW' ? '↓ 감소' : '유지'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
