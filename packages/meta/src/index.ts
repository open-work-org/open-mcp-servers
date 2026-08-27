#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { MetaApiClient } from "./services/api.js";
import { resolveApiKey } from "./op-fallback.js";
import { createMetaMcpServer } from "./server-factory.js";
import { startHttpServer } from "./http-server.js";

resolveApiKey("META_ACCESS_TOKEN", "op://Development/Meta Access Token/credential");
resolveApiKey("THREADS_ACCESS_TOKEN", "op://Development/Threads Access Token/credential");

const token = process.env.META_ACCESS_TOKEN ?? "";
const threadsToken = process.env.THREADS_ACCESS_TOKEN;

const transportMode = (process.env.MCP_TRANSPORT ?? "stdio").toLowerCase();

if (transportMode === "stdio") {
  const server = createMetaMcpServer(new MetaApiClient(token, threadsToken));
  const transport = new StdioServerTransport();
  await server.connect(transport);
} else if (transportMode === "http" || transportMode === "streamable-http") {
  await startHttpServer(token, threadsToken);
} else {
  throw new Error(
    `Unsupported MCP_TRANSPORT "${transportMode}". Use "stdio" or "streamable-http".`
  );
}
