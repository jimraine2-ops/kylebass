CREATE OR REPLACE FUNCTION public.cleanup_old_scalping_trades()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Keep closed trades for 30 days instead of 2 days to preserve trade history
  DELETE FROM public.scalping_trades
  WHERE opened_at < now() - interval '30 days'
    AND status != 'open';
END;
$function$;