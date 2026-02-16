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

## Key Configuration
- **Contract Address**: `0xcDa22FcC22be684712CFBBcaFf365dBDF2FDD080` (Intuition Mainnet)
- **Admin Wallet**: `0xD4F79436a2a69C70127570749dc39Ae5D5C0c646`
- **Contract ABI**: `lib/contract-abi.json` (updated 2026-02-16 with sell spread and recovery functions)

## Recent Changes
- 2026-02-16: Updated contract ABI and address to new deployment (0xcDa22...FDD080), added optional sell spread percent to token creation, added recoverSellSpreadLiquidity to admin panel, separated all admin form inputs into independent state variables
- 2026-02-15: Added admin panel contract management functions (collectAndSplitTransferFees, completeTokenLaunch, setDefaultPostMigrationTransferFeePercent, transferOwnership, setFeePercent, setCreatorTransferFee)
- 2026-02-14: Initial Replit setup, configured Next.js `allowedDevOrigins` for Replit proxy
