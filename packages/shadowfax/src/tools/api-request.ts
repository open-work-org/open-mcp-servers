import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ShadowfaxApiClient, type ShadowfaxFields, type ShadowfaxMethod } from "../services/api.js";

export function registerShadowfaxForwardRequestTool(server: McpServer, client: ShadowfaxApiClient): void {
  server.registerTool(
    "shadowfax_fwd",
    {
      title: "Shadowfax Forward Logistics API Request",
      description: `Calls a documented Shadowfax Forward Logistics API path using SHADOWFAX_API_TOKEN. Supported API path versions are /v1/clients/, /v3/clients/, and /v4/clients/; the host is fixed to the configured Shadowfax environment.

Use the Shadowfax Forward Logistics API documentation for endpoint paths, methods, query parameters, and payloads. Common operations include serviceability, order placement, tracking, bulk tracking, cancellation, updates, rates, labels, proof of delivery, escalations, and AWB generation.

Pass query values in params and a JSON object in body. GET is read-only; every other method requires confirm_mutation=true. The token is injected only in the Authorization header. Shadowfax may return HTTP 200 with message="Failure" for validation or business rejections, so inspect the response message rather than relying only on the HTTP status.`,
      inputSchema: z
        .object({
          method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).default("GET"),
          path: z.string().min(1).max(2048).describe("Forward Logistics API path beginning with /v1/clients/, /v3/clients/, or /v4/clients/, without query parameters"),
          params: z.record(z.string(), z.unknown()).optional().describe("Query-string parameters"),
          body: z.record(z.string(), z.unknown()).optional().describe("JSON request body fields"),
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
    async ({ method, path, params, body, confirm_mutation }) => {
      if (method !== "GET" && !confirm_mutation) {
        return { content: [{ type: "text", text: "Error: Mutation blocked. Set confirm_mutation=true for POST, PUT, PATCH, or DELETE." }], isError: true };
      }
      try {
        const result = await client.request(
          method as ShadowfaxMethod,
          path,
          (params ?? {}) as ShadowfaxFields,
          (body ?? {}) as ShadowfaxFields,
        );
        return { content: [{ type: "text", text: result.text }], ...(result.isBusinessFailure ? { isError: true } : {}) };
      } catch (error) {
        return {
          content: [{ type: "text", text: error instanceof Error ? `Error: ${error.message}` : "Error: Unexpected Shadowfax API error." }],
          isError: true,
        };
      }
    },
  );
}
