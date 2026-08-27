#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { resolveApiKey } from "./op-fallback.js";
import { startGitHubHttpServer } from "./http-server.js";
import { createUnifiedGitHubServer } from "./unified.js";

resolveApiKey("GITHUB_PERSONAL_ACCESS_TOKEN", "op://Development/GitHub Personal Access Token/credential");
const token = process.env.GITHUB_PERSONAL_ACCESS_TOKEN ?? "";
const transportMode = (process.env.MCP_TRANSPORT ?? "stdio").toLowerCase();

if (transportMode === "stdio") {
  const unified = await createUnifiedGitHubServer(token);
  await unified.server.connect(new StdioServerTransport());
} else if (transportMode === "http" || transportMode === "streamable-http") {
  await startGitHubHttpServer(token);
} else {
  throw new Error(`Unsupported MCP_TRANSPORT "${transportMode}". Use "stdio" or "streamable-http".`);
}
