
CREATE OR REPLACE FUNCTION public.cleanup_old_scalping_trades()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.scalping_trades
  WHERE opened_at < now() - interval '2 days'
    AND status != 'open';
END;
$$;
