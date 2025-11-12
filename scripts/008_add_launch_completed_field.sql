-- Add is_completed field to track when completeTokenLaunch is called
ALTER TABLE meme_tokens
ADD COLUMN IF NOT EXISTS is_completed BOOLEAN DEFAULT false;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_meme_tokens_is_completed ON meme_tokens(is_completed);
