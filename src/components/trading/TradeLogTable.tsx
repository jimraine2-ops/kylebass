import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatStockName } from "@/lib/koreanStockMap";
import { Search, Trash2, ArrowDown } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";

interface TradeLogTableProps {
  closedTrades: any[];
  openPositions?: any[];
}

function getStrategyTag(aiReason: string | null): { label: string; color: string } {
  if (!aiReason) return { label: 'Main', color: 'bg-primary/20 text-primary border-primary/30' };
  if (aiReason.includes('[Cloud-Quant]') || aiReason.includes('[Cloud]')) return { label: 'Cloud', color: 'bg-chart-4/20 text-chart-4 border-chart-4/30' };
  if (aiReason.includes('[Quant]')) return { label: 'Quant', color: 'bg-stock-up/20 text-stock-up border-stock-up/30' };
  if (aiReason.includes('[Scalp]')) return { label: 'Scalp', color: 'bg-warning/20 text-warning border-warning/30' };
  if (aiReason.includes('[Main]')) return { label: 'Main', color: 'bg-primary/20 text-primary border-primary/30' };
  return { label: 'Main', color: 'bg-primary/20 text-primary border-primary/30' };
}

function getStatusInfo(status: string): { label: string; variant: 'default' | 'destructive' | 'secondary' | 'outline' } {
  switch (status) {
    case 'open': return { label: '보유중', variant: 'outline' };
    case 'profit_taken': return { label: '익절완료', variant: 'default' };
    case 'trailing_stop': return { label: '추격익절', variant: 'default' };
    case 'stopped': return { label: '손절완료', variant: 'destructive' };
    case 'score_exit': return { label: '점수청산', variant: 'secondary' };
    case 'time_cut': return { label: '타임컷', variant: 'secondary' };
    default: return { label: '종료', variant: 'secondary' };
  }
}

function formatTime(dateStr: string | null): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

function formatKRW(usd: number): string {
  return `₩${Math.round(usd * 1350).toLocaleString('ko-KR')}`;
}

export function TradeLogTable({ closedTrades, openPositions = [] }: TradeLogTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);

  // Merge open positions + closed trades into unified log sorted by time desc
  const allEntries = [
    ...openPositions.map((pos: any) => ({
      ...pos,
      _type: 'open' as const,
      _sortTime: new Date(pos.opened_at).getTime(),
    })),
    ...closedTrades.map((trade: any) => ({
      ...trade,
      _type: 'closed' as const,
      _sortTime: new Date(trade.closed_at || trade.opened_at).getTime(),
    })),
  ]
    .sort((a, b) => b._sortTime - a._sortTime)
    .slice(0, 500); // Cap at 500 entries for performance

  // Filter by search
  const filteredEntries = searchQuery
    ? allEntries.filter(e => {
        const q = searchQuery.toLowerCase();
        const koreanName = formatStockName(e.symbol).toLowerCase();
        return koreanName.includes(q) || e.symbol.toLowerCase().includes(q);
      })
    : allEntries;

  // Auto-scroll when new entries appear
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const el = scrollRef.current;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    setAutoScroll(isAtBottom);
  }, []);

  useEffect(() => {
    if (autoScroll && scrollRef.current && filteredEntries.length !== prevCountRef.current) {
      scrollRef.current.scrollTop = 0; // Newest at top
    }
    prevCountRef.current = filteredEntries.length;
  }, [filteredEntries.length, autoScroll]);

  const handleClearLogs = () => {
    // Just clears the search filter for now (actual data comes from server)
    setSearchQuery('');
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-stock-up animate-pulse" />
            📋 실시간 매매 로그 (통합) — {filteredEntries.length}건
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
              <Input
                placeholder="종목 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-7 text-xs pl-7 w-[140px]"
              />
            </div>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleClearLogs}>
              <Trash2 className="w-3 h-3 mr-1" />
              초기화
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filteredEntries.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            {searchQuery ? `"${searchQuery}" 검색 결과가 없습니다.` : '매매 기록이 없습니다.'}
          </p>
        ) : (
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="h-[420px] overflow-y-auto overflow-x-auto"
          >
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-card z-10">
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left py-2 px-2">전략</th>
                  <th className="text-left py-2 px-2">시간</th>
                  <th className="text-left py-2 px-2">종목</th>
                  <th className="text-left py-2 px-2">상태</th>
                  <th className="text-right py-2 px-2">매수가</th>
                  <th className="text-right py-2 px-2">매도가</th>
                  <th className="text-right py-2 px-2">수량</th>
                  <th className="text-right py-2 px-2">수익금</th>
                  <th className="text-right py-2 px-2">수익률</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map((entry: any) => {
                  const isOpen = entry._type === 'open';
                  const pnl = isOpen ? (entry.unrealizedPnl || 0) : (entry.pnl || 0);
                  const pnlPct = isOpen ? (entry.unrealizedPnlPct || 0) : (entry.price > 0 && entry.close_price ? ((entry.close_price - entry.price) / entry.price * 100) : 0);
                  const isProfit = pnl > 0;
                  const isLoss = pnl < 0;
                  const time = isOpen ? formatTime(entry.opened_at) : formatTime(entry.closed_at || entry.opened_at);
                  const tag = getStrategyTag(entry.ai_reason);
                  const statusInfo = getStatusInfo(entry.status);

                  return (
                    <tr
                      key={entry.id}
                      className={`border-b border-border/50 hover:bg-muted/30 transition-colors ${
                        isOpen ? 'bg-primary/5' : ''
                      }`}
                    >
                      <td className="py-2 px-2">
                        <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${tag.color}`}>
                          {tag.label}
                        </Badge>
                      </td>
                      <td className="py-2 px-2 text-muted-foreground font-mono whitespace-nowrap">{time}</td>
                      <td className="py-2 px-2 font-bold whitespace-nowrap">{formatStockName(entry.symbol)}</td>
                      <td className="py-2 px-2">
                        <Badge variant={statusInfo.variant} className={`text-[9px] ${isOpen ? 'animate-pulse' : ''}`}>
                          {statusInfo.label}
                        </Badge>
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-blue-500 dark:text-blue-400">
                        {formatKRW(entry.price)}
                      </td>
                      <td className="py-2 px-2 text-right font-mono">
                        {isOpen
                          ? (entry.currentPrice ? <span className="text-muted-foreground">{formatKRW(entry.currentPrice)}</span> : '-')
                          : (entry.close_price
                            ? <span className={isProfit ? 'text-stock-up' : isLoss ? 'text-stock-down' : ''}>{formatKRW(entry.close_price)}</span>
                            : '-'
                          )
                        }
                      </td>
                      <td className="py-2 px-2 text-right font-mono">{entry.quantity}주</td>
                      <td className={`py-2 px-2 text-right font-mono font-bold ${isProfit ? 'text-stock-up' : isLoss ? 'text-stock-down' : 'text-muted-foreground'}`}>
                        {pnl !== 0 ? `${isProfit ? '+' : ''}₩${Math.round(pnl).toLocaleString('ko-KR')}` : '-'}
                      </td>
                      <td className={`py-2 px-2 text-right font-mono font-bold ${isProfit ? 'text-stock-up' : isLoss ? 'text-stock-down' : 'text-muted-foreground'}`}>
                        {pnlPct !== 0 ? `${pnlPct > 0 ? '+' : ''}${pnlPct.toFixed(2)}%` : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!autoScroll && filteredEntries.length > 10 && (
          <Button
            variant="secondary"
            size="sm"
            className="absolute bottom-4 right-4 text-xs"
            onClick={() => {
              if (scrollRef.current) scrollRef.current.scrollTop = 0;
              setAutoScroll(true);
            }}
          >
            <ArrowDown className="w-3 h-3 mr-1" />
            최신으로
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
