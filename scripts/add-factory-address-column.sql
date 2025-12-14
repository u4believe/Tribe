-- Add factory_address column to meme_tokens table
ALTER TABLE meme_tokens 
ADD COLUMN IF NOT EXISTS factory_address TEXT;

-- Set default factory address for existing tokens (new contract)
UPDATE meme_tokens 
SET factory_address = '0xe6b08e2b1866C56B4C3182062dA94d06C6E8b9cf'
WHERE factory_address IS NULL;
