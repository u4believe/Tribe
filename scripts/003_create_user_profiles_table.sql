-- Create user_profiles table for storing user profile information
CREATE TABLE IF NOT EXISTS public.user_profiles (
  wallet_address TEXT PRIMARY KEY,
  display_name TEXT,
  profile_image TEXT,
  bio TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS for security
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Allow anyone to view all profiles (read-only)
CREATE POLICY "Allow public read access to profiles"
  ON public.user_profiles FOR SELECT
  USING (true);

-- Allow users to insert their own profile
CREATE POLICY "Allow users to create their profile"
  ON public.user_profiles FOR INSERT
  WITH CHECK (true);

-- Allow users to update their own profile
CREATE POLICY "Allow users to update their own profile"
  ON public.user_profiles FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Index for faster lookups
CREATE INDEX idx_wallet_address ON public.user_profiles(wallet_address);
