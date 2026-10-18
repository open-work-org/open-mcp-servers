import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DelhiveryApiClient, type DelhiveryFields, type DelhiveryMethod } from "../services/api.js";

export function registerDelhiveryApiRequestTool(server: McpServer, client: DelhiveryApiClient): void {
  server.registerTool(
    "delhivery_b2c_api_request",
    {
      title: "Delhivery B2C API Request",
      description: `Calls an API path on the configured Delhivery One B2C host using DELHIVERY_API_TOKEN.

Use the Delhivery B2C developer documentation for the exact path, method, parameters, and payload required by each API (serviceability, waybill, shipment manifestation/update/cancellation, tracking, shipping cost, labels, pickup requests, warehouses, NDR, and documents).

The server fixes the host to staging-express.delhivery.com or track.delhivery.com according to DELHIVERY_ENV. It never accepts a caller-supplied URL. Pass query values in params and a JSON object in body. Use body_format="form" for Delhivery endpoints that expect form encoding, including the manifestation format=json&data=... shape. GET requests are read-only; every other method requires confirm_mutation=true. The token is injected only in the Authorization header and must not be placed in params or body.`,
      inputSchema: z
        .object({
          method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).default("GET"),
          path: z.string().min(1).max(2048).describe("Official Delhivery API path beginning with '/', without query parameters"),
          params: z.record(z.string(), z.unknown()).optional().describe("Query-string parameters"),
          body: z.record(z.string(), z.unknown()).optional().describe("Request body fields"),
          body_format: z.enum(["json", "form"]).default("json").describe("Use form for application/x-www-form-urlencoded APIs"),
          confirm_mutation: z.boolean().default(false).describe("Must be true for POST, PUT, PATCH, or DELETE requests"),
        })
        .strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ method, path, params, body, body_format, confirm_mutation }) => {
      if (method !== "GET" && !confirm_mutation) {
        return { content: [{ type: "text", text: "Error: Mutation blocked. Set confirm_mutation=true for POST, PUT, PATCH, or DELETE." }], isError: true };
      }
      try {
        const result = await client.request(
          method as DelhiveryMethod,
          path,
          (params ?? {}) as DelhiveryFields,
          (body ?? {}) as DelhiveryFields,
          body_format,
        );
        return { content: [{ type: "text", text: result }] };
      } catch (error) {
        return {
          content: [{ type: "text", text: error instanceof Error ? `Error: ${error.message}` : "Error: Unexpected Delhivery API error." }],
          isError: true,
        };
      }
    },
  );
}
