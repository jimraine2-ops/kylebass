import { BarChart3, TrendingUp, Newspaper, Building2, Bell, Search, Coins, Bot, Target, Brain } from "lucide-react";
import { useLocation, Link } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
} from "@/components/ui/sidebar";

const menuItems = [
  { title: "대시보드", url: "/", icon: BarChart3 },
  { title: "대형주 실시간 거래 현황", url: "/recommendations", icon: Target },
  { title: "소형주 실시간 거래 현황", url: "/penny-stocks", icon: Coins },
  { title: "AI 자율 매매", url: "/ai-trading", icon: Bot },
  { title: "학습 보고서", url: "/learning-report", icon: Brain },
  { title: "종목 분석", url: "/stock/AAPL", icon: TrendingUp },
  { title: "뉴스 & 감성", url: "/news", icon: Newspaper },
  { title: "섹터 & 시장", url: "/sectors", icon: Building2 },
  { title: "알림 설정", url: "/alerts", icon: Bell },
  { title: "종목 검색", url: "/search", icon: Search },
];

export function AppSidebar() {
  const location = useLocation();

  return (
    <Sidebar className="border-r border-sidebar-border">
      <SidebarHeader className="p-4">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-sidebar-primary-foreground tracking-tight">StockPulse AI</h1>
            <p className="text-[10px] text-sidebar-foreground">미국 주식 AI 분석</p>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/60 text-xs uppercase tracking-wider">메뉴</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const isActive = location.pathname === item.url || 
                  (item.url.startsWith('/stock') && location.pathname.startsWith('/stock'));
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link to={item.url} className="flex items-center gap-3">
                        <item.icon className="w-4 h-4" />
                        <span className="text-sm">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
