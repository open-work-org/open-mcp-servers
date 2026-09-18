import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";
import { createMetaGraphMcpServer } from "../src/server-factory.js";
import { GraphApiClient, type GraphApiFields, type GraphApiMethod } from "../src/services/api.js";

class StubGraphApiClient extends GraphApiClient {
  readonly requests: Array<{ method: GraphApiMethod; path: string; params: GraphApiFields; body: GraphApiFields }> = [];

  override async request<T>(method: GraphApiMethod, path: string, params: GraphApiFields = {}, body: GraphApiFields = {}): Promise<T> {
    this.requests.push({ method, path, params, body });
    return { ok: true, method, path, params, body } as T;
  }
}

async function connectTestServer(apiClient: StubGraphApiClient) {
  const server = createMetaGraphMcpServer(apiClient);
  const client = new Client({ name: "meta-graph-tool-test", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return { client, server };
}

describe("meta_graph_api_request", () => {
  it("routes read-only requests through the generic tool", async () => {
    const apiClient = new StubGraphApiClient("token");
    const { client, server } = await connectTestServer(apiClient);

    try {
      const result = await client.callTool({
        name: "meta_graph_api_request",
        arguments: {
          method: "GET",
          path: "/act_123/insights",
          params: { fields: "spend", date_preset: "today" },
        },
      });

      expect(result.isError).not.toBe(true);
      expect(apiClient.requests).toEqual([{
        method: "GET",
        path: "/act_123/insights",
        params: { fields: "spend", date_preset: "today" },
        body: {},
      }]);
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("blocks mutations without explicit confirmation", async () => {
    const apiClient = new StubGraphApiClient("token");
    const { client, server } = await connectTestServer(apiClient);

    try {
      const result = await client.callTool({
        name: "meta_graph_api_request",
        arguments: { method: "DELETE", path: "/123" },
      });

      expect(result.isError).toBe(true);
      expect((result.content[0] as { text: string }).text).toContain("Mutation blocked");
      expect(apiClient.requests).toHaveLength(0);
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("passes confirmed mutations without exposing the access token", async () => {
    const apiClient = new StubGraphApiClient("token");
    const { client, server } = await connectTestServer(apiClient);

    try {
      const result = await client.callTool({
        name: "meta_graph_api_request",
        arguments: {
          method: "POST",
          path: "/act_123/campaigns",
          body: { name: "Test campaign", objective: "OUTCOME_TRAFFIC" },
          confirm_mutation: true,
        },
      });

      expect(result.isError).not.toBe(true);
      expect(apiClient.requests[0].body).toEqual({ name: "Test campaign", objective: "OUTCOME_TRAFFIC" });
      expect(JSON.stringify(apiClient.requests[0])).not.toContain("token");
    } finally {
      await client.close();
      await server.close();
    }
  });
});
