import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bot, BarChart3, TrendingUp } from "lucide-react";
import { INDICATOR_LABELS } from "./RadarChartCard";
import { formatStockName } from "@/lib/koreanStockMap";
import { useExchangeRate } from "@/hooks/useExchangeRate";

const ScoreBar = React.forwardRef<HTMLDivElement, { score: number; max?: number }>(
  ({ score, max = 100 }, ref) => {
    const pct = Math.min((score / max) * 100, 100);
    const color = pct >= 85 ? 'bg-stock-up' : pct >= 55 ? 'bg-warning' : 'bg-stock-down';
    return (
      <div ref={ref} className="w-full bg-muted rounded-full h-2">
        <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    );
  }
);
ScoreBar.displayName = "ScoreBar";

function formatTradingValueKRW(volumeUSD: number, rate: number): string {
  const krw = volumeUSD * rate;
  if (krw >= 1e8) return `${(krw / 1e8).toFixed(1)}억`;
  if (krw >= 1e4) return `${(krw / 1e4).toFixed(0)}만`;
  return `${krw.toFixed(0)}`;
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

export const StockCard = React.forwardRef<HTMLDivElement, StockCardProps>(
  ({ stock, idx, isSelected, onSelect, onTrade, isTrading, isAutoMode }, ref) => {
    const isUp = (stock.changePct || stock.regularMarketChangePercent || 0) >= 0;
    const changePct = stock.changePct || stock.regularMarketChangePercent || 0;
    const price = stock.price || stock.regularMarketPrice || 0;
    const { rate } = useExchangeRate();
    
    // Volume/trading value info
    const volume = stock.regularMarketVolume || stock.volume || 0;
    const tradingValueUSD = volume * price;
    const rvol = stock.indicators?.rvol?.rvol || 0;

    // ★ 홀딩 근거 표시: 가격 하락 중이지만 지표 양호
    const isPriceDown = changePct < 0;
    const scoreStrong = stock.totalScore >= 55;
    const showHoldingStatus = isPriceDown && scoreStrong;

    return (
      <Card
        ref={ref}
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
                  <span className="text-lg font-bold font-mono">₩{(price * rate).toLocaleString('ko-KR', { maximumFractionDigits: 0 })}</span>
                  <span className={`text-sm font-mono ${isUp ? 'stock-up' : 'stock-down'}`}>
                    {isUp ? '+' : ''}{changePct?.toFixed(2)}%
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {/* 거래대금 (원화) */}
                  {tradingValueUSD > 0 && (
                    <Badge variant="outline" className="text-[9px] px-1 py-0 gap-0.5 border-primary/30 text-primary">
                      <BarChart3 className="w-2.5 h-2.5" />
                      ₩{formatTradingValueKRW(tradingValueUSD, rate)}
                    </Badge>
                  )}
                  {/* RVOL 표시 */}
                  {rvol >= 2 && (
                    <Badge variant="outline" className="text-[9px] px-1 py-0 gap-0.5 border-stock-up/30 text-stock-up">
                      <TrendingUp className="w-2.5 h-2.5" />
                      RVOL {rvol.toFixed(1)}x
                    </Badge>
                  )}
                  {stock.capType && (
                    <Badge variant="outline" className="text-[9px] px-1 py-0">
                      {stock.capType === 'large' ? '대형' : '소형'}
                    </Badge>
                  )}
                  {stock.regularMarketPrice && (stock.regularMarketPrice * 1350) < 12000 && (
                    <Badge variant="outline" className="text-[9px] px-1 py-0 border-yellow-500/50 bg-yellow-500/20 text-yellow-400 font-bold">
                      💰 ₩12K 미만
                    </Badge>
                  )}
                </div>
                {stock.reason && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">📌 {stock.reason}</p>
                )}
                {showHoldingStatus && (
                  <p className="text-[10px] text-stock-up mt-0.5 font-medium">
                    🛡️ 지표 양호({stock.totalScore}점) - 홀딩 중
                  </p>
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
);
StockCard.displayName = "StockCard";
