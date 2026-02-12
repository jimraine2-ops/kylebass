
-- 10대 지표 퀀트 전용 지갑
CREATE TABLE public.quant_wallet (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  balance NUMERIC NOT NULL DEFAULT 50000,
  initial_balance NUMERIC NOT NULL DEFAULT 50000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.quant_wallet ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access on quant_wallet"
  ON public.quant_wallet FOR ALL
  USING (true) WITH CHECK (true);

-- 10대 지표 퀀트 전용 거래 기록
CREATE TABLE public.quant_trades (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL DEFAULT 'buy',
  status TEXT NOT NULL DEFAULT 'open',
  quantity NUMERIC NOT NULL,
  price NUMERIC NOT NULL,
  stop_loss NUMERIC,
  take_profit NUMERIC,
  trailing_stop NUMERIC,
  entry_score NUMERIC,
  ai_confidence NUMERIC,
  ai_reason TEXT,
  close_price NUMERIC,
  pnl NUMERIC DEFAULT 0,
  partial_exits JSONB DEFAULT '[]'::jsonb,
  peak_price NUMERIC,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ
);

ALTER TABLE public.quant_trades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access on quant_trades"
  ON public.quant_trades FOR ALL
  USING (true) WITH CHECK (true);
