import { erc20Abi, Address, zeroAddress } from "viem";
import { useReadContract, useChains } from "wagmi";

import { getTokenURI } from "@/lib/tokens";

export interface Token {
  address: Address;
  symbol?: string;
  decimals?: number;
  imageSrc?: string;
}

/**
 * Hook to fetch token data (symbol, decimals, image) for a given token address
 * @param tokenAddress - The address of the token
 * @param chainId - The chain ID
 * @returns Token object with symbol, decimals, and imageSrc
 */
export function useToken(tokenAddress: Address | undefined, chainId: number): Token | undefined {
  const chains = useChains();

  // Check if this is a native token (zero address)
  const isNativeToken = tokenAddress === zeroAddress;
  const { data: symbol } = useReadContract({
    chainId,
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "symbol",
    query: {
      enabled: !!tokenAddress && !isNativeToken,
    },
  });

  const { data: decimals } = useReadContract({
    chainId,
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "decimals",
    query: {
      enabled: !!tokenAddress && !isNativeToken,
    },
  });

  if (!tokenAddress) return undefined;

  // Handle native token
  if (isNativeToken) {
    const chain = chains.find((c) => c.id === chainId);
    const nativeSymbol = chain?.nativeCurrency?.symbol || "ETH";
    const nativeDecimals = chain?.nativeCurrency?.decimals || 18;

    return {
      address: tokenAddress,
      symbol: nativeSymbol,
      decimals: nativeDecimals,
      imageSrc: getTokenURI({
        symbol: nativeSymbol,
        address: tokenAddress,
        chainId,
      }),
    };
  }

  return {
    address: tokenAddress,
    symbol: symbol as string | undefined,
    decimals: decimals as number | undefined,
    imageSrc: getTokenURI({
      symbol: symbol as string | undefined,
      address: tokenAddress,
      chainId,
    }),
  };
}
