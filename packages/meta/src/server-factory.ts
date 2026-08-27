import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { MetaApiClient } from "./services/api.js";
import { registerPageTools } from "./tools/pages.js";
import { registerInstagramTools } from "./tools/instagram.js";
import { registerAdsTools } from "./tools/ads.js";
import { registerAudiencesTools } from "./tools/audiences.js";
import { registerInsightsTools } from "./tools/insights.js";
import { registerThreadsTools } from "./tools/threads.js";
import { registerAdLibraryTools } from "./tools/ad_library.js";
import { registerConversionTools } from "./tools/conversions.js";
import { registerUtilityTools } from "./tools/utility.js";
import { registerChartTools } from "./tools/charts.js";
import { registerCommerceTools } from "./tools/commerce.js";

export function createMetaMcpServer(client: MetaApiClient): McpServer {
  const server = new McpServer({
    name: "meta-mcp-server",
    version: "2.1.0",
  });

  registerPageTools(server, client);
  registerInstagramTools(server, client);
  registerAdsTools(server, client);
  registerAudiencesTools(server, client);
  registerInsightsTools(server, client);
  registerThreadsTools(server, client);
  registerAdLibraryTools(server, client);
  registerConversionTools(server, client);
  registerUtilityTools(server, client);
  registerChartTools(server);
  registerCommerceTools(server, client);

  return server;
}
