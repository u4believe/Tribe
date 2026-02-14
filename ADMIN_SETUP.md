# Admin Access Control Setup

## Overview
The admin panel is now restricted to authorized wallet addresses only. Users who are not authorized will see an "Access Denied" message.

## Setup Instructions

### 1. Add Admin Wallet Address(es) to Environment Variables

Add your admin wallet address(es) to the project environment variables:

**Variable Name:** `NEXT_PUBLIC_ADMIN_ADDRESSES`

**Format:** Comma-separated list of wallet addresses (case-insensitive)

**Example:**
```
NEXT_PUBLIC_ADMIN_ADDRESSES=0x1234567890abcdef1234567890abcdef12345678,0xabcdefabcdefabcdefabcdefabcdefabcdefabcd
```

### 2. How to Add Environment Variables

**Option A: Via Vercel Dashboard**
1. Go to your project settings in Vercel
2. Navigate to "Environment Variables"
3. Add `NEXT_PUBLIC_ADMIN_ADDRESSES` with your wallet address(es)
4. Redeploy your application

**Option B: Via v0 Chat Sidebar**
1. Click on "Vars" in the left sidebar
2. Add the environment variable
3. The changes will be automatically applied

### 3. Getting Your Wallet Address

To find your wallet address:
1. Connect your wallet to the meme launchpad
2. Click the hamburger menu in the top right
3. Your wallet address will be displayed in the format: `0x1234...5678`
4. Copy the full address from your wallet extension (e.g., MetaMask)

## Features

- **Header Menu**: Admin link only appears for authorized users
- **Admin Page**: Shows access denied message for unauthorized users
- **Multiple Admins**: Supports multiple admin addresses (comma-separated)
- **Case Insensitive**: Address comparison is case-insensitive

## Security Notes

- The `NEXT_PUBLIC_` prefix makes this variable accessible on the client-side
- Admin addresses are checked in real-time when the wallet connects
- Direct URL access to `/admin` is blocked for non-admin users

## Testing

1. Add your wallet address to `NEXT_PUBLIC_ADMIN_ADDRESSES`
2. Connect your wallet
3. Check if the Admin option appears in the hamburger menu
4. Verify you can access the admin panel at `/admin`
5. Test with a different wallet address to confirm access is denied
