import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, Play, Pause, RotateCcw, Target, Wallet, TrendingUp, ClipboardList, ShieldAlert } from "lucide-react";

const GITHUB_STOCKS_CSV_URL = "https://raw.githubusercontent.com/vega/vega-datasets/main/data/stocks.csv";
const START_BALANCE_KRW = 1_000_000;
const DAILY_TARGET_KRW = 300_000;
const MAX_ENTRY_PRICE_KRW = 12_000;
const MAX_LOGS = 500;

type SimStatus = "idle" | "running" | "completed";

type LogType =
  | "SCAN"
  | "BUY_ORDER"
  | "BUY_FILLED"
  | "SELL_ORDER"
  | "SELL_FILLED"
  | "RISK_LOCK"
  | "GOAL";

interface PricePoint {
  date: string;
  timestamp: number;
  price: number;
}

interface MarketData {
  symbols: string[];
  bySymbol: Record<string, PricePoint[]>;
  timeline: string[];
}

interface Position {
  symbol: string;
  entryDate: string;
  entryPriceUsd: number;
  quantity: number;
  stopLossUsd: number;
  takeProfitUsd: number;
  highestPriceUsd: number;
  barsHeld: number;
}

interface TradeRecord {
  id: string;
  symbol: string;
  buyDate: string;
  buyPriceKrw: number;
  sellDate: string;
  sellPriceKrw: number;
  quantity: number;
  pnlKrw: number;
  reason: string;
  // Backward compatibility for previously cached localStorage records
  buyPriceUsd?: number;
  sellPriceUsd?: number;
}

interface LogEntry {
  id: string;
  date: string;
  type: LogType;
  message: string;
}

interface SimState {
  cursor: number;
  cashKrw: number;
  realizedPnlKrw: number;
  status: SimStatus;
  position: Position | null;
  trades: TradeRecord[];
  logs: LogEntry[];
}

const STORAGE_KEY = "github-free-paper-trading-v2";

const createInitialSimState = (): SimState => ({
  cursor: 3,
  cashKrw: START_BALANCE_KRW,
  realizedPnlKrw: 0,
  status: "idle",
  position: null,
  trades: [],
  logs: [],
});

function formatKrw(value: number) {
  return `₩${Math.round(value).toLocaleString("ko-KR")}`;
}

function toId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function parseCsvToMarketData(csv: string): MarketData {
  const rows = csv.trim().split("\n").slice(1);
  const bySymbol: Record<string, PricePoint[]> = {};

  rows.forEach((row) => {
    const [symbolRaw, dateRaw, priceRaw] = row.split(",");
    const symbol = symbolRaw?.trim();
    const date = dateRaw?.trim();
    const price = Number(priceRaw);
    const timestamp = new Date(date).getTime();
    if (!symbol || !date || Number.isNaN(price) || Number.isNaN(timestamp)) {
      return;
    }
    if (!bySymbol[symbol]) bySymbol[symbol] = [];
    bySymbol[symbol].push({ date, timestamp, price });
  });

  const preferredSymbols = ["AAPL", "MSFT", "AMZN", "GOOG", "IBM"];
  const symbols = preferredSymbols.filter((symbol) => bySymbol[symbol]?.length);

  if (symbols.length === 0) {
    return { symbols: [], bySymbol, timeline: [] };
  }

  symbols.forEach((symbol) => {
    bySymbol[symbol] = bySymbol[symbol].sort((a, b) => a.timestamp - b.timestamp);
  });

  const minLength = Math.min(...symbols.map((symbol) => bySymbol[symbol].length));
  const timeline = bySymbol[symbols[0]].slice(0, minLength).map((point) => point.date);
  symbols.forEach((symbol) => {
    bySymbol[symbol] = bySymbol[symbol].slice(0, minLength);
  });

  return { symbols, bySymbol, timeline };
}

export function GitHubPaperCompoundDashboard({ fxRate = 1350 }: { fxRate?: number }) {
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sim, setSim] = useState<SimState>(createInitialSimState);
  const restoredRef = useRef(false);

  const appendLog = useCallback((logs: LogEntry[], date: string, type: LogType, message: string) => {
    const next = [{ id: toId(), date, type, message }, ...logs];
    return next.slice(0, MAX_LOGS);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await fetch(GITHUB_STOCKS_CSV_URL);
        if (!res.ok) throw new Error(`GitHub API 응답 오류: ${res.status}`);
        const csv = await res.text();
        const parsed = parseCsvToMarketData(csv);
        if (!cancelled) setMarketData(parsed);
      } catch (error) {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : "무료 API 로딩 실패");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!marketData || restoredRef.current) return;
    restoredRef.current = true;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as SimState;
      if (!parsed || typeof parsed !== "object") return;
      setSim({
        ...createInitialSimState(),
        ...parsed,
        status: parsed.status === "running" ? "idle" : parsed.status,
      });
    } catch {
      // Ignore broken cache and continue with fresh simulator state.
    }
  }, [marketData]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sim));
  }, [sim]);

  const currentPrices = useMemo(() => {
    if (!marketData) return {} as Record<string, number>;
    const prices: Record<string, number> = {};
    marketData.symbols.forEach((symbol) => {
      prices[symbol] = marketData.bySymbol[symbol]?.[sim.cursor]?.price;
    });
    return prices;
  }, [marketData, sim.cursor]);

  const currentDate = marketData?.timeline[sim.cursor] || "-";
  const openPositionValueKrw =
    sim.position && currentPrices[sim.position.symbol]
      ? currentPrices[sim.position.symbol] * sim.position.quantity * fxRate
      : 0;
  const equityKrw = sim.cashKrw + openPositionValueKrw;
  const goalProgress = Math.max(0, Math.min(100, (sim.realizedPnlKrw / DAILY_TARGET_KRW) * 100));

  const runTick = useCallback(() => {
    if (!marketData) return;
    setSim((prev) => {
      if (prev.status !== "running") return prev;
      if (prev.cursor >= marketData.timeline.length) {
        const doneLogs = appendLog(prev.logs, "-", "GOAL", "데이터 구간이 끝나 자동매매를 종료했습니다.");
        return { ...prev, status: "completed", logs: doneLogs };
      }

      const date = marketData.timeline[prev.cursor];
      const priceAt = (symbol: string) => marketData.bySymbol[symbol]?.[prev.cursor]?.price ?? null;
      let logs = prev.logs;
      let trades = prev.trades;
      let cashKrw = prev.cashKrw;
      let realizedPnlKrw = prev.realizedPnlKrw;
      let position = prev.position;
      let status: SimStatus = prev.status;

      const ranked = marketData.symbols
        .map((symbol) => {
          const now = marketData.bySymbol[symbol]?.[prev.cursor]?.price;
          const prev1 = marketData.bySymbol[symbol]?.[prev.cursor - 1]?.price;
          const prev2 = marketData.bySymbol[symbol]?.[prev.cursor - 2]?.price;
          if (!now || !prev1 || !prev2) return null;
          const momentumPct = ((now / prev2) - 1) * 100;
          const slopePct = ((now / prev1) - 1) * 100;
          const nowKrw = now * fxRate;
          return { symbol, now, nowKrw, momentumPct, slopePct };
        })
        .filter(Boolean)
        .sort((a: any, b: any) => b.momentumPct - a.momentumPct);

      if (ranked[0]) {
        logs = appendLog(
          logs,
          date,
          "SCAN",
          `후보 1위 ${ranked[0].symbol} | 현재가 ${formatKrw(ranked[0].nowKrw)} | 모멘텀 ${ranked[0].momentumPct.toFixed(2)}% | 단기기울기 ${ranked[0].slopePct.toFixed(2)}%`
        );
      }

      if (position) {
        const priceNow = priceAt(position.symbol);
        if (priceNow) {
          const updatedHighest = Math.max(position.highestPriceUsd, priceNow);
          let stopLossUsd = position.stopLossUsd;
          let takeProfitUsd = position.takeProfitUsd;
          let barsHeld = position.barsHeld + 1;

          if (priceNow >= position.entryPriceUsd * 1.005 && stopLossUsd < position.entryPriceUsd * 1.001) {
            stopLossUsd = position.entryPriceUsd * 1.001;
            logs = appendLog(logs, date, "RISK_LOCK", `${position.symbol} 본절 보호 라인 상향 (${formatKrw(stopLossUsd * fxRate)})`);
          }
          if (updatedHighest >= position.entryPriceUsd * 1.015) {
            takeProfitUsd = Math.max(takeProfitUsd, updatedHighest * 0.997);
          }

          let exitReason: string | null = null;
          if (priceNow >= takeProfitUsd) exitReason = "익절 조건 충족";
          else if (priceNow <= stopLossUsd) exitReason = stopLossUsd > position.entryPriceUsd ? "본절 보호 청산" : "리스크 손절";
          else if (barsHeld >= 5 && priceNow >= position.entryPriceUsd * 1.002) exitReason = "시간 기반 익절";
          else if (barsHeld >= 7) exitReason = "시간 기반 청산";

          if (exitReason) {
            logs = appendLog(logs, date, "SELL_ORDER", `${position.symbol} 매도 주문 | 사유: ${exitReason}`);
            const gross = priceNow * position.quantity * fxRate;
            const cost = position.entryPriceUsd * position.quantity * fxRate;
            const pnlKrw = gross - cost;
            cashKrw += gross;
            realizedPnlKrw += pnlKrw;
            trades = [
              {
                id: toId(),
                symbol: position.symbol,
                buyDate: position.entryDate,
                buyPriceKrw: position.entryPriceUsd * fxRate,
                sellDate: date,
                sellPriceKrw: priceNow * fxRate,
                quantity: position.quantity,
                pnlKrw,
                reason: exitReason,
              },
              ...trades,
            ];
            logs = appendLog(
              logs,
              date,
              "SELL_FILLED",
              `${position.symbol} 체결 완료 | ${position.quantity}주 @ ${formatKrw(priceNow * fxRate)} | 손익 ${formatKrw(pnlKrw)} | 잔고 ${formatKrw(cashKrw)}`
            );
            position = null;
          } else {
            position = {
              ...position,
              highestPriceUsd: updatedHighest,
              stopLossUsd,
              takeProfitUsd,
              barsHeld,
            };
          }
        }
      }

      const eligibleRanked = ranked.filter((item: any) => item.nowKrw < MAX_ENTRY_PRICE_KRW);
      if (!position && ranked.length > 0 && eligibleRanked.length === 0) {
        logs = appendLog(
          logs,
          date,
          "SCAN",
          `진입 보류: ${MAX_ENTRY_PRICE_KRW.toLocaleString("ko-KR")}원 미만 종목 조건 불충족`
        );
      }

      if (!position && eligibleRanked[0] && eligibleRanked[0].momentumPct >= 0.8 && eligibleRanked[0].slopePct > 0) {
        const target = eligibleRanked[0];
        const tradeBudgetKrw = Math.max(0, cashKrw * 0.25);
        const oneShareKrw = target.now * fxRate;
        const quantity = Math.floor(tradeBudgetKrw / oneShareKrw);

        if (quantity > 0) {
          const orderCostKrw = quantity * oneShareKrw;
          logs = appendLog(
            logs,
            date,
            "BUY_ORDER",
            `${target.symbol} 매수 주문 | 단가 ${formatKrw(oneShareKrw)} | 배정 ${formatKrw(tradeBudgetKrw)} | 수량 ${quantity}주`
          );
          cashKrw -= orderCostKrw;
          position = {
            symbol: target.symbol,
            entryDate: date,
            entryPriceUsd: target.now,
            quantity,
            stopLossUsd: target.now * 0.992,
            takeProfitUsd: target.now * 1.012,
            highestPriceUsd: target.now,
            barsHeld: 0,
          };
          logs = appendLog(
            logs,
            date,
            "BUY_FILLED",
            `${target.symbol} 체결 완료 | ${quantity}주 @ ${formatKrw(oneShareKrw)} | 현금 ${formatKrw(cashKrw)}`
          );
        }
      }

      if (realizedPnlKrw >= DAILY_TARGET_KRW && status !== "completed") {
        status = "completed";
        logs = appendLog(logs, date, "GOAL", `일 목표 ${formatKrw(DAILY_TARGET_KRW)} 달성. 자동매매를 종료합니다.`);
      }

      const nextCursor = prev.cursor + 1;
      if (nextCursor >= marketData.timeline.length) {
        status = "completed";
      }

      return {
        cursor: nextCursor,
        cashKrw,
        realizedPnlKrw,
        status,
        position,
        trades,
        logs,
      };
    });
  }, [appendLog, fxRate, marketData]);

  useEffect(() => {
    if (sim.status !== "running") return;
    const timer = window.setInterval(runTick, 900);
    return () => window.clearInterval(timer);
  }, [runTick, sim.status]);

  const handleReset = () => {
    if (!confirm("가상머니 자동복리 시뮬레이터를 초기화할까요? 로그/거래기록이 모두 초기화됩니다.")) return;
    const fresh = createInitialSimState();
    setSim(fresh);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">GitHub 무료 API 데이터 로딩 중...</CardContent>
      </Card>
    );
  }

  if (loadError || !marketData) {
    return (
      <Card className="border-destructive/40">
        <CardContent className="p-6 text-sm text-destructive">
          무료 API 로딩 실패: {loadError || "알 수 없는 오류"}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-3 text-xs text-muted-foreground space-y-1.5">
          <p className="font-semibold text-foreground flex items-center gap-1.5">
            <Bot className="w-3.5 h-3.5 text-primary" />
            GitHub 무료 API 기반 자동 복리매매 (무과금 데이터 모드)
          </p>
          <p>데이터 소스: vega-datasets 공개 CSV (GitHub Raw) / API Key 없음 / 유료 과금 없음</p>
          <p>시작 자금: {formatKrw(START_BALANCE_KRW)} · 일 목표: {formatKrw(DAILY_TARGET_KRW)}</p>
          <p>진입 필터: 현재가 {MAX_ENTRY_PRICE_KRW.toLocaleString("ko-KR")}원 미만 종목만 거래</p>
          <p className="text-warning flex items-center gap-1">
            <ShieldAlert className="w-3.5 h-3.5" />
            실제 시장에서 손익 보장은 불가능합니다. 본 모드는 학습용 자동매매 시뮬레이터입니다.
          </p>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className="text-[10px] border-stock-up/30 text-stock-up">Free API</Badge>
        <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">₩12,000 미만 진입 필터</Badge>
        <Badge variant="outline" className="text-[10px]">진행 데이터: {currentDate}</Badge>
        <Badge variant="outline" className={`text-[10px] ${sim.status === "running" ? "border-warning/30 text-warning" : ""}`}>
          상태: {sim.status === "running" ? "자동매매 실행 중" : sim.status === "completed" ? "종료" : "대기"}
        </Badge>
        <div className="ml-auto flex items-center gap-2">
          {sim.status === "running" ? (
            <Button size="sm" variant="outline" onClick={() => setSim((s) => ({ ...s, status: "idle" }))}>
              <Pause className="w-3.5 h-3.5 mr-1" />
              일시정지
            </Button>
          ) : (
            <Button size="sm" onClick={() => setSim((s) => ({ ...s, status: "running" }))}>
              <Play className="w-3.5 h-3.5 mr-1" />
              자동매매 시작
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={handleReset}>
            <RotateCcw className="w-3.5 h-3.5 mr-1" />
            초기화
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Wallet className="w-3.5 h-3.5" />확정 현금</p>
            <p className="text-lg font-bold font-mono">{formatKrw(sim.cashKrw)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5" />평가자산</p>
            <p className="text-lg font-bold font-mono">{formatKrw(equityKrw)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Target className="w-3.5 h-3.5" />일 실현손익</p>
            <p className={`text-lg font-bold font-mono ${sim.realizedPnlKrw >= 0 ? "text-stock-up" : "text-stock-down"}`}>
              {sim.realizedPnlKrw >= 0 ? "+" : "-"}{formatKrw(Math.abs(sim.realizedPnlKrw))}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-2">
            <p className="text-xs text-muted-foreground">목표 달성률</p>
            <Progress value={goalProgress} />
            <p className="text-[11px] text-muted-foreground">{goalProgress.toFixed(1)}% / {formatKrw(DAILY_TARGET_KRW)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">현재 포지션</CardTitle>
        </CardHeader>
        <CardContent>
          {!sim.position ? (
            <p className="text-sm text-muted-foreground">보유 포지션 없음 (스캔 후 자동 진입 대기)</p>
          ) : (
            <div className="text-sm space-y-1">
              <p><span className="text-muted-foreground">종목:</span> <span className="font-semibold">{sim.position.symbol}</span></p>
              <p><span className="text-muted-foreground">진입:</span> {sim.position.entryDate} @ {formatKrw(sim.position.entryPriceUsd * fxRate)}</p>
              <p><span className="text-muted-foreground">수량:</span> {sim.position.quantity}주</p>
              <p><span className="text-muted-foreground">익절/손절:</span> {formatKrw(sim.position.takeProfitUsd * fxRate)} / {formatKrw(sim.position.stopLossUsd * fxRate)}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">매매 기록 (매수/매도 결과)</CardTitle>
          </CardHeader>
          <CardContent>
            {sim.trades.length === 0 ? (
              <p className="text-sm text-muted-foreground">아직 완료된 매매가 없습니다.</p>
            ) : (
              <ScrollArea className="h-[320px]">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="text-left py-2 px-2">종목</th>
                        <th className="text-left py-2 px-2">매수</th>
                        <th className="text-left py-2 px-2">매도</th>
                        <th className="text-right py-2 px-2">수량</th>
                        <th className="text-right py-2 px-2">손익</th>
                        <th className="text-left py-2 px-2">사유</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sim.trades.map((trade) => (
                        <tr key={trade.id} className="border-b border-border/50">
                          <td className="py-2 px-2 font-semibold">{trade.symbol}</td>
                          <td className="py-2 px-2">{trade.buyDate}<br />{formatKrw(trade.buyPriceKrw ?? ((trade.buyPriceUsd || 0) * fxRate))}</td>
                          <td className="py-2 px-2">{trade.sellDate}<br />{formatKrw(trade.sellPriceKrw ?? ((trade.sellPriceUsd || 0) * fxRate))}</td>
                          <td className="py-2 px-2 text-right">{trade.quantity}</td>
                          <td className={`py-2 px-2 text-right font-semibold ${trade.pnlKrw >= 0 ? "text-stock-up" : "text-stock-down"}`}>
                            {trade.pnlKrw >= 0 ? "+" : "-"}{formatKrw(Math.abs(trade.pnlKrw))}
                          </td>
                          <td className="py-2 px-2">{trade.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ClipboardList className="w-4 h-4" />
              전략 로그 (스캔/매수주문/체결/매도주문/체결)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sim.logs.length === 0 ? (
              <p className="text-sm text-muted-foreground">아직 로그가 없습니다.</p>
            ) : (
              <ScrollArea className="h-[320px]">
                <div className="space-y-1.5">
                  {sim.logs.map((log) => (
                    <div key={log.id} className="rounded-md border border-border/60 p-2">
                      <div className="flex items-center gap-2 text-[11px]">
                        <Badge variant="secondary" className="text-[10px]">{log.type}</Badge>
                        <span className="text-muted-foreground">{log.date}</span>
                      </div>
                      <p className="text-xs mt-1">{log.message}</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
