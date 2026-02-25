
-- Agent activity logs for monitoring server-side trading
CREATE TABLE public.agent_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  strategy text NOT NULL DEFAULT 'unknown', -- 'quant', 'scalping', 'system'
  action text NOT NULL DEFAULT 'info', -- 'buy', 'sell', 'exit', 'scan', 'error', 'info'
  symbol text,
  message text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb
);

-- Agent status tracking (singleton row)
CREATE TABLE public.agent_status (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  is_running boolean NOT NULL DEFAULT true,
  last_heartbeat timestamp with time zone NOT NULL DEFAULT now(),
  last_cycle_at timestamp with time zone,
  total_cycles bigint NOT NULL DEFAULT 0,
  errors_count bigint NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.agent_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_status ENABLE ROW LEVEL SECURITY;

-- Public read access (no auth required for this app)
CREATE POLICY "Allow all access on agent_logs" ON public.agent_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access on agent_status" ON public.agent_status FOR ALL USING (true) WITH CHECK (true);

-- Index for fast log retrieval
CREATE INDEX idx_agent_logs_created_at ON public.agent_logs (created_at DESC);
CREATE INDEX idx_agent_logs_strategy ON public.agent_logs (strategy);

-- Insert initial agent status row
INSERT INTO public.agent_status (is_running, last_heartbeat) VALUES (true, now());

-- Auto-cleanup: keep only last 500 logs via trigger
CREATE OR REPLACE FUNCTION public.cleanup_agent_logs()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.agent_logs WHERE id IN (
    SELECT id FROM public.agent_logs ORDER BY created_at DESC OFFSET 500
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trigger_cleanup_agent_logs
AFTER INSERT ON public.agent_logs
FOR EACH STATEMENT
EXECUTE FUNCTION public.cleanup_agent_logs();
