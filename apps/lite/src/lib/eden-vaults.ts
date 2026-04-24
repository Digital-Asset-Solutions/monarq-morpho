import { type Address } from "viem";
import { eden } from "viem/chains";

export type SeededVault = {
  chainId: number;
  address: Address;
  owner: Address;
  name: string;
  asset: Address;
  supplyingMarkets: Address[];
  adapter?: Address;
  marketParams?: {
    loanToken: Address;
    collateralToken: Address;
    oracle: Address;
    irm: Address;
    lltv: bigint;
  };
};

// Fallback list used while API/indexing support for Eden vault types is catching up.
export const SEEDED_VAULTS: SeededVault[] = [
  {
    chainId: eden.id,
    address: "0xbed2f51590622b3aefc914b898ad3a9be9fd7b7c",
    owner: "0xFCB33B700eDED624EEDa067bB4E23FA9bc552823",
    name: "Eden eUSD Vault",
    asset: "0xF4e644772b17b6c57327F4D111a73D68C8cC731B",
    supplyingMarkets: ["0x00fbd65128dd4f75090659b3ebea7f54fdbd57374cc2ccf749a21a2a6d16eb97"],
    adapter: "0x21c2a745deb52ba8728E1218aD16F78EDB1B35BD",
    marketParams: {
      loanToken: "0xF4e644772b17b6c57327F4D111a73D68C8cC731B",
      collateralToken: "0x00000000000000000000000000000000ce1E571a",
      oracle: "0x64c0b7ea807634e4279084ce89c3094e6df11cb5",
      irm: "0x08A7b3a39E5425d616Cc9c046cf96B5eF21a139f",
      lltv: 860000000000000000n,
    },
  },
  {
    chainId: eden.id,
    address: "0x1CbaC7d53Ad2B2C510Bd064c4cA0383eEd06a1E9",
    owner: "0xFCB33B700eDED624EEDa067bB4E23FA9bc552823",
    name: "Eden WTIA Vault",
    asset: "0x00000000000000000000000000000000ce1E571a",
    supplyingMarkets: [],
  },
];

export function getSeededVaultAddresses(chainId: number | undefined): Address[] {
  if (chainId === undefined) return [];
  return SEEDED_VAULTS.filter((vault) => vault.chainId === chainId).map((vault) => vault.address);
}

export function getSeededVaultOwners(chainId: number | undefined): Address[] {
  if (chainId === undefined) return [];
  return SEEDED_VAULTS.filter((vault) => vault.chainId === chainId).map((vault) => vault.owner);
}

export function getSeededVaults(chainId: number | undefined): SeededVault[] {
  if (chainId === undefined) return [];
  return SEEDED_VAULTS.filter((vault) => vault.chainId === chainId);
}

export function getSeededVaultsForMarket(chainId: number | undefined, marketId: Address | undefined): SeededVault[] {
  if (chainId === undefined || marketId === undefined) return [];
  const marketIdLower = marketId.toLowerCase();
  return SEEDED_VAULTS.filter(
    (vault) =>
      vault.chainId === chainId && vault.supplyingMarkets.map((id) => id.toLowerCase()).includes(marketIdLower),
  );
}
