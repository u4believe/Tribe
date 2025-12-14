export const CONTRACT_CONFIG = {
  address: "0xD9E849B6d44946B0D0FAEafe34b92C79c68cCbeF",
  chainId: 1155,
  chainName: "Intuition Mainnet",
  rpcUrl: "https://intuition.calderachain.xyz/http",
  network: {
    name: "Intuition Mainnet",
    rpcUrl: "https://intuition.calderachain.xyz/http",
    currency: "TRUST",
    blockExplorer: "https://intuition.calderaexplorer.xyz/",
  },
} as const

export const CONTRACT_ADDRESS = CONTRACT_CONFIG.address
export const RPC_URL = CONTRACT_CONFIG.rpcUrl
