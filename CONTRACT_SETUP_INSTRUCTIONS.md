# How to Integrate Your New Contract

Follow these steps to connect your new meme launchpad contract:

## Step 1: Clear Existing Token Data

Run the SQL script to remove all existing tokens from the database:

1. Go to your Supabase dashboard
2. Navigate to the SQL Editor
3. Run the script: `scripts/012_clear_all_tokens.sql`

This will delete all:
- Meme tokens
- Starred tokens
- Token holders
- User points

**Note:** User profiles are preserved by default. If you want to clear those too, uncomment the last line in the script.

## Step 2: Update Contract Address

In `lib/contract-config.ts`:

```typescript
export const CONTRACT_CONFIG = {
  address: "0xYourNewContractAddressHere",  // Replace this
  chainId: 1155,  // Update if different network
  network: {
    name: "Intuition Mainnet",
    rpcUrl: "https://rpc.intuition.systems",
    currency: "TRUST",
    blockExplorer: "https://intuition.calderaexplorer.xyz/",
  },
}
```

## Step 3: Replace Contract ABI

In `lib/contract-abi.json`:

1. Copy your contract's complete ABI from:
   - Your contract verification on the block explorer, OR
   - Your contract's build artifacts (usually in `artifacts/` or `out/` folder)

2. Replace the entire contents of `lib/contract-abi.json` with your new ABI

**Required Functions:** Your contract should have at minimum:
- `createToken(name, symbol, metadata)` - To create new meme tokens
- `buyTokens(tokenAddress, minTokensOut)` - To buy tokens (payable)
- `sellTokens(tokenAddress, tokenAmount)` - To sell tokens
- `getTokenInfo(tokenAddress)` - To fetch token details
- `getAllTokens()` - To list all tokens
- `getCurrentPrice(tokenAddress)` - To get current token price

## Step 4: Verify Integration

After updating the contract address and ABI:

1. Test token creation
2. Test buying tokens
3. Test selling tokens
4. Verify prices display correctly
5. Check that token filtering works

## Troubleshooting

If you encounter errors:

1. **"Invalid address" errors**: Double-check your contract address format (should start with 0x)
2. **"Function not found" errors**: Verify your ABI has all required functions
3. **Gas estimation failures**: Ensure your contract is deployed and verified on the network
4. **Network errors**: Check that the RPC URL and chain ID match your deployment network

## Need Help?

Make sure your new contract follows the same interface as the original:
- Uses the bonding curve formula for pricing
- Tracks user volumes for the points system
- Emits events for token creation, buying, and selling
