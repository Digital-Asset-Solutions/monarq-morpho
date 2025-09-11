import { Address } from "viem";

// Eden testnet token list
export const edenTokenList = {
  name: "Eden Testnet Token List",
  logoURI: "https://via.placeholder.com/32x32/4ade80/ffffff?text=E",
  timestamp: new Date().toISOString(),
  keywords: ["eden", "testnet", "defi"],
  version: {
    major: 1,
    minor: 0,
    patch: 0,
  },
  tokens: [
    {
      name: "Ethereum",
      symbol: "ETH",
      decimals: 18,
      chainId: 3735928814,
      address: "0x0000000000000000000000000000000000000000" as Address,
      logoURI: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
    },
    {
      name: "Mock Asset",
      symbol: "MOCK",
      decimals: 18,
      chainId: 3735928814,
      address: "0x8fe895Fb093801B0a7c9399c95Ec8322110AF69c" as Address,
      logoURI: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
    },
    {
      name: "WETH Collateral",
      symbol: "WETH-COLL",
      decimals: 18,
      chainId: 3735928814,
      address: "0x6cE373b8ed0fF1c68B67d88E44076Aa2C480Fd2f" as Address,
      logoURI: "https://assets.coingecko.com/coins/images/2518/small/weth.png",
    },
    {
      name: "USDC Collateral",
      symbol: "USDC-COLL",
      decimals: 6,
      chainId: 3735928814,
      address: "0x05B95F576aC62005BC7bDaA3c1a25b720377973E" as Address,
      logoURI: "https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png",
    },
    {
      name: "EDEN WETH",
      symbol: "EDEN-WETH",
      decimals: 18,
      chainId: 3735928814,
      address: "0xbA207113AAFbd1805786a953177eCdE780e5BbAB" as Address,
      logoURI: "https://assets.coingecko.com/coins/images/2518/small/weth.png",
    },
    {
      name: "EDEN USDC",
      symbol: "EDEN-USDC",
      decimals: 6,
      chainId: 3735928814,
      address: "0xF8e5aD1507f6b7e1637b4d20c115b470D48C582E" as Address,
      logoURI: "https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png",
    },
  ],
};

export function getEdenTokenURI(token: { symbol?: string; address: Address; chainId?: number }) {
  if (token.chainId === 3735928814) {
    const match = edenTokenList.tokens.find(
      (t) => t.address.toLowerCase() === token.address.toLowerCase() && t.chainId === token.chainId,
    )?.logoURI;

    if (match) return match;
  }

  // Fallback to symbol-based URI
  return token.symbol ? `https://via.placeholder.com/32x32/6366f1/ffffff?text=${token.symbol.charAt(0)}` : undefined;
}
