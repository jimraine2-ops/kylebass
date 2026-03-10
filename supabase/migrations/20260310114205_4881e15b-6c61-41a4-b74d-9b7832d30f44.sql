
-- Create unified wallet with ₩400,000,000
CREATE TABLE public.unified_wallet (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  balance numeric NOT NULL DEFAULT 400000000,
  initial_balance numeric NOT NULL DEFAULT 400000000,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.unified_wallet ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read-only access" ON public.unified_wallet FOR SELECT TO public USING (true);

INSERT INTO public.unified_wallet (balance, initial_balance) VALUES (400000000, 400000000);

-- Create unified trades table with all needed columns
CREATE TABLE public.unified_trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol text NOT NULL,
  side text NOT NULL DEFAULT 'buy',
  quantity numeric NOT NULL,
  price numeric NOT NULL,
  stop_loss numeric,
  take_profit numeric,
  trailing_stop numeric,
  close_price numeric,
  pnl numeric DEFAULT 0,
  ai_confidence numeric,
  ai_reason text,
  entry_score numeric,
  peak_price numeric,
  partial_exits jsonb DEFAULT '[]'::jsonb,
  cap_type text NOT NULL DEFAULT 'large',
  status text NOT NULL DEFAULT 'open',
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);

ALTER TABLE public.unified_trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read-only access" ON public.unified_trades FOR SELECT TO public USING (true);

-- Enable realtime for unified_trades
ALTER PUBLICATION supabase_realtime ADD TABLE public.unified_trades;
