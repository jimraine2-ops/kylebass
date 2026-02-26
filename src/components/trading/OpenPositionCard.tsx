import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Shield } from "lucide-react";
import { formatStockName } from "@/lib/koreanStockMap";

interface OpenPositionCardProps {
  position: any;
  onSelect?: () => void;
  isSelected?: boolean;
  livePrice?: number | null;
  fxRate?: number;
}

function getStrategyTag(aiReason: string | null): { label: string; color: string } {
  if (!aiReason) return { label: 'Main', color: 'bg-primary/20 text-primary border-primary/30' };
  if (aiReason.startsWith('[Quant]')) return { label: 'Quant', color: 'bg-stock-up/20 text-stock-up border-stock-up/30' };
  if (aiReason.startsWith('[Scalp]')) return { label: 'Scalp', color: 'bg-warning/20 text-warning border-warning/30' };
  return { label: 'Main', color: 'bg-primary/20 text-primary border-primary/30' };
}

export function OpenPositionCard({ position: pos, onSelect, isSelected, livePrice }: OpenPositionCardProps) {
  const displayPrice = livePrice ?? pos.currentPrice ?? pos.price;
  const investmentKRW = Math.round(pos.price * pos.quantity * 1350);
  const currentValueKRW = Math.round(displayPrice * pos.quantity * 1350);
  const unrealizedPnl = currentValueKRW - investmentKRW;
  const unrealizedPnlPct = investmentKRW > 0 ? ((currentValueKRW / investmentKRW) - 1) * 100 : 0;
  const isProfit = unrealizedPnl >= 0;
  const pnlColor = isProfit ? 'stock-up' : 'stock-down';
  const tag = getStrategyTag(pos.ai_reason);

  return (
    <div
      className={`p-3 rounded-lg bg-muted/50 border space-y-2 transition-all ${
        onSelect ? 'cursor-pointer hover:border-primary/40' : ''
      } ${isSelected ? 'border-primary ring-1 ring-primary/20' : 'border-border'}`}
      onClick={onSelect}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${tag.color}`}>
            {tag.label}
          </Badge>
          <span className="font-bold text-sm">{formatStockName(pos.symbol)}</span>
          <span className="text-xs text-muted-foreground">{pos.quantity}주 @ ₩{Math.round((pos.price || 0) * 1350).toLocaleString('ko-KR')}</span>
          <Badge variant="outline" className="text-[10px]">
            신뢰도: {pos.ai_confidence}%
          </Badge>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-muted-foreground">현재가{livePrice ? ' 🟢' : ''}</p>
            <p className="text-sm font-mono font-bold">₩{Math.round(displayPrice * 1350).toLocaleString('ko-KR')}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">미실현 PnL</p>
            <p className={`text-sm font-mono font-bold ${pnlColor}`}>
              {isProfit ? '+' : ''}₩{unrealizedPnl.toLocaleString()}
              <span className="text-[10px] ml-1">({isProfit ? '+' : ''}{unrealizedPnlPct.toFixed(2)}%)</span>
            </p>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <Shield className="w-3 h-3 text-destructive" />
          SL: ₩{Math.round((pos.stop_loss || 0) * 1350).toLocaleString('ko-KR')}
        </span>
        <span className="flex items-center gap-1">
          {isProfit ? <TrendingUp className="w-3 h-3 text-stock-up" /> : <TrendingDown className="w-3 h-3 text-stock-down" />}
          TP: ₩{Math.round((pos.take_profit || 0) * 1350).toLocaleString('ko-KR')}
        </span>
        {onSelect && (
          <span className="text-primary text-[9px]">
            {isSelected ? '▲ 레이더 차트 닫기' : '▼ 클릭하여 레이더 차트 보기'}
          </span>
        )}
      </div>
    </div>
  );
}
