import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DelhiveryApiClient } from "./services/api.js";
import { registerDelhiveryApiRequestTool } from "./tools/api-request.js";

export function createDelhiveryMcpServer(client: DelhiveryApiClient): McpServer {
  const server = new McpServer({ name: "delhivery-mcp-server", version: "1.0.0" });
  registerDelhiveryApiRequestTool(server, client);
  return server;
}
