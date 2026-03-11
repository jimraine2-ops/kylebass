import { Clock, TrendingUp, Search, Zap, ShoppingCart, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "sonner";
import type { KoreanStockEntry } from "@/lib/koreanStockMap";

interface InlineDataProps {
  price?: number;
  score?: number;
  toKRW: (n: number) => number;
}

export function InlineScoreBadge({ score }: { score: number }) {
  const color = score >= 60 ? "text-stock-up" : score >= 45 ? "text-warning" : "text-stock-down";
  const bg = score >= 60 ? "bg-stock-up/15 border-stock-up/30" : score >= 45 ? "bg-warning/15 border-warning/30" : "bg-stock-down/15 border-stock-down/30";
  const label = score >= 60 ? "진입적격" : score >= 45 ? "관찰" : "부적격";
  return (
    <span className={`text-[10px] font-mono font-black px-1.5 py-0.5 rounded border ${bg} ${color} flex items-center gap-1`}>
      <Zap className="w-2.5 h-2.5" />
      {score}점
      <span className="font-normal opacity-70">({label})</span>
    </span>
  );
}

export function InlinePriceBadge({ price, toKRW }: { price: number; toKRW: (n: number) => number }) {
  return (
    <span className="text-[10px] font-mono text-foreground/80">
      ₩{toKRW(price).toLocaleString('ko-KR')}
    </span>
  );
}

interface InstantBuyButtonProps {
  symbol: string;
  price: number;
  score: number;
  toKRW: (n: number) => number;
}

export function InstantBuyButton({ symbol, price, score, toKRW }: InstantBuyButtonProps) {
  const [loading, setLoading] = useState(false);

  if (score < 40 || !price || price <= 0) return null;

  const handleBuy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading(true);
    try {
      const capType = price >= 10 ? 'large' : 'small';
      const krwPrice = toKRW(price);
      const maxBudget = 50000; // ₩50,000 per quick buy
      const qty = Math.max(1, Math.floor(maxBudget / krwPrice));
      
      const { data, error } = await supabase.functions.invoke('ai-trading', {
        body: {
          action: 'manual-buy',
          symbol,
          price,
          quantity: qty,
          capType,
          reason: `[즉시매수] ${symbol} ${score}점 | ${qty}주@₩${krwPrice.toLocaleString('ko-KR')}`,
        },
      });
      
      if (error) throw error;
      toast.success(`${symbol} ${qty}주 매수 완료`, {
        description: `₩${(krwPrice * qty).toLocaleString('ko-KR')} | 점수: ${score}점`,
      });
    } catch (err: any) {
      toast.error('매수 실패', { description: err.message || '잠시 후 다시 시도해주세요' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      size="sm"
      variant={score >= 60 ? "default" : "outline"}
      className="h-6 px-2 text-[10px] font-bold gap-1 shrink-0"
      onClick={handleBuy}
      disabled={loading}
    >
      {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShoppingCart className="w-3 h-3" />}
      즉시매수
    </Button>
  );
}

interface SearchResultItemProps {
  symbol: string;
  koreanName?: string;
  englishName?: string;
  category?: string;
  type?: string;
  exchange?: string;
  price?: number;
  score?: number;
  toKRW: (n: number) => number;
  onSelect: (symbol: string, label?: string) => void;
}

export function SearchResultItem({
  symbol, koreanName, englishName, category, type, exchange,
  price, score, toKRW, onSelect,
}: SearchResultItemProps) {
  return (
    <li
      className="px-4 py-2.5 hover:bg-accent cursor-pointer flex items-center justify-between gap-2 text-sm transition-colors"
      onClick={() => onSelect(symbol, koreanName || englishName)}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="font-mono font-bold text-primary shrink-0 text-sm">{symbol}</span>
        <div className="min-w-0">
          {koreanName && (
            <p className="text-foreground font-medium truncate text-xs leading-tight">{koreanName}</p>
          )}
          <p className="text-muted-foreground truncate text-[10px] leading-tight">
            {englishName || "—"}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {price != null && price > 0 && <InlinePriceBadge price={price} toKRW={toKRW} />}
        {score != null && <InlineScoreBadge score={score} />}
        {score != null && price != null && price > 0 && (
          <InstantBuyButton symbol={symbol} price={price} score={score} toKRW={toKRW} />
        )}
        {(category || type || exchange) && (
          <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            {category || type || exchange}
          </span>
        )}
      </div>
    </li>
  );
}
