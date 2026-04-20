import { Address } from "viem";
import { eden } from "viem/chains";

// Eden mainnet token list
export const edenTokenList = {
  name: "Eden Mainnet Token List",
  logoURI: "https://via.placeholder.com/32x32/4ade80/ffffff?text=E",
  timestamp: new Date().toISOString(),
  keywords: ["eden", "mainnet", "defi"],
  version: {
    major: 1,
    minor: 0,
    patch: 0,
  },
  tokens: [
    {
      name: "TIA",
      symbol: "TIA",
      decimals: 18,
      chainId: eden.id,
      address: "0x0000000000000000000000000000000000000000" as Address,
      logoURI: "https://assets.coingecko.com/coins/images/31967/standard/tia.jpg",
    },
    {
      name: "Wrapped TIA",
      symbol: "WTIA",
      decimals: 18,
      chainId: eden.id,
      address: "0x00000000000000000000000000000000ce1E571a" as Address,
      logoURI: "https://assets.coingecko.com/coins/images/31967/standard/tia.jpg",
    },
    {
      name: "Ether",
      symbol: "ETH",
      decimals: 18,
      chainId: eden.id,
      address: "0x23958cBa555AC52C9495Df9b121ff73003e39dBb" as Address,
      logoURI: "https://resources.cryptocompare.com/asset-management/2/1724756690647.png",
    },
    {
      name: "SOL",
      symbol: "SOL",
      decimals: 9,
      chainId: eden.id,
      address: "0x16eD50F96ea655Cb03638d7054e62e42Afb7b4fA" as Address,
      logoURI: "https://assets.coingecko.com/coins/images/4128/standard/solana.png",
    },
    {
      name: "eUSD",
      symbol: "eUSD",
      decimals: 18,
      chainId: eden.id,
      address: "0xF4e644772b17b6c57327F4D111a73D68C8cC731B" as Address,
      logoURI: "https://assets.coingecko.com/coins/images/6319/standard/usdc.png",
    },
    {
      name: "BTC",
      symbol: "BTC",
      decimals: 8,
      chainId: eden.id,
      address: "0xFA3198ecF05303a6d96E57a45E6c815055D255b1" as Address,
      logoURI: "https://assets.coingecko.com/coins/images/1/standard/bitcoin.png",
    },
  ],
};

export function getEdenTokenURI(token: { symbol?: string; address: Address; chainId?: number }) {
  if (token.chainId === eden.id) {
    const match = edenTokenList.tokens.find(
      (t) => t.address.toLowerCase() === token.address.toLowerCase() && t.chainId === token.chainId,
    )?.logoURI;

    if (match) return match;
  }

  // Fallback to symbol-based URI
  return token.symbol ? `https://via.placeholder.com/32x32/6366f1/ffffff?text=${token.symbol.charAt(0)}` : undefined;
}
