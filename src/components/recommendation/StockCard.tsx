import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bot } from "lucide-react";
import { INDICATOR_LABELS } from "./RadarChartCard";
import { formatStockName } from "@/lib/koreanStockMap";

function ScoreBar({ score, max = 100 }: { score: number; max?: number }) {
  const pct = Math.min((score / max) * 100, 100);
  const color = pct >= 85 ? 'bg-stock-up' : pct >= 55 ? 'bg-warning' : 'bg-stock-down';
  return (
    <div className="w-full bg-muted rounded-full h-2">
      <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

interface StockCardProps {
  stock: any;
  idx: number;
  isSelected: boolean;
  onSelect: (stock: any) => void;
  onTrade: (stock: any) => void;
  isTrading: boolean;
  isAutoMode?: boolean;
}

export function StockCard({ stock, idx, isSelected, onSelect, onTrade, isTrading, isAutoMode }: StockCardProps) {
  const isUp = (stock.changePct || 0) >= 0;

  return (
    <Card
      className={`cursor-pointer transition-all hover:border-primary/40 ${isSelected ? 'border-primary ring-1 ring-primary/20' : ''}`}
      onClick={() => onSelect(stock)}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
              {idx + 1}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold">{formatStockName(stock.symbol)}</span>
                <span className="text-lg font-bold font-mono">₩{((stock.price || 0) * 1350).toLocaleString('ko-KR', { maximumFractionDigits: 0 })}</span>
                <span className={`text-sm font-mono ${isUp ? 'stock-up' : 'stock-down'}`}>
                  {isUp ? '+' : ''}{stock.changePct?.toFixed(2)}%
                </span>
              </div>
              {stock.reason && (
                <p className="text-[10px] text-muted-foreground mt-0.5">📌 {stock.reason}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <p className="text-2xl font-bold font-mono">{stock.totalScore}</p>
              <p className="text-[10px] text-muted-foreground">/100점</p>
            </div>
            {isAutoMode ? (
              <Badge
                variant={isTrading ? "default" : stock.totalScore >= 50 ? "secondary" : "outline"}
                className={`text-[10px] ${isTrading ? 'animate-pulse bg-stock-up/20 text-stock-up border-stock-up/30' : ''}`}
              >
                <Bot className="w-3 h-3 mr-1" />
                {isTrading ? '분석중...' : stock.totalScore >= 50 ? '대기' : '미달'}
              </Badge>
            ) : (
              <Button
                size="sm"
                variant={stock.totalScore >= 85 ? "default" : "outline"}
                onClick={(e) => { e.stopPropagation(); onTrade(stock); }}
                disabled={isTrading}
                className="text-xs"
              >
                <Bot className="w-3 h-3 mr-1" />
                {isTrading ? '분석중...' : 'AI 매매'}
              </Button>
            )}
          </div>
        </div>
        <ScoreBar score={stock.totalScore} />
        <div className="flex flex-wrap gap-1 mt-2">
          {Object.entries(stock.indicators || {}).map(([key, ind]: [string, any]) => (
            <Badge
              key={key}
              variant={ind.score >= 8 ? "default" : ind.score >= 5 ? "secondary" : "outline"}
              className="text-[9px] px-1.5 py-0"
            >
              {INDICATOR_LABELS[key]}: {ind.score}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
