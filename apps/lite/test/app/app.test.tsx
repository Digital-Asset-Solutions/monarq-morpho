import { generatePrivateKey, privateKeyToAddress } from "viem/accounts";
import { describe, expect, test } from "vitest";
import { http, createConfig, mock } from "wagmi";
import { mainnet } from "wagmi/chains";

import { render, screen } from "../providers";

describe("app providers", () => {
  test("renders shared wagmi components without losing provider context", () => {
    const account = privateKeyToAddress(generatePrivateKey());
    const wagmiConfig = createConfig({
      chains: [mainnet],
      connectors: [mock({ accounts: [account] })],
      transports: {
        [mainnet.id]: http("https://eth.merkle.io"),
      },
    });

    expect(() => render(<div>App rendered</div>, { wagmiConfig })).not.toThrow();
    expect(screen.getByText("App rendered")).toBeInTheDocument();
  });
});
