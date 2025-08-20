import { useQuery } from "@tanstack/react-query";
import { Address } from "viem";

// Chain ID to GeckoTerminal network slug mapping
const CHAIN_ID_TO_NETWORK_MAP: Record<number, string> = {
  1: "eth",
  56: "bsc",
  137: "polygon",
  42161: "arbitrum",
  10: "optimism",
  8453: "base",
  81457: "blast",
  2741: "abstract",
  98866: "plume-network",
};

async function getTokenPriceByChainAndContract(
  chainIdOrSlug: string,
  contractAddresses: string[],
): Promise<Record<string, { price_usd?: number; mc_usd?: number }>> {
  const baseUrl = "https://api.geckoterminal.com/api/v2";
  const baseHeaders: Record<string, string> = { accept: "application/json" };
  const normalized: Record<string, { price_usd?: number; mc_usd?: number }> = {};

  // GeckoTerminal requires individual requests per token
  const promises = contractAddresses.map(async (address) => {
    try {
      if (!address) throw new Error("Address is required");

      const response = await fetch(
        `${baseUrl}/simple/networks/${encodeURIComponent(chainIdOrSlug)}/token_price/${encodeURIComponent(address)}?include_market_cap=true&mcap_fdv_fallback=true`,
        { headers: baseHeaders },
      );

      console.log(response);

      if (!response.ok) {
        throw new Error(`GeckoTerminal error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const normalizedAddress = address.toLowerCase();
      const priceStr = data?.data?.attributes?.token_prices?.[normalizedAddress];
      const mcStr = data?.data?.attributes?.market_cap_usd?.[normalizedAddress];

      console.log(priceStr, mcStr);

      return {
        address: normalizedAddress,
        price_usd: priceStr ? parseFloat(priceStr) : undefined,
        mc_usd: mcStr ? parseFloat(mcStr) : undefined,
      };
    } catch (error) {
      console.warn(`Failed to fetch price for ${address} on ${chainIdOrSlug}:`, error);
      return {
        address: address.toLowerCase(),
        price_usd: undefined,
        mc_usd: undefined,
      };
    }
  });

  const results = await Promise.allSettled(promises);

  for (const result of results) {
    if (result.status === "fulfilled") {
      const { address, price_usd, mc_usd } = result.value;
      normalized[address] = { price_usd, mc_usd };
    }
  }

  return normalized;
}

/**
 * Hook to fetch token prices for given addresses on a specific chain
 * @param chainId - The chain ID to fetch prices from
 * @param addresses - Array of token contract addresses
 * @param options - Query options including refetch interval and enabled state
 */
export function useTokenPrices(
  chainId: number,
  addresses: Address[],
  options: {
    refetchInterval?: number;
    enabled?: boolean;
  } = {},
) {
  const { refetchInterval = 30000, enabled = true } = options;

  return useQuery({
    queryKey: ["token-prices", chainId, addresses.sort()],
    queryFn: async () => {
      if (!addresses.length) return {};

      const networkSlug = CHAIN_ID_TO_NETWORK_MAP[chainId];
      if (!networkSlug) {
        throw new Error(`Unsupported chain ID: ${chainId}`);
      }

      return getTokenPriceByChainAndContract(networkSlug, addresses);
    },
    enabled: enabled && addresses.length > 0,
    refetchInterval,
    staleTime: 0, // Consider data stale after 25 seconds
    gcTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}
