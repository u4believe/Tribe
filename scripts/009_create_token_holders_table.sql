-- Create table to track unique holders per token
CREATE TABLE IF NOT EXISTS public.token_holders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_address TEXT NOT NULL,
  holder_address TEXT NOT NULL,
  balance DECIMAL(20, 10) DEFAULT 0,
  first_buy_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_trade_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(token_address, holder_address)
);

-- Enable RLS
ALTER TABLE public.token_holders ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read access"
  ON public.token_holders FOR SELECT
  USING (true);

-- Allow anyone to insert/update
CREATE POLICY "Allow anyone to update holders"
  ON public.token_holders FOR ALL
  USING (true)
  WITH CHECK (true);

-- Indexes for fast lookups
CREATE INDEX idx_token_holders_token ON public.token_holders(token_address);
CREATE INDEX idx_token_holders_holder ON public.token_holders(holder_address);
