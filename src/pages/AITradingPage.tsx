import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bot, Zap } from "lucide-react";
import { MainTradingDashboard } from "@/components/trading/MainTradingDashboard";
import { ScalpingDashboard } from "@/components/trading/ScalpingDashboard";

export default function AITradingPage() {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <Bot className="w-5 h-5 text-primary" />
        AI 자율 매매 대시보드
      </h2>

      <Tabs defaultValue="main">
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="main" className="flex items-center gap-1.5">
            <Bot className="w-4 h-4" />
            Main Trading
          </TabsTrigger>
          <TabsTrigger value="scalping" className="flex items-center gap-1.5">
            <Zap className="w-4 h-4" />
            Under $10 Scalping
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
