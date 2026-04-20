"Morpho": "0xF050a2BB0468FF23cF2964AC182196C94D6815C3",
"AdaptiveCurveIrm": "0x08A7b3a39E5425d616Cc9c046cf96B5eF21a139f",
"Bundler3": "0x4D403d6a3D25A865Ed57caef884f076E0fa00eCa",
"GeneralAdapter1": "0x9B05CCA3299E3558a324f72aaB4D404625557B3D",
"MorphoChainlinkOracleV2Factory": "0xD6202eFF2e869dc473EB13c38Cc787835Bf8B6df",
"VaultV2Factory": "0x9aaCAA01F5e6BC876D07f023744E3E0A456a64cf",
"MorphoMarketV1AdapterV2Factory": "0x59e8C53D383F22b6371b5833504dfAa4136aE6f7",
"MorphoMarketV1RegistryV2": "0xa91610087A3aD4561aE1b6a4c2cEA6643BA8E434",
"RegistryList": "0xB78BA19a8Bf3202DA7036ec1830222FDC5e0297e",

# Chain Info

| Name            | Value      |
| --------------- | ---------- |
| ChainID         | 714        |
| Block Time      | 100ms      |
| Block Gas Limit | 50,000,000 |

# RPC, Block Explorer, & other Important URLS

| Thing              | URL                                                                                                                            |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Public RPC (https) | https://rpc.eden.gateway.fm/                                                                                                   |
| Public RPC (wss)   | wss://rpc.eden.gateway.fm/ws                                                                                                   |
| Block Explorer     | https://eden.blockscout.com/                                                                                                   |
| Safe Wallet        | https://edensafe.celestia.org/                                                                                                 |
| Bridge UI (tmp)    | https://hyperlane-warp-template-git-feat-celestia-w-75851f-abacus-works.vercel.app/?destination=eden&origin=celestia&token=TIA |

<aside>
💡

Public RPCs have a rate limit of 30 request/section per IP address. Higher limits can be obtained by registering on [admin.gateway.fm](http://admin.gateway.fm/)

</aside>

# Contracts of Interest

| Name                                                                                                  | Address                                      |
| ----------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| WTIA                                                                                                  | `0x00000000000000000000000000000000Ce1e571A` |
| HypNativeMinter                                                                                       | `0x4A60C46f671A3b86D78E9c0b793235C2D502d44E` |
| [Multicall3](https://www.multicall3.com/)                                                             | `0xcA11bde05977b3631167028862bE2a173976CA11` |
| [CreateX](https://createx.rocks/)                                                                     | `0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed` |
| [Arachnid Deterministic Deployment Proxy](https://github.com/Arachnid/deterministic-deployment-proxy) | `0x4e59b44847b379578588920cA78FbF26c0B4956C` |
| [ERC-2470 Singleton Factory](https://eips.ethereum.org/EIPS/eip-2470)                                 | `0xce0042B868300000d44A59004Da54A005ffdcf9f` |
| [Safe Singleton Factory](https://github.com/safe-fndn/safe-singleton-factory)                         | `0x914d7Fec6aaC8cd542e72Bca78B30650d45643d7` |

## Tokens

| Token | Address                                      |
| ----- | -------------------------------------------- |
| ETH   | `0x23958cBa555AC52C9495Df9b121ff73003e39dBb` |
| SOL   | `0x16eD50F96ea655Cb03638d7054e62e42Afb7b4fA` |
| eUSD  | `0xF4e644772b17b6c57327F4D111a73D68C8cC731B` |
| BTC   | `0xFA3198ecF05303a6d96E57a45E6c815055D255b1` |



## Redstone Oracle Data Feeds:

ETH : 0x086762859Ea720432D59D59f022B04222Ef74d0f : https://app.redstone.finance/push-feeds/ETH/edenMultiFeed
TIA : 0x818766399F558b717Bd8cdC72741F803BC87F615 : https://app.redstone.finance/push-feeds/TIA/edenMultiFeed
eUSD : 0xb81131B6368b3F0a83af09dB4E39Ac23DA96C2Db : https://app.redstone.finance/push-feeds/eUSD_FUNDAMENTAL%2FUSD/edenMultiFeed

## Created Morpho Oracle (WTIA / eUSD)

Factory: `0xD6202eFF2e869dc473EB13c38Cc787835Bf8B6df`
Oracle: `0x64c0b7ea807634e4279084ce89c3094e6df11cb5`
Tx Hash: `0x23d024507a45a9d3029c7037fc72f841057ced69fb7857fb5b787a5a2cec6747`
Block: `71292757`

Checks:
- `isMorphoChainlinkOracleV2(oracle) = true`
- `price() = 393189566778651045539309009546311500` (scaled by `1e36`, normalized ~= `0.3931895668`)

## Created Morpho Market (WTIA collateral / eUSD loan)

Morpho: `0xF050a2BB0468FF23cF2964AC182196C94D6815C3`
Market ID: `0x00fbd65128dd4f75090659b3ebea7f54fdbd57374cc2ccf749a21a2a6d16eb97`
Tx Hash: `0x15c2ba9e4558bd6ed5ad3e498606acc7f90b1e0cbe900937fb97c69d88000f18`
Block: `71310174`

Params:
- loanToken (eUSD): `0xF4e644772b17b6c57327F4D111a73D68C8cC731B`
- collateralToken (WTIA): `0x00000000000000000000000000000000ce1E571a`
- oracle: `0x64c0b7ea807634e4279084ce89c3094e6df11cb5`
- irm: `0x08A7b3a39E5425d616Cc9c046cf96B5eF21a139f`
- lltv: `860000000000000000` (86%)

## Created Vault (eUSD)

Factory: `0x9aaCAA01F5e6BC876D07f023744E3E0A456a64cf`
Vault: `0xbed2f51590622b3aefc914b898ad3a9be9fd7b7c`
Tx Hash: `0x6981f991ee0009683416012319b658bfd9418d377dff40a122a16dcd405ce1d0`
Block: `71352222`

Params:
- owner: `0xFCB33B700eDED624EEDa067bB4E23FA9bc552823`
- asset (eUSD): `0xF4e644772b17b6c57327F4D111a73D68C8cC731B`

## Created Vault Adapter (MorphoMarketV1AdapterV2)

Factory: `0x59e8C53D383F22b6371b5833504dfAa4136aE6f7`
Vault: `0xbed2f51590622b3aefc914b898ad3a9be9fd7b7c`
Adapter: `0x21c2a745deb52ba8728E1218aD16F78EDB1B35BD`
Tx Hash (create adapter): `0x68aacf6a829384d4f0978b266312eacc5e9bb8fea7f1f29dc23a3a2af4998eff`
Tx Hash (add adapter): `0xc8a17c2a2ca39bf05aab440f9276d1b566f1bd32394c8826c76ee4aa8a8cfce0`
Tx Hash (allocate 1 eUSD): `0xfd12b4d647796a4d84b3e875e1857128eb58c2959b8d51b64c27edc13cd5d881`
Block (create adapter): `71377457`