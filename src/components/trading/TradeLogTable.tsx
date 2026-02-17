import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TradeLogTableProps {
  closedTrades: any[];
}

function getStrategyTag(aiReason: string | null): { label: string; color: string } {
  if (!aiReason) return { label: 'Main', color: 'bg-primary/20 text-primary border-primary/30' };
  if (aiReason.includes('[Quant]')) return { label: 'Quant', color: 'bg-stock-up/20 text-stock-up border-stock-up/30' };
  if (aiReason.includes('[Scalp]')) return { label: 'Scalp', color: 'bg-warning/20 text-warning border-warning/30' };
  if (aiReason.includes('[Main]')) return { label: 'Main', color: 'bg-primary/20 text-primary border-primary/30' };
  return { label: 'Main', color: 'bg-primary/20 text-primary border-primary/30' };
}

export function TradeLogTable({ closedTrades }: TradeLogTableProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">📋 실시간 매매 로그 (통합)</CardTitle>
      </CardHeader>
      <CardContent>
        {closedTrades.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">완료된 거래가 없습니다.</p>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left py-2 px-2">전략</th>
                    <th className="text-left py-2 px-2">시간</th>
                    <th className="text-left py-2 px-2">종목</th>
                    <th className="text-right py-2 px-2">매수가</th>
                    <th className="text-right py-2 px-2">매도가</th>
                    <th className="text-right py-2 px-2">수량</th>
                    <th className="text-right py-2 px-2">PnL</th>
                    <th className="text-left py-2 px-2">상태</th>
                    <th className="text-left py-2 px-2">근거</th>
                  </tr>
                </thead>
                <tbody>
                  {closedTrades.map((trade: any) => {
                    const isProfit = (trade.pnl || 0) > 0;
                    const time = trade.closed_at ? new Date(trade.closed_at).toLocaleString('ko-KR', { hour: '2-digit', minute: '2-digit', month: '2-digit', day: '2-digit' }) : '-';
                    const tag = getStrategyTag(trade.ai_reason);
                    return (
                      <tr key={trade.id} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="py-2 px-2">
                          <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${tag.color}`}>
                            {tag.label}
                          </Badge>
                        </td>
                        <td className="py-2 px-2 text-muted-foreground font-mono">{time}</td>
                        <td className="py-2 px-2 font-bold">{trade.symbol}</td>
                        <td className="py-2 px-2 text-right font-mono">₩{trade.price?.toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                        <td className="py-2 px-2 text-right font-mono">₩{trade.close_price?.toLocaleString(undefined, { maximumFractionDigits: 4 }) || '-'}</td>
                        <td className="py-2 px-2 text-right font-mono">{trade.quantity}</td>
                        <td className={`py-2 px-2 text-right font-mono font-bold ${isProfit ? 'stock-up' : 'stock-down'}`}>
                          {isProfit ? '+' : ''}₩{trade.pnl?.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-2 px-2">
                          <Badge variant={trade.status === 'profit_taken' || trade.status === 'trailing_stop' ? 'default' : trade.status === 'stopped' ? 'destructive' : 'secondary'} className="text-[9px]">
                            {trade.status === 'profit_taken' ? '익절' : trade.status === 'trailing_stop' ? '추격익절' : trade.status === 'stopped' ? '손절' : trade.status === 'score_exit' ? '점수청산' : '종료'}
                          </Badge>
                        </td>
                        <td className="py-2 px-2 text-muted-foreground max-w-[300px] truncate">{trade.ai_reason}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
