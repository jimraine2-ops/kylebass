import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useStockQuotes } from "@/hooks/useStockData";
import { Eye, Plus, Trash2, TrendingUp, TrendingDown } from "lucide-react";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

export default function WatchlistPage() {
  const [watchlist, setWatchlist] = useState<string[]>(() => {
    const saved = localStorage.getItem('stock-watchlist');
    return saved ? JSON.parse(saved) : ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'GOOGL'];
  });
  const [newSymbol, setNewSymbol] = useState('');
  const { data: quotes, isLoading } = useStockQuotes(watchlist);

  useEffect(() => {
    localStorage.setItem('stock-watchlist', JSON.stringify(watchlist));
  }, [watchlist]);

  const addSymbol = () => {
    const s = newSymbol.trim().toUpperCase();
    if (s && !watchlist.includes(s)) {
      setWatchlist(prev => [...prev, s]);
      setNewSymbol('');
    }
  };

  const removeSymbol = (symbol: string) => {
    setWatchlist(prev => prev.filter(s => s !== symbol));
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Eye className="w-6 h-6 text-primary" />
        워치리스트
      </h1>

      {/* Add symbol */}
      <div className="flex gap-2">
        <Input
          value={newSymbol}
          onChange={e => setNewSymbol(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addSymbol()}
          placeholder="종목 심볼 추가 (예: AMD)"
          className="max-w-xs font-mono"
        />
        <Button onClick={addSymbol} size="sm" className="gap-1"><Plus className="w-4 h-4" /> 추가</Button>
      </div>

      {/* Watchlist Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? <div className="p-6"><Skeleton className="h-60" /></div> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left py-3 px-4 font-medium">심볼</th>
                    <th className="text-left py-3 px-4 font-medium">이름</th>
                    <th className="text-right py-3 px-4 font-medium">현재가</th>
                    <th className="text-right py-3 px-4 font-medium">변동</th>
                    <th className="text-right py-3 px-4 font-medium">변동률</th>
                    <th className="text-right py-3 px-4 font-medium">거래량</th>
                    <th className="text-center py-3 px-4 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {watchlist.map(sym => {
                    const quote = quotes?.find((q: any) => q.symbol === sym);
                    const isUp = (quote?.regularMarketChange || 0) >= 0;
                    return (
                      <tr key={sym} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                        <td className="py-3 px-4">
                          <Link to={`/stock/${sym}`} className="font-bold text-primary hover:underline">{sym}</Link>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">{quote?.shortName?.slice(0, 20) || '—'}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold">${quote?.regularMarketPrice?.toFixed(2) || '—'}</td>
                        <td className={`py-3 px-4 text-right font-mono ${isUp ? 'stock-up' : 'stock-down'}`}>
                          {isUp ? '+' : ''}{quote?.regularMarketChange?.toFixed(2) || '0.00'}
                        </td>
                        <td className={`py-3 px-4 text-right font-mono ${isUp ? 'stock-up' : 'stock-down'}`}>
                          <span className="flex items-center justify-end gap-1">
                            {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {isUp ? '+' : ''}{quote?.regularMarketChangePercent?.toFixed(2) || '0.00'}%
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-muted-foreground">
                          {quote?.regularMarketVolume ? (quote.regularMarketVolume / 1e6).toFixed(1) + 'M' : '—'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Button variant="ghost" size="sm" onClick={() => removeSymbol(sym)}>
                            <Trash2 className="w-4 h-4 text-muted-foreground hover:text-stock-down" />
                          </Button>
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
