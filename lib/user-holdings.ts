import { getContract } from "./web3-provider"
import { formatEther, Contract } from "ethers"

// ERC20 ABI for reading balance
const ERC20_ABI = ["function balanceOf(address owner) public view returns (uint256)"]

export async function getUserTokenBalance(tokenAddress: string, userAddress: string): Promise<string> {
  try {
    if (!tokenAddress || !userAddress) return "0"

    const contract = await getContract()
    const signer = await contract.runner

    // Create an ERC20 token instance
    const tokenContract = new Contract(tokenAddress, ERC20_ABI, signer)

    // Get the user's balance
    const balance = await tokenContract.balanceOf(userAddress)

    return formatEther(balance)
  } catch (error) {
    console.error("[v0] Error fetching user token balance:", error)
    return "0"
  }
}
