#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { resolveApiKey } from "./op-fallback.js";
import { GitHubApiClient } from "./services/api.js";
import { startGitHubHttpServer } from "./http-server.js";
import { createGitHubMcpServer } from "./server-factory.js";

resolveApiKey("GITHUB_PERSONAL_ACCESS_TOKEN", "op://Development/GitHub Personal Access Token/credential");
const token = process.env.GITHUB_PERSONAL_ACCESS_TOKEN ?? "";
const transportMode = (process.env.MCP_TRANSPORT ?? "stdio").toLowerCase();

if (transportMode === "stdio") {
  const server = createGitHubMcpServer(new GitHubApiClient(token));
  await server.connect(new StdioServerTransport());
} else if (transportMode === "http" || transportMode === "streamable-http") {
  await startGitHubHttpServer(token);
} else {
  throw new Error(`Unsupported MCP_TRANSPORT "${transportMode}". Use "stdio" or "streamable-http".`);
}
