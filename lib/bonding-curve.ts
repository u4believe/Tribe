// Bonding curve calculation constants matching the smart contract
export const BONDING_CURVE_CONFIG = {
  INITIAL_PRICE: 0.0001533, // Initial price in TRUST per token
  MAX_SUPPLY: 1000000000, // 1 billion tokens total
  BONDING_CURVE_PERCENT: 70, // 70% of max supply (700M tokens)
  PRICE_STEP_SIZE: 100000000, // 100M tokens - step size for quadratic calculation
  CREATOR_MAX_BUY_PERCENT: 20, // Creator can buy max 20% of bonding curve (140M tokens)
  FEE_PERCENT: 1, // 1% fee on trades
}

/**
 * Calculate price based on current supply using quadratic bonding curve
 * Matches the smart contract formula: price = INITIAL_PRICE * (1 + (currentSupply / PRICE_STEP_SIZE)^2)
 * This is the pump.fun style pricing model
 */
export function calculateBondingCurvePrice(currentSupply: number): number {
  const { INITIAL_PRICE, PRICE_STEP_SIZE, MAX_SUPPLY, BONDING_CURVE_PERCENT } = BONDING_CURVE_CONFIG

  // Calculate bonding curve maximum (70% of total supply)
  const bondingMax = (MAX_SUPPLY * BONDING_CURVE_PERCENT) / 100

  // Ensure currentSupply doesn't exceed bonding curve limit
  const effectiveSupply = Math.min(currentSupply, bondingMax)

  if (effectiveSupply === 0) {
    return INITIAL_PRICE
  }

  // Quadratic bonding curve formula from the smart contract
  // supplyRatio = currentSupply / PRICE_STEP_SIZE
  const supplyRatio = effectiveSupply / PRICE_STEP_SIZE

  // price = INITIAL_PRICE * (1 + supplyRatio^2)
  const price = INITIAL_PRICE * (1 + supplyRatio * supplyRatio)

  return price
}

/**
 * Calculate the percentage of bonding curve allocation that has been filled
 * Returns 0-100 representing how much of the 700M bonding curve tokens have been bought
 */
export function calculateBondingCurveProgress(currentSupply: number): number {
  const { MAX_SUPPLY, BONDING_CURVE_PERCENT } = BONDING_CURVE_CONFIG
  const bondingCurveLimit = (MAX_SUPPLY * BONDING_CURVE_PERCENT) / 100 // 700M tokens

  // Return percentage of bonding curve filled (0-100)
  return Math.min((currentSupply / bondingCurveLimit) * 100, 100)
}

/**
 * Calculate how many tokens can be bought with a given amount of TRUST
 * Uses the current price from the bonding curve
 */
export function calculateTokensFromTrust(trustAmount: number, currentSupply: number): number {
  const currentPrice = calculateBondingCurvePrice(currentSupply)
  return trustAmount / currentPrice
}

/**
 * Calculate how much TRUST is needed to buy a given amount of tokens
 * Uses the current price from the bonding curve
 */
export function calculateTrustFromTokens(tokenAmount: number, currentSupply: number): number {
  const currentPrice = calculateBondingCurvePrice(currentSupply)
  return tokenAmount * currentPrice
}

/**
 * Calculate how much TRUST will be received when selling tokens
 * Includes the 1% fee deduction
 */
export function calculateTrustFromSell(tokenAmount: number, currentSupply: number): number {
  const currentPrice = calculateBondingCurvePrice(currentSupply)
  const grossTrust = tokenAmount * currentPrice
  const fee = (grossTrust * BONDING_CURVE_CONFIG.FEE_PERCENT) / 100
  return grossTrust - fee
}
