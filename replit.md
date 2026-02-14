# TRIBE - Meme Token Launchpad

## Overview
A Next.js 15 web application for launching and trading meme tokens on a bonding curve. Built with TypeScript, Tailwind CSS v4, and Radix UI components. Uses Supabase for backend data and ethers.js for blockchain interactions.

## Project Architecture
- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4 with `@tailwindcss/postcss`
- **UI Components**: Radix UI primitives, shadcn/ui pattern
- **State/Forms**: react-hook-form, zod validation
- **Blockchain**: ethers.js
- **Database**: Supabase (external, requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY)
- **Package Manager**: pnpm

## Directory Structure
- `app/` - Next.js App Router pages and API routes
- `components/` - React components (UI primitives in `components/ui/`)
- `hooks/` - Custom React hooks (wallet, contract)
- `lib/` - Utilities, configs, Supabase client, contract ABIs

## Development
- Dev server: `npx next dev -H 0.0.0.0 -p 5000`
- Build: `npm run build`
- Start: `npm run start`

## Environment Variables Needed
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key

## Recent Changes
- 2026-02-14: Initial Replit setup, configured Next.js `allowedDevOrigins` for Replit proxy
