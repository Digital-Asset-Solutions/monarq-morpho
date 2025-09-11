import * as customChains from "@morpho-org/uikit/lib/chains";
import { type Deployments } from "@morpho-org/uikit/lib/deployments";
import { ReactNode } from "react";
import { lisk } from "wagmi/chains";
// LITE APP: Other chains not needed - commented for rollback
// import { lisk, optimism, plumeMainnet, polygon, worldchain } from "wagmi/chains"; // Original imports

export const APP_DETAILS = {
  // NOTE: Should always match the title in `index.html` (won't break anything, but should be correct)
  name: import.meta.env.VITE_APP_TITLE,
  description: "A minimal and open-source version of the main Morpho App",
  url: "https://lite.morpho.org",
  icon: "/favicon.svg",
};

export const WORDMARK = "/lazarus.svg"; // Replace with "/your-wordmark.svg" to customize interface

export const MIN_TIMELOCK = 3 * 24 * 60 * 60; // For filtering vaults

// Vault blacklist by chain ID
export const VAULT_BLACKLIST: Record<number, string[]> = {
  [customChains.eden.id]: [
    "0x561EFa796848DEced491D481dCb25893b18eC359",
    "0x492be44812e0403BC06BC5974222A72b18251D6b",
    "0x1d7168e59f1A51592812eCb823A2ecE4779AEaEf",
  ],
};

// Market blacklist by chain ID
export const MARKET_BLACKLIST: Record<number, string[]> = {
  [customChains.eden.id]: [
    "0x0dadc55748cfe3a0cefe981c3baca858ca49d06c63777e3c6c61884deefa76dc",
    "0x84a867b4120e2c0b3c91f382673eb4d86156984ef2d0cde62278dcd251b77dfe",
  ],
};

// Debug: Log the Eden chain ID
console.log(`[Constants] Eden chain ID: ${customChains.eden.id}`);

// LITE APP: Dedicated to Lisk and Eden chains
export const DEFAULT_CHAIN = lisk;
// export const DEFAULT_CHAIN = plumeMainnet; // Original default chain - commented for rollback

export const TRANSACTION_DATA_SUFFIX = "0x117E"; // (L I T E)

export const TERMS_OF_USE = "https://cdn.morpho.org/documents/Morpho_Terms_of_Use.pdf";
export const RISKS_DOCUMENTATION = "https://docs.morpho.org/overview/resources/risks/";
export const ADDRESSES_DOCUMENTATION = "https://docs.morpho.org/overview/resources/addresses/";
export const SHARED_LIQUIDITY_DOCUMENTATION = "https://docs.morpho.org/overview/concepts/public-allocator/";

// LITE APP: Simplified banners - Lisk and Eden supported
export const BANNERS: Record<keyof Deployments, { color: string; text: ReactNode }> = {
  [lisk.id]: {
    color: "bg-gradient-to-r from-blue-600 to-purple-600",
    text: (
      <span className="grow py-2 text-center text-white">Welcome to Morpho Lite - Dedicated to Lisk Ecosystem 🚀</span>
    ),
  },
  [customChains.eden.id]: {
    color: "bg-gradient-to-r from-green-600 to-emerald-600",
    text: (
      <span className="grow py-2 text-center text-white">Welcome to Morpho Lite - Eden Testnet Integration 🌱</span>
    ),
  },
};

/* ORIGINAL BANNERS CONFIG - commented for rollback
export const BANNERS: Record<keyof Deployments, { color: string; text: ReactNode }> = {
  [plumeMainnet.id]: {
    color: "bg-[rgb(255,61,0)]",
    text: (
      <span className="grow py-2 text-center">
        Access additional features and explore incentives via the interfaces offered by{" "}
        <a className="underline" href="https://app.mysticfinance.xyz" rel="noopener noreferrer" target="_blank">
          Mystic
        </a>
        {" and "}
        <a className="underline" href="https://morpho.solera.market/" rel="noopener noreferrer" target="_blank">
          Solera
        </a>
        .
      </span>
    ),
  },
  [polygon.id]: {
    color: "bg-purple-500",
    text: (
      <span className="grow py-2 text-center">
        Claim rewards and access enhanced features on the external{" "}
        <a className="underline" href="https://compound.blue" rel="noopener noreferrer" target="_blank">
          Compound Blue
        </a>{" "}
        interface.
      </span>
    ),
  },
  [optimism.id]: {
    color: "bg-red-500",
    text: (
      <span className="grow py-2 text-center">
        The most popular OP Mainnet markets are also accessible on{" "}
        <a className="underline" href="https://moonwell.fi" rel="noopener noreferrer" target="_blank">
          Moonwell
        </a>
        .
      </span>
    ),
  },
  [worldchain.id]: {
    color: "bg-black",
    text: (
      <span className="grow py-2 text-center">
        Claim rewards and access enhanced features on the external{" "}
        <a
          className="underline"
          href="https://oku.trade/morpho/vaults?inputChain=worldchain"
          rel="noopener noreferrer"
          target="_blank"
        >
          Oku Trade
        </a>{" "}
        interface.
      </span>
    ),
  },
};
*/
