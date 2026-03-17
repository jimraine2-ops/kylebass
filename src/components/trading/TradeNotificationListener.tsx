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
          const confidence = trade.ai_confidence ?? 0;
          const aiReason = trade.ai_reason || '';
          const isSuperPattern = aiReason.includes('15%') || aiReason.includes('슈퍼');
          const is90Prob = confidence >= 90 || aiReason.includes('익절 확률');
          const targetPriceKRW = Math.round((trade.price || 0) * 1.15 * 1350);

          // ★ 필승 로직 이름 파싱
          let logicTag = '🚀 매수 완료';
          if (aiReason.includes('스나이퍼 매수')) logicTag = '🎯 스나이퍼 매수 — 수급불균형 돌파';
          else if (aiReason.includes('수급 돌파 매수')) logicTag = '🔫 수급 돌파 매수 — 세력미이탈 눌림목';
          else if (aiReason.includes('선제적 요격')) logicTag = '🎯 선제적 요격 — 매집선취매';
          else if (aiReason.includes('확정수익')) logicTag = '🏆 확정수익 매수';
          else if (isSuperPattern) logicTag = '🎯 슈퍼 패턴 매수! 15% 수익 타겟';
          else if (is90Prob) logicTag = `🏆 익절확률 ${confidence}% 필승 종목 매수`;

          const message = is90Prob
            ? `${name} | ₩${priceKRW.toLocaleString("ko-KR")} | 지표: ${score}점 | 🏆익절확률: ${confidence}% | 🎯목표: ₩${targetPriceKRW.toLocaleString("ko-KR")}`
            : isSuperPattern
            ? `${name} | ₩${priceKRW.toLocaleString("ko-KR")} | 지표: ${score}점 | 🎯15% 목표가: ₩${targetPriceKRW.toLocaleString("ko-KR")}`
            : `${name} | ₩${priceKRW.toLocaleString("ko-KR")} | 지표: ${score}점 | 신뢰도: ${confidence}%`;

          const title = logicTag;

          const duration = is90Prob ? 15000 : isSuperPattern ? 12000 : 8000;
          const borderColor = is90Prob ? '#f59e0b' : isSuperPattern ? 'hsl(var(--warning))' : 'hsl(var(--stock-up))';

          toast.success(title, {
            description: message,
            duration,
            style: {
              borderLeft: `4px solid ${borderColor}`,
              ...(is90Prob ? { background: 'linear-gradient(135deg, rgba(245,158,11,0.1), transparent)', boxShadow: '0 0 20px rgba(245,158,11,0.15)' } : {}),
            },
          });

          sendBrowserNotification(title, message);
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
