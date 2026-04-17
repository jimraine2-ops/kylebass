import { Card, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";

export default function StockDetail() {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">무료 모드 안내</h2>
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-4 text-sm text-muted-foreground space-y-2">
          <p className="font-medium text-foreground">현재 저장소는 무료 API 전용 모드로 동작합니다.</p>
          <p>유료/과금 가능성이 있는 종목 상세 실시간 호출은 비활성화되었습니다.</p>
          <p>
            가상머니 자동매매는{" "}
            <Link to="/ai-trading" className="text-primary underline underline-offset-2">
              AI 트레이딩(무료 모드)
            </Link>
            에서 이용해주세요.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
