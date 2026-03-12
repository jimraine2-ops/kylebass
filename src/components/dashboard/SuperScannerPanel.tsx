import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useSuperScan } from "@/hooks/useStockData";
import { formatStockName } from "@/lib/koreanStockMap";
import { Radar, TrendingUp, TrendingDown, Sparkles, BarChart3 } from "lucide-react";
import { Link } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useMemo } from "react";

export function SuperScannerPanel() {
  const { data, isLoading } = useSuperScan();

  const top30 = data?.top30 || [];
  const newEntries = new Set(data?.newEntries || []);
  const totalCached = data?.totalCached || 0;

  // Bar chart data for score distribution
  const chartData = useMemo(() => {
    return top30.slice(0, 30).map((s: any) => ({
      name: s.symbol,
      score: s.totalScore,
      changePct: s.changePct || 0,
    }));
  }, [top30]);

  const getScoreColor = (score: number) => {
    if (score >= 55) return 'hsl(var(--stock-up))';
    if (score >= 40) return 'hsl(var(--warning))';
    return 'hsl(var(--stock-down))';
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Radar className="w-4 h-4 text-primary" />전 시장 슈퍼 스캐너
          </CardTitle>
        </CardHeader>
        <CardContent><Skeleton className="h-60" /></CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Score Distribution Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                상위 종목 점수 분포
              </CardTitle>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <span>스캔 범위: {totalCached}개 종목</span>
                <Badge variant="outline" className="text-[9px]">TOP {top30.length}개</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} angle={-45} textAnchor="end" height={50} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} width={30} />
                <Tooltip
                  formatter={(value: number) => [`${value}점`, '지표 점수']}
                  labelFormatter={(label) => formatStockName(label as string)}
                  contentStyle={{ fontSize: '12px', backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                />
                <Bar dataKey="score" radius={[3, 3, 0, 0]}>
                  {chartData.map((entry: any, idx: number) => (
                    <Cell key={idx} fill={getScoreColor(entry.score)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Top 30 List */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Radar className="w-4 h-4 text-primary" />
              전 시장 슈퍼 스캐너 TOP 30
            </CardTitle>
            <Badge variant="outline" className="text-[10px] gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--stock-up))] animate-pulse" />
              1분 갱신
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {top30.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              시장 데이터 수집 중... 잠시 후 종목이 표시됩니다.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {top30.map((stock: any, idx: number) => {
                const isUp = (stock.changePct || 0) >= 0;
                const isNew = newEntries.has(stock.symbol);
                const priceKRW = Math.round((stock.price || 0) * 1350);

                return (
                  <Link
                    to={`/stock/${stock.symbol}`}
                    key={stock.symbol}
                    className="flex items-center justify-between p-2.5 rounded-lg border border-border hover:border-primary/40 transition-all hover:shadow-sm"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-mono text-muted-foreground w-5 text-right shrink-0">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="font-semibold text-xs truncate">{formatStockName(stock.symbol)}</span>
                          {isNew && (
                            <Badge className="text-[8px] px-1 py-0 bg-primary text-primary-foreground">
                              <Sparkles className="w-2.5 h-2.5 mr-0.5" />NEW
                            </Badge>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground truncate">{stock.reason}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className={`text-[10px] font-mono ${
                        stock.totalScore >= 60 ? 'border-[hsl(var(--stock-up)/0.4)] text-[hsl(var(--stock-up))]' :
                        stock.totalScore >= 45 ? 'border-[hsl(var(--warning)/0.4)] text-[hsl(var(--warning))]' :
                        'border-border text-muted-foreground'
                      }`}>
                        {stock.totalScore}점
                      </Badge>
                      <div className={`text-right ${isUp ? 'text-[hsl(var(--stock-up))]' : 'text-[hsl(var(--stock-down))]'}`}>
                        <div className="flex items-center gap-0.5">
                          {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          <span className="text-xs font-mono font-bold">
                            {isUp ? '+' : ''}{(stock.changePct || 0).toFixed(1)}%
                          </span>
                        </div>
                        <p className="text-[9px] font-mono text-muted-foreground">
                          ₩{priceKRW.toLocaleString('ko-KR')}
                        </p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
