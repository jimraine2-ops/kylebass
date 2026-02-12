import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Shield } from "lucide-react";

interface OpenPositionCardProps {
  position: any;
}

export function OpenPositionCard({ position: pos }: OpenPositionCardProps) {
  const isProfit = (pos.unrealizedPnl || 0) >= 0;
  const pnlColor = isProfit ? 'stock-up' : 'stock-down';

  return (
    <div className="p-3 rounded-lg bg-muted/50 border border-border space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-bold text-sm">{pos.symbol}</span>
          <span className="text-xs text-muted-foreground">{pos.quantity}주 @ ${pos.price}</span>
          <Badge variant="outline" className="text-[10px]">
            신뢰도: {pos.ai_confidence}%
          </Badge>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-muted-foreground">현재가</p>
            <p className="text-sm font-mono font-bold">${pos.currentPrice?.toFixed(2) || '-'}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">미실현 PnL</p>
            <p className={`text-sm font-mono font-bold ${pnlColor}`}>
              {isProfit ? '+' : ''}{pos.unrealizedPnl?.toFixed(2) || '0.00'}
              <span className="text-[10px] ml-1">({isProfit ? '+' : ''}{pos.unrealizedPnlPct?.toFixed(2) || '0'}%)</span>
            </p>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <Shield className="w-3 h-3 text-destructive" />
          SL: ${pos.stop_loss}
        </span>
        <span className="flex items-center gap-1">
          {isProfit ? <TrendingUp className="w-3 h-3 text-stock-up" /> : <TrendingDown className="w-3 h-3 text-stock-down" />}
          TP: ${pos.take_profit}
        </span>
      </div>
    </div>
  );
}
