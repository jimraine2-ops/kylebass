import { Bot, ShieldAlert, DollarSign } from "lucide-react";
import { GitHubPaperCompoundDashboard } from "@/components/trading/GitHubPaperCompoundDashboard";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export default function AITradingPage() {
  const fxRate = 1350;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Bot className="w-5 h-5 text-primary" />
          가상머니 실전 트레이딩 센터 (무료 모드)
        </h2>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-[10px] px-2 py-0.5 gap-1 border-stock-up/30 text-stock-up">
            💱 고정 환율 ₩{fxRate.toLocaleString("ko-KR")}/USD
          </Badge>
          <Badge variant="outline" className="text-[10px] px-2 py-0.5 gap-1 border-primary/30 text-primary">
            Free API only
          </Badge>
        </div>
      </div>

      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-3 space-y-1.5 text-xs text-muted-foreground">
          <p className="font-semibold text-foreground flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5 text-primary" />
            실전형 가상머니 단타 모드 체크리스트
          </p>
          <p>1) <span className="text-foreground font-medium">원화 기준 기록</span>: 로그/매매기록 모두 KRW 기준으로 저장</p>
          <p>2) <span className="text-foreground font-medium">종목 필터</span>: 현재가 12,000원 미만 종목만 진입</p>
          <p>3) <span className="text-foreground font-medium">자동 복리</span>: 가용 현금 기반으로 비중 자동 계산</p>
          <p>4) <span className="text-foreground font-medium">목표 관리</span>: 일 실현손익 30만원 도달 시 자동 종료</p>
          <p className="flex items-center gap-1.5 text-warning">
            <ShieldAlert className="w-3.5 h-3.5" />
            현재 페이지는 무료 데이터 기반 시뮬레이터만 사용합니다.
          </p>
        </CardContent>
      </Card>

      <GitHubPaperCompoundDashboard fxRate={fxRate} />
    </div>
  );
}
