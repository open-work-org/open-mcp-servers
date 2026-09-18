import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { GraphApiClient } from "./services/api.js";
import { registerGraphApiTool } from "./tools/graph-api.js";

export function createMetaGraphMcpServer(client: GraphApiClient): McpServer {
  const server = new McpServer({ name: "meta-graph-mcp-server", version: "1.0.0" });
  registerGraphApiTool(server, client);
  return server;
}
