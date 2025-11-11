-- Add foreign key relationship between meme_tokens and user_profiles
-- This allows us to join and fetch creator profile information

ALTER TABLE public.meme_tokens 
  ADD CONSTRAINT meme_tokens_creator_fkey 
  FOREIGN KEY (creator) 
  REFERENCES public.user_profiles(wallet_address)
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- Create index for better join performance
CREATE INDEX IF NOT EXISTS idx_meme_tokens_creator ON public.meme_tokens(creator);
