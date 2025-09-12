import { defineChain } from "viem";

export const eden = /*#__PURE__*/ defineChain({
  id: 3735928814,
  name: "Eden Testnet",
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: {
      http: ["https://eden-rpc-proxy.up.railway.app/rpc"],
    },
  },
  blockExplorers: {
    default: {
      name: "Eden Testnet Explorer",
      url: "https://explorer-edennet-1-testnet.binary.builders:8443/",
      apiUrl: "https://explorer-edennet-1-testnet.binary.builders:8443/api",
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
