-- Enable realtime for ai_trades so the UI can subscribe to changes
ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_trades;