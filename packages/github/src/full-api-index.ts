#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { resolveApiKey } from "./op-fallback.js";
import { GitHubApiClient } from "./services/api.js";
import { createGitHubMcpServer } from "./server-factory.js";

resolveApiKey("GITHUB_PERSONAL_ACCESS_TOKEN", "op://Development/GitHub Personal Access Token/credential");
const server = createGitHubMcpServer(new GitHubApiClient(process.env.GITHUB_PERSONAL_ACCESS_TOKEN ?? ""));
await server.connect(new StdioServerTransport());
