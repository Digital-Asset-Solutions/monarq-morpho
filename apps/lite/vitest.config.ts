import { defineConfig, mergeConfig } from "vitest/config";

import viteConfig from "./vite.config";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      include: ["./test/**/*.{test,spec}.?(c|m)[jt]s?(x)"],
      environment: "jsdom",
      setupFiles: ["./test/setup.ts"],
      globalSetup: ["./test/global-setup.ts"],
    },
  }),
);
