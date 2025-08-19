declare module "*.s.sol" {
  export const Lens: {
    bytecode: `0x${string}`;
    deployedBytecode: `0x${string}`;
    read: {
      withdrawQueue: (metaMorpho: `0x${string}`) => {
        abi: unknown[];
        args: readonly [`0x${string}`];
        functionName: "withdrawQueue";
        humanReadableAbi: string[];
      };
      getAccrualVaults: (
        morpho: `0x${string}`,
        metaMorphos: readonly `0x${string}`[],
        includedOwners: readonly `0x${string}`[],
      ) => {
        abi: unknown[];
        args: readonly [`0x${string}`, readonly `0x${string}`[], readonly `0x${string}`[]];
        functionName: "getAccrualVaults";
        humanReadableAbi: string[];
      };
    };
  };
}
