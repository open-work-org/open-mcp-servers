import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GraphApiClient, type GraphApiFields, type GraphApiMethod, graphApiErrorMessage } from "../services/api.js";
import { errorResult, truncateResponse } from "../services/utils.js";

export function registerGraphApiTool(server: McpServer, client: GraphApiClient): void {
  server.registerTool(
    "meta_graph_api_request",
    {
      title: "Meta Graph API Request",
      description: `Makes a direct request to a Meta Graph API endpoint using the configured META_ACCESS_TOKEN.

Use a relative path such as /me, /act_<AD_ACCOUNT_ID>/insights, or /<PAGE_ID>/feed. Put query values in params and form fields in body. Nested objects and arrays are JSON-encoded for Meta's form-based Graph API.

GET requests are read-only. POST, PATCH, and DELETE requests require confirm_mutation=true and may change campaigns, ads, audiences, Pages, Instagram assets, or other Meta resources.

This is a low-level escape hatch. It does not bypass Meta permissions, rate limits, API-version rules, pagination, asynchronous processing, or multipart/binary upload requirements. Do not include access_token in params or body; the server injects META_ACCESS_TOKEN.`,
      inputSchema: z
        .object({
          method: z.enum(["GET", "POST", "PATCH", "DELETE"]).default("GET"),
          path: z.string().min(1).max(2048).describe("Relative Graph API path beginning with '/'"),
          params: z.record(z.string(), z.unknown()).optional().describe("Query-string parameters"),
          body: z.record(z.string(), z.unknown()).optional().describe("Form fields for non-GET requests"),
          confirm_mutation: z
            .boolean()
            .default(false)
            .describe("Must be true for POST, PATCH, or DELETE requests"),
        })
        .strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ method, path, params, body, confirm_mutation }) => {
      if (method !== "GET" && !confirm_mutation) {
        return errorResult(new Error("Mutation blocked. Set confirm_mutation=true for POST, PATCH, or DELETE."));
      }

      try {
        const result = await client.request(
          method as GraphApiMethod,
          path,
          (params ?? {}) as GraphApiFields,
          (body ?? {}) as GraphApiFields,
        );
        return {
          content: [{ type: "text", text: truncateResponse(JSON.stringify(result, null, 2)) }],
        };
      } catch (error) {
        return errorResult(new Error(graphApiErrorMessage(error)));
      }
    },
  );
}
