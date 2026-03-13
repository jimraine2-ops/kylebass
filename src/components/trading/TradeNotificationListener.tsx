import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatStockName } from "@/lib/koreanStockMap";

/**
 * 실시간 매매 알림 리스너
 * - unified_trades 테이블의 INSERT/UPDATE를 감지
 * - 매수/매도 체결 시 토스트 알림 + 브라우저 푸시 알림 송출
 */
export function TradeNotificationListener() {
  const permissionRef = useRef<NotificationPermission>("default");

  // 브라우저 알림 권한 요청
  useEffect(() => {
    if ("Notification" in window) {
      permissionRef.current = Notification.permission;
      if (Notification.permission === "default") {
        Notification.requestPermission().then((perm) => {
          permissionRef.current = perm;
        });
      }
    }
  }, []);

  // 브라우저 푸시 알림 전송
  const sendBrowserNotification = (title: string, body: string, icon?: string) => {
    if ("Notification" in window && permissionRef.current === "granted") {
      try {
        new Notification(title, { body, icon: icon || "/favicon.ico", badge: "/favicon.ico" });
      } catch {
        // 모바일 등에서 Notification 생성자 미지원 시 무시
      }
    }
  };

  useEffect(() => {
    // 매수 체결 감지 (INSERT with status='open')
    const channel = supabase
      .channel("trade-notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "unified_trades" },
        (payload) => {
          const trade = payload.new as any;
          if (!trade) return;

          const name = formatStockName(trade.symbol);
          const priceKRW = Math.round((trade.price || 0) * 1350);
          const score = trade.entry_score ?? "N/A";
          const confidence = trade.ai_confidence ?? "N/A";

          const message = `${name} | ₩${priceKRW.toLocaleString("ko-KR")} | 지표: ${score}점 | 신뢰도: ${confidence}%`;

          toast.success(`🚀 매수 완료`, {
            description: message,
            duration: 8000,
            style: {
              borderLeft: "4px solid hsl(var(--stock-up))",
            },
          });

          sendBrowserNotification(
            "🚀 매수 완료",
            `${name} | ₩${priceKRW.toLocaleString("ko-KR")} | 지표 ${score}점`
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "unified_trades",
          filter: "status=eq.closed",
        },
        (payload) => {
          const trade = payload.new as any;
          if (!trade || trade.status !== "closed") return;

          const name = formatStockName(trade.symbol);
          const pnl = trade.pnl ?? 0;
          const closePriceKRW = Math.round((trade.close_price || 0) * 1350);
          const entryPriceKRW = Math.round((trade.price || 0) * 1350);
          const pnlPct = trade.price > 0
            ? (((trade.close_price || trade.price) - trade.price) / trade.price * 100).toFixed(2)
            : "0.00";
          const isProfit = pnl >= 0;

          const message = `${name} | ₩${closePriceKRW.toLocaleString("ko-KR")} | 수익률: ${isProfit ? "+" : ""}${pnlPct}%`;

          if (isProfit) {
            toast.success(`💰 익절 완료`, {
              description: message,
              duration: 8000,
              style: {
                borderLeft: "4px solid hsl(var(--stock-up))",
              },
            });
          } else {
            toast.error(`📉 손절 완료`, {
              description: message,
              duration: 8000,
              style: {
                borderLeft: "4px solid hsl(var(--stock-down))",
              },
            });
          }

          sendBrowserNotification(
            isProfit ? "💰 익절 완료" : "📉 손절 완료",
            message
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // 렌더링 없이 이벤트 리스너 역할만 수행
  return null;
}
