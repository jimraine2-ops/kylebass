import { useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bot, Zap } from "lucide-react";
import { MainTradingDashboard } from "@/components/trading/MainTradingDashboard";
import { ScalpingDashboard } from "@/components/trading/ScalpingDashboard";
import { StrategyComparison } from "@/components/trading/StrategyComparison";
import { SessionIndicator } from "@/components/trading/SessionIndicator";

export default function AITradingPage() {
  // Wake Lock: keep screen awake for 24/7 trading
  useEffect(() => {
    let wakeLock: WakeLockSentinel | null = null;
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await navigator.wakeLock.request('screen');
        }
      } catch { /* browser may not support */ }
    };
    requestWakeLock();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') requestWakeLock();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      wakeLock?.release();
    };
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Bot className="w-5 h-5 text-primary" />
          AI 자율 매매 대시보드
        </h2>
        <SessionIndicator />
      </div>

      {/* Strategy Comparison */}
      <StrategyComparison />

      <Tabs defaultValue="main">
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="main" className="flex items-center gap-1.5">
            <Bot className="w-4 h-4" />
            대형주 KPI
          </TabsTrigger>
          <TabsTrigger value="scalping" className="flex items-center gap-1.5">
            <Zap className="w-4 h-4" />
            소형주 KPI
          </TabsTrigger>
        </TabsList>
        <TabsContent value="main">
          <MainTradingDashboard />
        </TabsContent>
        <TabsContent value="scalping">
          <ScalpingDashboard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
