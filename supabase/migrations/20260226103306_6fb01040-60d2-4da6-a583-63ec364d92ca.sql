
-- Drop all existing overly-permissive policies
DROP POLICY IF EXISTS "Allow all access on agent_logs" ON public.agent_logs;
DROP POLICY IF EXISTS "Allow all access on agent_status" ON public.agent_status;
DROP POLICY IF EXISTS "Allow all access on ai_trades" ON public.ai_trades;
DROP POLICY IF EXISTS "Allow all access on ai_wallet" ON public.ai_wallet;
DROP POLICY IF EXISTS "Allow all access on quant_trades" ON public.quant_trades;
DROP POLICY IF EXISTS "Allow all access on quant_wallet" ON public.quant_wallet;
DROP POLICY IF EXISTS "Allow all access to scalping_trades" ON public.scalping_trades;
DROP POLICY IF EXISTS "Allow all access to scalping_wallet" ON public.scalping_wallet;

-- Create SELECT-only policies (read-only from client, writes only via service_role)
CREATE POLICY "Public read-only access" ON public.agent_logs FOR SELECT USING (true);
CREATE POLICY "Public read-only access" ON public.agent_status FOR SELECT USING (true);
CREATE POLICY "Public read-only access" ON public.ai_trades FOR SELECT USING (true);
CREATE POLICY "Public read-only access" ON public.ai_wallet FOR SELECT USING (true);
CREATE POLICY "Public read-only access" ON public.quant_trades FOR SELECT USING (true);
CREATE POLICY "Public read-only access" ON public.quant_wallet FOR SELECT USING (true);
CREATE POLICY "Public read-only access" ON public.scalping_trades FOR SELECT USING (true);
CREATE POLICY "Public read-only access" ON public.scalping_wallet FOR SELECT USING (true);
