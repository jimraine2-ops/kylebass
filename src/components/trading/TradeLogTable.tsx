import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatStockName } from "@/lib/koreanStockMap";
import { Search, Trash2, ArrowDown, ChevronDown, ChevronRight } from "lucide-react";
import { useState, useRef, useEffect, useCallback, Fragment } from "react";

interface TradeLogTableProps {
  closedTrades: any[];
  openPositions?: any[];
}

type TabFilter = 'all' | 'buy' | 'sell';

function getStrategyTag(aiReason: string | null): { label: string; color: string } {
  if (!aiReason) return { label: 'Main', color: 'bg-primary/20 text-primary border-primary/30' };
  if (aiReason.includes('[Cloud-Quant]') || aiReason.includes('[Cloud]')) return { label: 'Cloud', color: 'bg-chart-4/20 text-chart-4 border-chart-4/30' };
  if (aiReason.includes('[Quant]')) return { label: 'Quant', color: 'bg-stock-up/20 text-stock-up border-stock-up/30' };
  if (aiReason.includes('[Scalp]')) return { label: 'Scalp', color: 'bg-warning/20 text-warning border-warning/30' };
  if (aiReason.includes('[Main]')) return { label: 'Main', color: 'bg-primary/20 text-primary border-primary/30' };
  return { label: 'Main', color: 'bg-primary/20 text-primary border-primary/30' };
}

function getStatusInfo(status: string): { label: string; variant: 'default' | 'destructive' | 'secondary' | 'outline'; isExit: boolean } {
  switch (status) {
    case 'open': return { label: '보유중', variant: 'outline', isExit: false };
    case 'profit_taken': return { label: '익절완료', variant: 'default', isExit: true };
    case 'trailing_stop': return { label: '추격손절', variant: 'default', isExit: true };
    case 'trailing_profit': return { label: '추격익절', variant: 'default', isExit: true };
    case 'stopped': return { label: '손절완료', variant: 'destructive', isExit: true };
    case 'score_exit': return { label: '점수청산', variant: 'secondary', isExit: true };
    case 'time_cut': return { label: '타임컷', variant: 'secondary', isExit: true };
    case 'breakeven_exit': return { label: '본절탈출', variant: 'secondary', isExit: true };
    case 'replaced': return { label: '교체매도', variant: 'secondary', isExit: true };
    case 'early_exit': return { label: '조기탈출', variant: 'secondary', isExit: true };
    default: return { label: '종료', variant: 'secondary', isExit: true };
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

function formatHoldDuration(openedAt: string, closedAt: string | null): string {
  if (!closedAt) return '-';
  const ms = new Date(closedAt).getTime() - new Date(openedAt).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}분`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}시간 ${mins % 60}분`;
}

export function TradeLogTable({ closedTrades, openPositions = [] }: TradeLogTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [tabFilter, setTabFilter] = useState<TabFilter>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
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
    .slice(0, 500);

  // Tab filter
  const tabFiltered = allEntries.filter(e => {
    if (tabFilter === 'buy') return e._type === 'open';
    if (tabFilter === 'sell') return e._type === 'closed';
    return true;
  });

  // Search filter
  const filteredEntries = searchQuery
    ? tabFiltered.filter(e => {
        const q = searchQuery.toLowerCase();
        const koreanName = formatStockName(e.symbol).toLowerCase();
        return koreanName.includes(q) || e.symbol.toLowerCase().includes(q);
      })
    : tabFiltered;

  // Today's summary
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayTrades = closedTrades.filter(t => t.closed_at?.startsWith(todayStr));
  const todayWins = todayTrades.filter(t => (t.pnl || 0) > 0).length;
  const todayLosses = todayTrades.filter(t => (t.pnl || 0) <= 0).length;
  const todayPnl = todayTrades.reduce((s, t) => s + (t.pnl || 0), 0);

  // Auto-scroll
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const el = scrollRef.current;
    const isAtTop = el.scrollTop < 50;
    setAutoScroll(isAtTop);
  }, []);

  useEffect(() => {
    if (autoScroll && scrollRef.current && filteredEntries.length !== prevCountRef.current) {
      scrollRef.current.scrollTop = 0;
    }
    prevCountRef.current = filteredEntries.length;
  }, [filteredEntries.length, autoScroll]);

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
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSearchQuery('')}>
              <Trash2 className="w-3 h-3 mr-1" />
              초기화
            </Button>
          </div>
        </div>

        {/* Today's Summary */}
        <div className="flex items-center gap-3 mt-2 text-xs">
          <span className="text-muted-foreground">오늘:</span>
          <Badge variant="outline" className="text-[10px] bg-stock-up/10 text-stock-up border-stock-up/30">
            승 {todayWins}회
          </Badge>
          <Badge variant="outline" className="text-[10px] bg-stock-down/10 text-stock-down border-stock-down/30">
            패 {todayLosses}회
          </Badge>
          <span className={`font-mono font-bold ${todayPnl >= 0 ? 'text-stock-up' : 'text-stock-down'}`}>
            {todayPnl >= 0 ? '+' : ''}₩{Math.round(todayPnl).toLocaleString('ko-KR')}
          </span>
        </div>

        {/* Tab Filter */}
        <Tabs value={tabFilter} onValueChange={(v) => setTabFilter(v as TabFilter)} className="mt-2">
          <TabsList className="h-7 p-0.5">
            <TabsTrigger value="all" className="text-[10px] h-6 px-3">전체 ({allEntries.length})</TabsTrigger>
            <TabsTrigger value="buy" className="text-[10px] h-6 px-3">매수/보유 ({openPositions.length})</TabsTrigger>
            <TabsTrigger value="sell" className="text-[10px] h-6 px-3">매도/청산 ({closedTrades.length})</TabsTrigger>
          </TabsList>
        </Tabs>
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
                  <th className="w-5 py-2 px-1"></th>
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
                  const isExpanded = expandedId === entry.id;

                  return (
                    <Fragment key={entry.id}>
                      <tr
                        className={`border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer ${
                          isOpen ? 'bg-primary/5' : statusInfo.isExit ? 'bg-stock-down/5' : ''
                        }`}
                        onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                      >
                        <td className="py-2 px-1 text-muted-foreground">
                          {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                        </td>
                        <td className="py-2 px-2">
                          <div className="flex items-center gap-1">
                            <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${tag.color}`}>
                              {tag.label}
                            </Badge>
                            {statusInfo.isExit && (
                              <Badge variant="destructive" className="text-[8px] px-1 py-0">
                                EXIT
                              </Badge>
                            )}
                          </div>
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
                      {/* Expandable AI Decision Trace */}
                      {isExpanded && (
                        <tr key={`${entry.id}-detail`} className="bg-muted/20">
                          <td colSpan={10} className="py-2 px-4">
                            <div className="space-y-1 text-[11px]">
                              <p className="font-semibold text-foreground">🧠 AI 의사결정 로그</p>
                              {entry.ai_reason && (
                                <p className="text-muted-foreground">
                                  <span className="font-medium text-foreground">근거:</span> {entry.ai_reason}
                                </p>
                              )}
                              {entry.ai_confidence != null && (
                                <p className="text-muted-foreground">
                                  <span className="font-medium text-foreground">신뢰도:</span> {entry.ai_confidence}%
                                </p>
                              )}
                              {!isOpen && (
                                <p className="text-muted-foreground">
                                  <span className="font-medium text-foreground">보유 기간:</span> {formatHoldDuration(entry.opened_at, entry.closed_at)}
                                  {' | '}
                                  <span className="font-medium text-foreground">총 투자금:</span> {formatKRW(entry.price * entry.quantity)}
                                </p>
                              )}
                              {entry.stop_loss && (
                                <p className="text-muted-foreground">
                                  <span className="font-medium text-foreground">손절가:</span> {formatKRW(entry.stop_loss)}
                                  {entry.take_profit && <> | <span className="font-medium text-foreground">목표가:</span> {formatKRW(entry.take_profit)}</>}
                                </p>
                              )}
                              {entry.entry_score != null && (
                                <p className="text-muted-foreground">
                                  <span className="font-medium text-foreground">진입 점수:</span> {entry.entry_score}/100
                                </p>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!autoScroll && filteredEntries.length > 10 && (
          <div className="flex justify-end mt-2">
            <Button
              variant="secondary"
              size="sm"
              className="text-xs"
              onClick={() => {
                if (scrollRef.current) scrollRef.current.scrollTop = 0;
                setAutoScroll(true);
              }}
            >
              <ArrowDown className="w-3 h-3 mr-1" />
              최신으로
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
