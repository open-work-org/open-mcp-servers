import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ShadowfaxApiClient } from "./services/api.js";
import { registerShadowfaxForwardRequestTool } from "./tools/api-request.js";

export function createShadowfaxMcpServer(client: ShadowfaxApiClient): McpServer {
  const server = new McpServer({ name: "shadowfax-mcp-server", version: "0.1.0" });
  registerShadowfaxForwardRequestTool(server, client);
  return server;
}
