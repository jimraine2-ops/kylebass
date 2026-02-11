import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useStockQuotes } from "@/hooks/useStockData";
import { TrendingUp, TrendingDown, Activity, BarChart3, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";

const INDICES = ['^GSPC', '^IXIC', '^DJI', '^VIX'];
const POPULAR_STOCKS = ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'GOOGL', 'AMZN', 'META', 'AMD'];
const SECTORS = [
  { name: '기술', symbol: 'XLK', color: 'bg-primary/20 text-primary' },
  { name: '헬스케어', symbol: 'XLV', color: 'bg-stock-up/20 stock-up' },
  { name: '금융', symbol: 'XLF', color: 'bg-warning/10 text-warning' },
  { name: '에너지', symbol: 'XLE', color: 'bg-stock-down/20 stock-down' },
  { name: '소재', symbol: 'XLB', color: 'bg-muted text-muted-foreground' },
  { name: '산업재', symbol: 'XLI', color: 'bg-primary/10 text-primary' },
];

const INDEX_NAMES: Record<string, string> = {
  '^GSPC': 'S&P 500',
  '^IXIC': 'NASDAQ',
  '^DJI': 'Dow Jones',
  '^VIX': 'VIX',
};

export default function Dashboard() {
  const { data: indices, isLoading: indicesLoading } = useStockQuotes(INDICES);
  const { data: stocks, isLoading: stocksLoading } = useStockQuotes(POPULAR_STOCKS);
  const { data: sectors, isLoading: sectorsLoading } = useStockQuotes(SECTORS.map(s => s.symbol));

  const vixData = indices?.find((q: any) => q.symbol === '^VIX');
  const vixValue = vixData?.regularMarketPrice || 0;
  const isHighVix = vixValue > 25;

  return (
    <div className="space-y-6">
      {/* Market Warning Banner */}
      {isHighVix && (
        <div className="bg-stock-down/10 border border-stock-down/30 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-stock-down shrink-0" />
          <div>
            <p className="text-sm font-semibold text-stock-down">⚠️ 시장 비추천일 경고</p>
            <p className="text-xs text-muted-foreground">VIX가 {vixValue.toFixed(1)}로 높습니다. 오늘은 관망을 추천합니다.</p>
          </div>
        </div>
      )}

      {/* Major Indices */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          주요 지수 현황
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {indicesLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}><CardContent className="p-4"><Skeleton className="h-16" /></CardContent></Card>
            ))
          ) : (
            (indices || []).map((index: any) => {
              const isUp = (index.regularMarketChange || 0) >= 0;
              const isVix = index.symbol === '^VIX';
              return (
                <Card key={index.symbol} className="hover:border-primary/30 transition-colors">
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground font-medium">
                      {INDEX_NAMES[index.symbol] || index.symbol}
                    </p>
                    <p className="text-xl font-bold font-mono mt-1">
                      {isVix ? index.regularMarketPrice?.toFixed(2) : index.regularMarketPrice?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <div className={`flex items-center gap-1 mt-1 ${isVix ? (index.regularMarketPrice > 25 ? 'stock-down' : 'stock-up') : isUp ? 'stock-up' : 'stock-down'}`}>
                      {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      <span className="text-xs font-mono font-medium">
                        {isUp ? '+' : ''}{index.regularMarketChangePercent?.toFixed(2)}%
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>

      {/* VIX Gauge */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            시장 공포 지수 (VIX)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div className="relative w-32 h-16">
              <svg viewBox="0 0 120 60" className="w-full h-full">
                {/* Background arc */}
                <path d="M 10 55 A 50 50 0 0 1 110 55" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" strokeLinecap="round" />
                {/* Colored sections */}
                <path d="M 10 55 A 50 50 0 0 1 43 12" fill="none" stroke="hsl(var(--stock-up))" strokeWidth="8" strokeLinecap="round" />
                <path d="M 43 12 A 50 50 0 0 1 77 12" fill="none" stroke="hsl(var(--warning))" strokeWidth="8" strokeLinecap="round" />
                <path d="M 77 12 A 50 50 0 0 1 110 55" fill="none" stroke="hsl(var(--stock-down))" strokeWidth="8" strokeLinecap="round" />
                {/* Needle */}
                {vixValue > 0 && (() => {
                  const angle = Math.min(Math.max((vixValue / 50) * 180, 0), 180);
                  const rad = (angle * Math.PI) / 180;
                  const x = 60 - 40 * Math.cos(rad);
                  const y = 55 - 40 * Math.sin(rad);
                  return <line x1="60" y1="55" x2={x} y2={y} stroke="hsl(var(--foreground))" strokeWidth="2" strokeLinecap="round" />;
                })()}
              </svg>
            </div>
            <div>
              <p className="text-3xl font-bold font-mono">{vixValue.toFixed(1)}</p>
              <Badge variant={vixValue < 15 ? "default" : vixValue < 25 ? "secondary" : "destructive"} className="mt-1">
                {vixValue < 15 ? '안정' : vixValue < 25 ? '보통' : vixValue < 35 ? '불안' : '극심한 공포'}
              </Badge>
            </div>
            <div className="flex-1 grid grid-cols-3 gap-2 text-xs text-center">
              <div className="p-2 rounded bg-stock-up/10"><span className="stock-up font-medium">0-15</span><br/>탐욕</div>
              <div className="p-2 rounded bg-warning/10"><span className="text-warning font-medium">15-25</span><br/>보통</div>
              <div className="p-2 rounded bg-stock-down/10"><span className="stock-down font-medium">25+</span><br/>공포</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sector Heatmap */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">섹터별 히트맵</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            {sectorsLoading ? (
              Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20" />)
            ) : (
              SECTORS.map((sector, i) => {
                const quote = sectors?.find((q: any) => q.symbol === sector.symbol);
                const change = quote?.regularMarketChangePercent || 0;
                const isUp = change >= 0;
                return (
                  <div
                    key={sector.symbol}
                    className={`rounded-lg p-3 text-center transition-all hover:scale-105 cursor-pointer ${isUp ? 'bg-stock-up/10' : 'bg-stock-down/10'}`}
                  >
                    <p className="text-xs font-medium text-muted-foreground">{sector.name}</p>
                    <p className={`text-lg font-bold font-mono mt-1 ${isUp ? 'stock-up' : 'stock-down'}`}>
                      {isUp ? '+' : ''}{change.toFixed(2)}%
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{sector.symbol}</p>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* Popular Stocks / AI Picks */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            인기 종목
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {stocksLoading ? (
              Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24" />)
            ) : (
              (stocks || []).map((stock: any) => {
                const isUp = (stock.regularMarketChange || 0) >= 0;
                return (
                  <Link
                    to={`/stock/${stock.symbol}`}
                    key={stock.symbol}
                    className="block rounded-lg border border-border p-3 hover:border-primary/40 transition-all hover:shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm">{stock.symbol}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {stock.shortName?.slice(0, 12) || stock.symbol}
                      </Badge>
                    </div>
                    <p className="text-lg font-bold font-mono mt-2">
                      ${stock.regularMarketPrice?.toFixed(2)}
                    </p>
                    <div className={`flex items-center gap-1 ${isUp ? 'stock-up' : 'stock-down'}`}>
                      {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      <span className="text-xs font-mono">
                        {isUp ? '+' : ''}{stock.regularMarketChange?.toFixed(2)} ({isUp ? '+' : ''}{stock.regularMarketChangePercent?.toFixed(2)}%)
                      </span>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
