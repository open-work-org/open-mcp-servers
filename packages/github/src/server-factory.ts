import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { GitHubApiClient } from "./services/api.js";
import { registerGitHubTools } from "./tools/github.js";

export function createGitHubMcpServer(client: GitHubApiClient): McpServer {
  const server = new McpServer({ name: "github-mcp-server", version: "1.0.0" });
  registerGitHubTools(server, client);
  return server;
}
