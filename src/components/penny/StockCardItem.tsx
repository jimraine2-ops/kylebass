import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Zap, Bot, Crown, BarChart3, Flame, Eye } from "lucide-react";
import { Link } from "react-router-dom";

function RankBadge({ rank }: { rank: number }) {
  const colors = rank <= 3
    ? "bg-warning/20 text-warning border-warning/30"
    : "bg-muted text-muted-foreground border-border";
  return (
    <Badge variant="outline" className={`text-[10px] font-bold ${colors}`}>
      {rank <= 3 && <Crown className="w-2.5 h-2.5 mr-0.5" />}
      #{rank}
    </Badge>
  );
}

function VolumeBar({ surge }: { surge: number }) {
  const pct = Math.min(surge * 20, 100);
  return (
    <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden mt-1">
      <div
        className="h-full rounded-full bg-primary transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

interface StockCardItemProps {
  stock: any;
  rank: number;
  isHot: boolean;
  isTrading: boolean;
  isHolding: boolean;
  autoMode: boolean;
  onManualTrade: () => void;
}

export default function StockCardItem({ stock, rank, isHot, isTrading, isHolding, autoMode, onManualTrade }: StockCardItemProps) {
  const isUp = (stock.regularMarketChange || 0) >= 0;
  const changePct = stock.regularMarketChangePercent || 0;

  // Glow & blink for +20% hot stocks
  const hotBlink = isHot ? 'animate-pulse border-destructive/70 shadow-[0_0_20px_rgba(239,68,68,0.4)] ring-1 ring-destructive/40' : '';
  const glowClass = isTrading
    ? 'border-warning/60 shadow-[0_0_15px_rgba(234,179,8,0.3)] ring-1 ring-warning/30'
    : isHolding
    ? 'border-primary/50 ring-1 ring-primary/20'
    : hotBlink || 'hover:border-primary/40';

  return (
    <Card className={`relative overflow-hidden transition-all duration-500 ease-in-out hover:shadow-md group ${glowClass}`}>
      {/* Top indicator bar */}
      {isTrading && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-warning via-primary to-warning animate-pulse" />
      )}
      {isHot && !isTrading && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-destructive animate-pulse" />
      )}
      {isHolding && !isTrading && !isHot && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary/60" />
      )}

      <CardContent className="p-3 space-y-1.5">
        {/* Rank + Symbol + Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <RankBadge rank={rank} />
            <Link to={`/stock/${stock.symbol}`} className="font-bold text-xs hover:text-primary transition-colors">
              {stock.symbol}
            </Link>
          </div>
          <div className="flex items-center gap-0.5">
            {isHot && (
              <Badge variant="destructive" className="text-[8px] px-1 py-0 animate-pulse">
                <Flame className="w-2.5 h-2.5 mr-0.5" />
                +20%
              </Badge>
            )}
            {isTrading && (
              <Badge className="text-[8px] px-1 py-0 bg-warning/20 text-warning border-warning/30 animate-pulse">
                <Bot className="w-2.5 h-2.5" />
              </Badge>
            )}
            {isHolding && !isTrading && (
              <Badge className="text-[8px] px-1 py-0 bg-primary/20 text-primary border-primary/30">
                보유
              </Badge>
            )}
          </div>
        </div>

        {/* Price */}
        <p className="text-lg font-bold font-mono">
          ₩{((stock.regularMarketPrice || 0) * 1350).toLocaleString('ko-KR', { maximumFractionDigits: 0 })}
        </p>

        {/* Change */}
        <div className={`flex items-center gap-1 ${isUp ? 'stock-up' : 'stock-down'}`}>
          {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          <span className="text-xs font-mono">
            {isUp ? '+' : ''}{changePct.toFixed(2)}%
          </span>
        </div>

        {/* Score */}
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-muted-foreground">점수</span>
          <Badge variant="secondary" className="text-[10px] font-mono">
            {stock.compositeScore || 0}
          </Badge>
        </div>

        {/* Status */}
        {autoMode ? (
          <div className={`w-full text-center text-[9px] h-6 mt-0.5 flex items-center justify-center rounded-md border ${
            isHot ? 'border-destructive/30 bg-destructive/10 text-destructive' : 'border-border/50 bg-muted/30 text-muted-foreground'
          }`}>
            {isTrading ? '🔄 매매중...' : isHolding ? '✅ 관리중' : isHot ? '🎯 매매 대상' : <><Eye className="w-2.5 h-2.5 mr-0.5" />관망</>}
          </div>
        ) : (
          <Button
            size="sm"
            variant={isHot ? "destructive" : "outline"}
            className="w-full text-[9px] h-6 mt-0.5"
            onClick={onManualTrade}
            disabled={isTrading}
          >
            <Bot className="w-3 h-3 mr-1" />
            {isTrading ? '분석중...' : isHot ? '즉시 매매' : '수동 매매'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
