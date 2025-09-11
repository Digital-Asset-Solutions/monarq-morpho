# RPC Proxy API

A simple Express API to proxy RPC calls to the Eden network, solving CORS issues when calling the RPC from the frontend.

## Features

- ✅ CORS handling for frontend requests
- ✅ RPC request proxying to Eden network
- ✅ Error handling and logging
- ✅ Health check endpoint
- ✅ TypeScript support

## Quick Start

1. Install dependencies:
```bash
pnpm install
```

2. Start development server:
```bash
pnpm dev
```

3. The API will be available at `http://localhost:3001`

## Endpoints

- `GET /health` - Health check
- `POST /rpc` - Proxy RPC requests to Eden network

## Environment Variables

- `PORT` - Server port (default: 3001)
- `EDEN_RPC_URL` - Eden RPC endpoint (default: http://edennet-1-testnet.binary.builders:8545)

## Usage in Frontend

Update your Eden chain configuration to use the proxy:

```typescript
rpcUrls: {
  default: {
    http: ["http://localhost:3001/rpc"],
  },
}
```
