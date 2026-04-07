import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Badge } from "@/components/ui/badge";

export function TopBar() {
  return (
    <header className="h-14 border-b border-border flex items-center gap-4 px-4 bg-card/50 backdrop-blur-sm">
      <SidebarTrigger />
      <div className="flex-1">
        <p className="text-sm font-semibold">무료 모드 대시보드</p>
        <p className="text-[11px] text-muted-foreground">유료 API 호출 없이 가상머니 자동매매만 동작합니다.</p>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-[10px] border-stock-up/30 text-stock-up">
          Free API only
        </Badge>
        <span className="text-xs text-muted-foreground font-mono">{new Date().toLocaleDateString("ko-KR")}</span>
        <ThemeToggle />
      </div>
    </header>
  );
}
