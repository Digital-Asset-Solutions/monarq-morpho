import { useMemo } from "react";
import { erc20Abi, Address, zeroAddress } from "viem";
import { useReadContracts, useChains } from "wagmi";

import { getTokenURI } from "@/lib/tokens";

export interface Token {
  address: Address;
  symbol?: string;
  decimals?: number;
  imageSrc?: string;
}

/**
 * Hook to fetch token data (symbol, decimals, image) for multiple token addresses
 * @param tokenAddresses - Array of token addresses
 * @param chainId - The chain ID
 * @returns Map of token address to Token object
 */
export function useTokens(tokenAddresses: Address[], chainId: number): Map<Address, Token> {
  const chains = useChains();

  // Separate ERC20 tokens from native tokens (zero address)
  const erc20Addresses = useMemo(() => tokenAddresses.filter((addr) => addr !== zeroAddress), [tokenAddresses]);

  const { data: tokenData } = useReadContracts({
    contracts: erc20Addresses
      .map((address) => [
        { chainId, address, abi: erc20Abi, functionName: "symbol" } as const,
        { chainId, address, abi: erc20Abi, functionName: "decimals" } as const,
      ])
      .flat(),
    allowFailure: true,
    query: {
      staleTime: Infinity,
      gcTime: Infinity,
      enabled: erc20Addresses.length > 0,
    },
  });

  return useMemo(() => {
    const tokens = new Map<Address, Token>();
    const chain = chains.find((c) => c.id === chainId);

    tokenAddresses.forEach((tokenAddress) => {
      // Handle native token (zero address)
      if (tokenAddress === zeroAddress) {
        const nativeSymbol = chain?.nativeCurrency?.symbol || "ETH";
        const nativeDecimals = chain?.nativeCurrency?.decimals || 18;

        tokens.set(tokenAddress, {
          address: tokenAddress,
          symbol: nativeSymbol,
          decimals: nativeDecimals,
          imageSrc: getTokenURI({ symbol: nativeSymbol, address: tokenAddress, chainId }),
        });
        return;
      }

      // Handle ERC20 tokens
      const erc20Index = erc20Addresses.indexOf(tokenAddress);
      if (erc20Index >= 0) {
        const symbol = tokenData?.[erc20Index * 2 + 0]?.result as string | undefined;
        const decimals = tokenData?.[erc20Index * 2 + 1]?.result as number | undefined;
        tokens.set(tokenAddress, {
          address: tokenAddress,
          symbol,
          decimals,
          imageSrc: getTokenURI({ symbol, address: tokenAddress, chainId }),
        });
      }
    });

    return tokens;
  }, [tokenAddresses, erc20Addresses, tokenData, chainId, chains]);
}
