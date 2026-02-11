import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useStockQuotes } from "@/hooks/useStockData";
import { Building2, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react";

const SECTORS = [
  { name: '기술', symbol: 'XLK' },
  { name: '헬스케어', symbol: 'XLV' },
  { name: '금융', symbol: 'XLF' },
  { name: '에너지', symbol: 'XLE' },
  { name: '소재', symbol: 'XLB' },
  { name: '산업재', symbol: 'XLI' },
  { name: '필수소비재', symbol: 'XLP' },
  { name: '임의소비재', symbol: 'XLY' },
  { name: '유틸리티', symbol: 'XLU' },
  { name: '부동산', symbol: 'XLRE' },
  { name: '통신', symbol: 'XLC' },
];

const INDICES = ['^GSPC', '^IXIC', '^DJI', '^VIX'];
const INDEX_NAMES: Record<string, string> = { '^GSPC': 'S&P 500', '^IXIC': 'NASDAQ', '^DJI': 'Dow Jones', '^VIX': 'VIX' };

export default function SectorsPage() {
  const { data: sectors, isLoading } = useStockQuotes(SECTORS.map(s => s.symbol));
  const { data: indices } = useStockQuotes(INDICES);

  const vix = indices?.find((q: any) => q.symbol === '^VIX');
  const isHighVix = (vix?.regularMarketPrice || 0) > 25;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Building2 className="w-6 h-6 text-primary" />
        섹터 & 시장 비교
      </h1>

      {isHighVix && (
        <div className="bg-stock-down/10 border border-stock-down/30 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-stock-down" />
          <p className="text-sm"><span className="font-bold stock-down">시장 비추천일:</span> VIX {vix?.regularMarketPrice?.toFixed(1)} — 오늘은 관망을 추천합니다.</p>
        </div>
      )}

      {/* Index performance */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">주요 지수 대비 상대 강도</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {(indices || []).filter((q: any) => q.symbol !== '^VIX').map((q: any) => {
              const isUp = (q.regularMarketChangePercent || 0) >= 0;
              return (
                <div key={q.symbol} className="text-center p-3 rounded-lg bg-muted">
                  <p className="text-xs text-muted-foreground">{INDEX_NAMES[q.symbol]}</p>
                  <p className="text-lg font-bold font-mono">{q.regularMarketPrice?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  <p className={`text-sm font-mono ${isUp ? 'stock-up' : 'stock-down'}`}>
                    {isUp ? '+' : ''}{q.regularMarketChangePercent?.toFixed(2)}%
                  </p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Sector Table */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">섹터 퍼포먼스</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-60" /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left py-2 px-3 font-medium">섹터</th>
                    <th className="text-left py-2 px-3 font-medium">ETF</th>
                    <th className="text-right py-2 px-3 font-medium">현재가</th>
                    <th className="text-right py-2 px-3 font-medium">일간 변동</th>
                    <th className="text-right py-2 px-3 font-medium">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {SECTORS.map((sector) => {
                    const quote = sectors?.find((q: any) => q.symbol === sector.symbol);
                    const change = quote?.regularMarketChangePercent || 0;
                    const isUp = change >= 0;
                    return (
                      <tr key={sector.symbol} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                        <td className="py-3 px-3 font-medium">{sector.name}</td>
                        <td className="py-3 px-3 font-mono text-muted-foreground">{sector.symbol}</td>
                        <td className="py-3 px-3 text-right font-mono">${quote?.regularMarketPrice?.toFixed(2) || '—'}</td>
                        <td className={`py-3 px-3 text-right font-mono ${isUp ? 'stock-up' : 'stock-down'}`}>
                          <span className="flex items-center justify-end gap-1">
                            {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {isUp ? '+' : ''}{change.toFixed(2)}%
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <Badge variant={isUp ? "default" : "destructive"} className="text-[10px]">
                            {isUp ? '강세' : '약세'}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
