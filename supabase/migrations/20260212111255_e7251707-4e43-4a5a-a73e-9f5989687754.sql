
-- Virtual wallet for AI trading
CREATE TABLE public.ai_wallet (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  balance NUMERIC NOT NULL DEFAULT 10000,
  initial_balance NUMERIC NOT NULL DEFAULT 10000,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- AI trade history
CREATE TABLE public.ai_trades (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
  quantity NUMERIC NOT NULL,
  price NUMERIC NOT NULL,
  stop_loss NUMERIC,
  take_profit NUMERIC,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'stopped', 'profit_taken')),
  pnl NUMERIC DEFAULT 0,
  close_price NUMERIC,
  ai_reason TEXT,
  ai_confidence NUMERIC,
  opened_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  closed_at TIMESTAMP WITH TIME ZONE
);

-- Insert initial wallet
INSERT INTO public.ai_wallet (balance, initial_balance) VALUES (10000, 10000);

-- Disable RLS (personal tool, no auth)
ALTER TABLE public.ai_wallet ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_trades ENABLE ROW LEVEL SECURITY;

-- Allow all access (no auth needed for personal use)
CREATE POLICY "Allow all access on ai_wallet" ON public.ai_wallet FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access on ai_trades" ON public.ai_trades FOR ALL USING (true) WITH CHECK (true);
