import { useState, forwardRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuantSignals } from "@/hooks/useStockData";
import { useAIPortfolio, useScalpingPortfolio } from "@/hooks/useStockData";
import { quantAutoTrade, scalpingAnalyze } from "@/lib/api";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  Activity, TrendingUp, Zap, ShoppingCart,
  Loader2, AlertTriangle, CheckCircle2, XCircle,
} from "lucide-react";
import { formatStockName } from "@/lib/koreanStockMap";

interface Props {
  symbol: string;
  currentPrice: number | null;
  fxRate: number;
}

function getScoreColor(score: number): string {
  if (score >= 50) return "text-stock-up";
  if (score >= 40) return "text-warning";
  return "text-stock-down";
}

function getScoreBg(score: number): string {
  if (score >= 50) return "bg-stock-up/10 border-stock-up/30";
  if (score >= 40) return "bg-warning/10 border-warning/30";
  return "bg-stock-down/10 border-stock-down/30";
}

function getIndicatorSummary(indicators: any): { text: string; positive: boolean }[] {
  if (!indicators) return [];
  const items: { text: string; positive: boolean }[] = [];

  const rvol = indicators.rvol?.rvol || indicators.rvol?.score || 0;
  if (typeof rvol === "number" && rvol > 0) {
    const rvolVal = indicators.rvol?.rvol || 0;
    items.push({
      text: `RVOL ${rvolVal >= 1.5 ? "폭증" : rvolVal >= 1 ? "보통" : "저조"} (${typeof rvolVal === 'number' ? rvolVal.toFixed(1) : '?'}x)`,
      positive: rvolVal >= 1.5,
    });
  }

  const rsiScore = indicators.candle?.score || 0;
  const vwapCross = indicators.candle?.vwapCross;
  items.push({
    text: vwapCross ? "VWAP 돌파 ✓" : "VWAP 하회",
    positive: !!vwapCross,
  });

  const sentScore = indicators.sentiment?.score || 0;
  items.push({
    text: `감성 ${sentScore >= 7 ? "강세" : sentScore >= 5 ? "중립" : "약세"} (${sentScore}점)`,
    positive: sentScore >= 5,
  });

  const atrScore = indicators.atr?.score || 0;
  items.push({
    text: `변동성 ${atrScore >= 7 ? "높음" : atrScore >= 4 ? "보통" : "낮음"}`,
    positive: atrScore >= 7,
  });

  const squeezeScore = indicators.squeeze?.score || 0;
  items.push({
    text: squeezeScore >= 6 ? "신고가 근접" : "신고가 이격",
    positive: squeezeScore >= 6,
  });

  const aggrScore = indicators.aggression?.score || 0;
  items.push({
    text: aggrScore >= 7 ? "매수세 강함" : aggrScore >= 4 ? "매수세 보통" : "매수세 약함",
    positive: aggrScore >= 7,
  });

  return items;
}

const INDICATOR_NAMES: Record<string, string> = {
  sentiment: "호재·감성",
  rvol: "거래량 폭증(RVOL)",
  candle: "3중 컨펌(VWAP/EMA/RSI)",
  atr: "ATR 변동성",
  gap: "갭 분석",
  squeeze: "스퀴즈 돌파",
  position: "포지션 상대강도",
  sectorSynergy: "섹터 시너지",
  aggression: "매수 어그레션",
  preMarket: "프리마켓 모멘텀",
};

export function QuantScorePanel({ symbol, currentPrice, fxRate }: Props): React.JSX.Element {
  const { data: quantData, isLoading } = useQuantSignals([symbol]);
  const { data: mainPortfolio } = useAIPortfolio();
  const { data: scalpPortfolio } = useScalpingPortfolio();
  const queryClient = useQueryClient();
  const [buying, setBuying] = useState<"main" | "scalp" | null>(null);

  const result = quantData?.results?.[0];
  const score = result?.totalScore || 0;
  const indicators = result?.indicators;

  const summaryItems = getIndicatorSummary(indicators);

  // Check if already holding
  const alreadyInMain = (mainPortfolio?.openPositions || []).some((p: any) => p.symbol === symbol);
  const alreadyInScalp = (scalpPortfolio?.openPositions || []).some((p: any) => p.symbol === symbol);

  // Balance info
  const mainBalance = mainPortfolio?.wallet?.balance || 0;
  const scalpBalance = scalpPortfolio?.wallet?.balance || 0;

  const handleBuy = async (type: "main" | "scalp") => {
    if (!currentPrice || currentPrice <= 0) {
      toast.error("현재가를 확인할 수 없습니다");
      return;
    }
    setBuying(type);
    try {
      if (type === "main") {
        await quantAutoTrade(symbol, currentPrice, score, indicators);
      } else {
        await scalpingAnalyze(symbol, currentPrice, score, indicators);
      }
      toast.success(`${formatStockName(symbol)} ${type === "main" ? "대형주" : "소형주"} 포트폴리오 매수 요청 완료`);
      // Refresh portfolios
      queryClient.invalidateQueries({ queryKey: ["ai-portfolio"] });
      queryClient.invalidateQueries({ queryKey: ["scalping-portfolio"] });
    } catch (e: any) {
      toast.error(`매수 실패: ${e.message || "알 수 없는 오류"}`);
    } finally {
      setBuying(null);
    }
  };

  return (
    <Card className={`border ${score > 0 ? getScoreBg(score) : ""}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          AI 10대 지표 종합 분석
          {isLoading && (
            <Badge variant="outline" className="ml-auto text-[10px] flex items-center gap-1 animate-pulse">
              <Loader2 className="w-3 h-3 animate-spin" />
              AI 지표 분석 중...
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-20" />
            <Skeleton className="h-16" />
          </div>
        ) : !result ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            지표 데이터를 불러올 수 없습니다
          </p>
        ) : (
          <>
            {/* Big Score */}
            <div className={`rounded-xl p-5 text-center border ${getScoreBg(score)}`}>
              <p className="text-xs text-muted-foreground mb-1">종합 점수</p>
              <p className={`text-5xl font-black font-mono ${getScoreColor(score)}`}>
                {score}
                <span className="text-lg text-muted-foreground font-normal ml-1">/ 100</span>
              </p>
              <div className="flex items-center justify-center gap-2 mt-2">
                {score >= 50 ? (
                  <Badge className="bg-stock-up/20 text-stock-up border-stock-up/30">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    진입 적격
                  </Badge>
                ) : score >= 40 ? (
                  <Badge className="bg-warning/20 text-warning border-warning/30">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    관망 권장
                  </Badge>
                ) : (
                  <Badge className="bg-stock-down/20 text-stock-down border-stock-down/30">
                    <XCircle className="w-3 h-3 mr-1" />
                    진입 부적격
                  </Badge>
                )}
              </div>
            </div>

            {/* Indicator Details Grid */}
            {indicators && (
              <div className="grid grid-cols-2 gap-1.5">
                {Object.entries(INDICATOR_NAMES).map(([key, label]) => {
                  const ind = indicators[key];
                  if (!ind) return null;
                  const s = ind.score || 0;
                  return (
                    <div key={key} className="flex items-center justify-between px-2.5 py-1.5 rounded bg-muted/50 text-xs">
                      <span className="text-muted-foreground truncate">{label}</span>
                      <span className={`font-mono font-bold ${s >= 7 ? "text-stock-up" : s >= 4 ? "text-foreground" : "text-stock-down"}`}>
                        {s}/10
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Summary Tags */}
            <div className="flex flex-wrap gap-1.5">
              {summaryItems.map((item, i) => (
                <Badge
                  key={i}
                  variant="outline"
                  className={`text-[10px] ${item.positive ? "border-stock-up/40 text-stock-up" : "border-stock-down/40 text-stock-down"}`}
                >
                  {item.positive ? "✓" : "✗"} {item.text}
                </Badge>
              ))}
            </div>

            {/* Fast-Buy Buttons */}
            <div className="border-t border-border pt-3 space-y-2">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <ShoppingCart className="w-3 h-3" />
                즉시 매수 (Fast-Entry)
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  variant={score >= 50 ? "default" : "outline"}
                  disabled={buying !== null || !currentPrice || alreadyInMain}
                  onClick={() => handleBuy("main")}
                  className="text-xs"
                >
                  {buying === "main" ? (
                    <Loader2 className="w-3 h-3 animate-spin mr-1" />
                  ) : (
                    <TrendingUp className="w-3 h-3 mr-1" />
                  )}
                  대형주 포트폴리오
                  {alreadyInMain && " (보유중)"}
                </Button>
                <Button
                  size="sm"
                  variant={score >= 50 ? "default" : "outline"}
                  disabled={buying !== null || !currentPrice || alreadyInScalp}
                  onClick={() => handleBuy("scalp")}
                  className="text-xs"
                >
                  {buying === "scalp" ? (
                    <Loader2 className="w-3 h-3 animate-spin mr-1" />
                  ) : (
                    <Zap className="w-3 h-3 mr-1" />
                  )}
                  소형주 포트폴리오
                  {alreadyInScalp && " (보유중)"}
                </Button>
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>대형주 잔고: ₩{Math.round(mainBalance).toLocaleString("ko-KR")}</span>
                <span>소형주 잔고: ₩{Math.round(scalpBalance).toLocaleString("ko-KR")}</span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
