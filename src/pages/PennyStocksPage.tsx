import { useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { usePennyStocks, useScalpingPortfolio } from "@/hooks/useStockData";
import { Flame, Cloud, Radio, ShieldCheck, Eye } from "lucide-react";
import StockCardItem from "@/components/penny/StockCardItem";
import { ServerStatusBanner } from "@/components/trading/ServerStatusBanner";

export default function PennyStocksPage() {
  const { data, isLoading } = usePennyStocks();
  const { data: portfolioData } = useScalpingPortfolio();

  const stocks = data?.stocks || [];
  const openPositions = portfolioData?.openPositions || [];
  const holdingSymbols = new Set(openPositions.map((p: any) => String(p.symbol)));

  const hotStocks = stocks.filter((s: any) => (s.regularMarketChangePercent || 0) >= 10);
  const hotSymbols = new Set(hotStocks.map((s: any) => s.symbol));

  return (
    <div className="space-y-4">
      {/* Strategy Banner */}
      <div className="rounded-lg p-2 border border-destructive/40 bg-destructive/5 flex items-center justify-center gap-2">
        <Flame className="w-4 h-4 text-destructive" />
        <span className="text-xs font-bold text-destructive">소형주 실시간 모니터링</span>
        <span className="text-[10px] text-muted-foreground">| ₩13,500 미만 100+ 종목 로테이션 스캔 | +3% 이상 서버 자동 매매</span>
      </div>

      {/* Server Status */}
      <ServerStatusBanner />

      {/* Cloud Agent Status Bar */}
      <div className="rounded-lg p-3 flex items-center justify-between flex-wrap gap-2 border border-stock-up/50 bg-stock-up/5">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold bg-stock-up/20 text-stock-up">
            <div className="w-2.5 h-2.5 rounded-full bg-stock-up animate-pulse" />
            <Cloud className="w-3.5 h-3.5" />
            CLOUD AGENT: 24/7 서버 자율 매매
          </div>
          <Badge variant="outline" className="text-[10px]">
            <ShieldCheck className="w-3 h-3 mr-1" />
            보유: {openPositions.length}/10
          </Badge>
          <Badge variant="outline" className="text-[10px] border-destructive/40 text-destructive">
            <Flame className="w-3 h-3 mr-1" />
            +10% 타겟: {hotStocks.length}개
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs font-mono">
            <Radio className="w-3 h-3 mr-1" />
            30초 데이터 갱신
          </Badge>
          <Badge variant="outline" className="text-xs">
            <Eye className="w-3 h-3 mr-1" />
            관전 모드
          </Badge>
        </div>
      </div>

      {/* Info Card */}
      <Card className="border-primary/30">
        <CardContent className="p-3 text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">☁️ Cloud Agent — 서버 백그라운드 자율 매매 시스템</p>
          <p>• 100+ 종목 로테이션 스캔 → <span className="text-primary font-medium">TOP 50 실시간 표시</span> → <span className="text-destructive font-medium">+3% 이상 급등 시 서버에서 자동 매수</span></p>
          <p>• 청산: +2%→50% 1차 익절 | +5% 고정 익절 | -2.5% 즉시 손절 | 고점+10% 후 -5% 추격익절</p>
          <p>• 최대 동시 보유: 10종목 | 종목당 지갑의 10% 배분 | <span className="text-primary font-medium">타임컷 없음</span></p>
          <p className="text-primary font-medium mt-1">💡 이 화면은 서버 AI의 활동을 모니터링하는 관전 창입니다. 브라우저를 닫아도 매매는 계속됩니다.</p>
        </CardContent>
      </Card>

      {/* Stock Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-2">
          {Array.from({ length: 20 }).map((_, i) => <Skeleton key={i} className="h-36" />)}
        </div>
      ) : stocks.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            ₩13,500 미만 종목을 스캔 중입니다.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-2">
          {stocks.map((stock: any, idx: number) => (
            <StockCardItem
              key={stock.symbol}
              stock={stock}
              rank={idx + 1}
              isHot={hotSymbols.has(stock.symbol)}
              isTrading={false}
              isHolding={holdingSymbols.has(stock.symbol)}
              autoMode={true}
              onManualTrade={() => {}}
            />
          ))}
        </div>
      )}

      {data?.allScanned && (
        <p className="text-xs text-muted-foreground text-center">
          총 {data.allScanned}개 종목 스캔 → 상위 {stocks.length}개 모니터링 | 🔥 +10% 급등 {hotStocks.length}개 | ☁️ Cloud Agent 24/7 자율 매매 중
        </p>
      )}
    </div>
  );
}
