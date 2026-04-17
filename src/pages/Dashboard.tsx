import { Card, CardContent } from "@/components/ui/card";
import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
export default function Dashboard() {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">대시보드 (무료 모드)</h2>

      {/* Desktop quick access to newly developed paper-trading simulator */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-foreground">신규 개발 기능: 가상머니 자동 복리매매 시뮬레이터</p>
            <p className="text-[11px] text-muted-foreground">무료 API 기반 · 시작자금 ₩1,000,000 · 일 목표 ₩300,000 · 전 과정 매매로그 기록</p>
          </div>
          <Link to="/ai-trading" className="text-xs font-semibold text-primary hover:underline flex items-center">
            지금 보기 <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 text-sm text-muted-foreground">
          무료 모드 정책이 적용되어, 대시보드의 실시간 외부 분석/에이전트 데이터 호출은 비활성화되었습니다.
        </CardContent>
      </Card>
    </div>
  );
}
