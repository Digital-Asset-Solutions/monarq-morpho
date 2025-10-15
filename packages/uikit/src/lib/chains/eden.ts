import { defineChain } from "viem";

export const eden = /*#__PURE__*/ defineChain({
  id: 3735928814,
  name: "Eden Testnet",
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: {
      http: ["https://eden-rpc-proxy-production.up.railway.app/rpc"],
    },
  },
  blockExplorers: {
    default: {
      name: "Eden Testnet Explorer",
      url: "https://explorer-eden-testnet.binarybuilders.services/",
      apiUrl: "https://explorer-eden-testnet.binarybuilders.services/api",
    },
  },
  contracts: {
    multicall3: {
      address: "0xCB7D6ac7F5E59b7EcbfF221858BA9A59ca66CC5b",
      blockCreated: 538237,
    },
  },
  testnet: true,
});
