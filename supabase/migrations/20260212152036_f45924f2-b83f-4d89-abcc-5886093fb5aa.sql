
-- Create scalping wallet (independent from main AI wallet)
CREATE TABLE public.scalping_wallet (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  balance NUMERIC NOT NULL DEFAULT 1000000,
  initial_balance NUMERIC NOT NULL DEFAULT 1000000,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create scalping trades table
CREATE TABLE public.scalping_trades (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL DEFAULT 'buy',
  quantity NUMERIC NOT NULL,
  price NUMERIC NOT NULL,
  stop_loss NUMERIC,
  take_profit NUMERIC,
  status TEXT NOT NULL DEFAULT 'open',
  close_price NUMERIC,
  pnl NUMERIC,
  opened_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  closed_at TIMESTAMP WITH TIME ZONE,
  ai_reason TEXT,
  ai_confidence NUMERIC,
  entry_score NUMERIC,
  partial_exits JSONB DEFAULT '[]'::jsonb,
  time_limit_at TIMESTAMP WITH TIME ZONE
);

-- Disable RLS since this is a public demo (no auth)
ALTER TABLE public.scalping_wallet ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scalping_trades ENABLE ROW LEVEL SECURITY;

-- Allow all access (public demo, no auth)
CREATE POLICY "Allow all access to scalping_wallet" ON public.scalping_wallet FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to scalping_trades" ON public.scalping_trades FOR ALL USING (true) WITH CHECK (true);

-- Insert initial scalping wallet
INSERT INTO public.scalping_wallet (balance, initial_balance) VALUES (1000000, 1000000);
