import { type Hex } from "viem";
import { eden } from "viem/chains";

export type SeededMarket = {
  chainId: number;
  id: Hex;
  loanToken: Hex;
  collateralToken: Hex;
  oracle: Hex;
  irm: Hex;
  lltv: bigint;
};

// Fallback list used while API indexing is catching up.
export const SEEDED_MARKETS: SeededMarket[] = [
  {
    chainId: eden.id,
    id: "0x00fbd65128dd4f75090659b3ebea7f54fdbd57374cc2ccf749a21a2a6d16eb97",
    loanToken: "0xF4e644772b17b6c57327F4D111a73D68C8cC731B",
    collateralToken: "0x00000000000000000000000000000000ce1E571a",
    oracle: "0x64c0b7ea807634e4279084ce89c3094e6df11cb5",
    irm: "0x08A7b3a39E5425d616Cc9c046cf96B5eF21a139f",
    lltv: 860000000000000000n,
  },
];

export function getSeededMarketIds(chainId: number | undefined): Hex[] {
  if (chainId === undefined) return [];
  return SEEDED_MARKETS.filter((market) => market.chainId === chainId).map((market) => market.id);
}
