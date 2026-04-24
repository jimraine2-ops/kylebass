-- ============================================================
-- [후불 방지] DB 사이즈 폭증 차단 — 자동 정리 강화
-- ============================================================

-- 1) agent_logs 정리: 24h 초과 + 200건 초과 삭제
CREATE OR REPLACE FUNCTION public.cleanup_agent_logs()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  -- 24시간 초과된 로그 즉시 삭제
  DELETE FROM public.agent_logs WHERE created_at < now() - interval '24 hours';
  -- 그래도 200건 초과면 오래된 것부터 삭제
  DELETE FROM public.agent_logs WHERE id IN (
    SELECT id FROM public.agent_logs ORDER BY created_at DESC OFFSET 200
  );
  RETURN NEW;
END;
$$;

-- 트리거 (없으면 생성)
DROP TRIGGER IF EXISTS trg_cleanup_agent_logs ON public.agent_logs;
CREATE TRIGGER trg_cleanup_agent_logs
AFTER INSERT ON public.agent_logs
FOR EACH STATEMENT
EXECUTE FUNCTION public.cleanup_agent_logs();

-- 2) unified_trades 정리: 7일 초과 + 종료 상태만 삭제 (열린 포지션 보존)
CREATE OR REPLACE FUNCTION public.cleanup_old_unified_trades()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.unified_trades
  WHERE status != 'open'
    AND closed_at IS NOT NULL
    AND closed_at < now() - interval '7 days';
END;
$$;

-- 3) agent_status 단일 행 유지 (insert 시 오래된 것 삭제)
CREATE OR REPLACE FUNCTION public.cleanup_agent_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.agent_status WHERE id IN (
    SELECT id FROM public.agent_status ORDER BY last_heartbeat DESC OFFSET 5
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cleanup_agent_status ON public.agent_status;
CREATE TRIGGER trg_cleanup_agent_status
AFTER INSERT ON public.agent_status
FOR EACH STATEMENT
EXECUTE FUNCTION public.cleanup_agent_status();

-- 즉시 1회 정리 실행
DELETE FROM public.agent_logs WHERE created_at < now() - interval '24 hours';
DELETE FROM public.unified_trades WHERE status != 'open' AND closed_at IS NOT NULL AND closed_at < now() - interval '7 days';
DELETE FROM public.scalping_trades WHERE opened_at < now() - interval '2 days' AND status != 'open';