import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(morgan("combined"));
app.use(express.json({ limit: "10mb" }));

// CORS configuration - allow requests from your frontend
app.use(
  cors({
    origin: [
      "http://localhost:5173", // Vite dev server
      "http://localhost:3000", // Alternative dev port
      "https://morpho-celestia.vercel.app", // Add your production domain
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  }),
);

// Eden RPC endpoint
const EDEN_RPC_URL = "http://edennet-1-testnet.binary.builders:8545";

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// RPC proxy endpoint
app.post("/rpc", async (req, res) => {
  try {
    const { method, params, id } = req.body;

    if (!method) {
      return res.status(400).json({
        jsonrpc: "2.0",
        error: { code: -32600, message: "Invalid Request" },
        id: id || null,
      });
    }

    // Forward the request to the actual RPC endpoint
    const response = await fetch(EDEN_RPC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method,
        params: params || [],
        id: id || 1,
      }),
    });

    if (!response.ok) {
      throw new Error(`RPC request failed with status: ${response.status}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("RPC Proxy Error:", error);
    res.status(500).json({
      jsonrpc: "2.0",
      error: {
        code: -32603,
        message: "Internal error",
        data: error instanceof Error ? error.message : "Unknown error",
      },
      id: req.body.id || null,
    });
  }
});

// Handle preflight requests
app.options("*", (req, res) => {
  res.status(200).end();
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`🚀 RPC Proxy server running on port ${PORT}`);
  console.log(`📡 Proxying requests to: ${EDEN_RPC_URL}`);
  console.log(`🌐 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 RPC endpoint: http://localhost:${PORT}/rpc`);
});
