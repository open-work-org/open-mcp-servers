import { createHash } from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";
import { createMetaMcpServer } from "../src/server-factory.js";
import { MetaApiClient } from "../src/services/api.js";

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

class StubMetaApiClient extends MetaApiClient {
  readonly posts: Array<{ path: string; fields: Record<string, unknown> }> = [];
  readonly gets: Array<{ path: string; params: Record<string, unknown> }> = [];

  override async post<T>(path: string, fields: Record<string, unknown> = {}): Promise<T> {
    this.posts.push({ path, fields });
    return { audience_id: "audience-1", num_received: 1, num_invalid_entries: 0 } as T;
  }

  override async get<T>(path: string, params: Record<string, unknown> = {}): Promise<T> {
    this.gets.push({ path, params });
    return {
      id: "audience-1",
      name: "Test audience",
      subtype: "CUSTOM",
      operation_status: { code: 200, description: "Finished" },
      approximate_count_lower_bound: 1,
      approximate_count_upper_bound: 1,
    } as T;
  }
}

async function connectTestServer(apiClient: StubMetaApiClient) {
  const server = createMetaMcpServer(apiClient);
  const client = new Client({ name: "audience-tool-test", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return { client, server };
}

describe("custom audience CSV tools", () => {
  it("sends only locally hashed identifiers and reports upload status", async () => {
    const apiClient = new StubMetaApiClient("token");
    const { client, server } = await connectTestServer(apiClient);

    try {
      const result = await client.callTool({
        name: "meta_upload_custom_audience_csv",
        arguments: {
          audience_id: "audience-1",
          csv_content: "email,phone\nperson@example.com,+14155552671\n",
          acknowledge_sensitive_data: true,
          response_format: "json",
        },
      });

      expect(result.isError).not.toBe(true);
      expect(apiClient.posts).toHaveLength(1);
      expect(apiClient.posts[0].path).toBe("/audience-1/users");
      const payload = apiClient.posts[0].fields.payload as { schema: unknown; data: unknown };
      expect(payload.schema).toEqual(["EMAIL_SHA256", "PHONE_SHA256"]);
      expect(payload.data).toEqual([[hash("person@example.com"), hash("+14155552671")]]);
      expect(JSON.stringify(apiClient.posts[0].fields)).not.toContain("person@example.com");
      expect(JSON.stringify(apiClient.posts[0].fields)).not.toContain("+14155552671");
      expect(apiClient.gets).toHaveLength(1);
      expect(apiClient.gets[0].path).toBe("/audience-1");

      const output = JSON.parse((result.content[0] as { text: string }).text);
      expect(output.meta.num_received).toBe(1);
      expect(output.audience_status.operation_status.description).toBe("Finished");
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("supports dry-run without making API calls", async () => {
    const apiClient = new StubMetaApiClient("token");
    const { client, server } = await connectTestServer(apiClient);

    try {
      const result = await client.callTool({
        name: "meta_upload_custom_audience_csv",
        arguments: {
          audience_id: "audience-1",
          csv_content: "email\nperson@example.com\n",
          dry_run: true,
          acknowledge_sensitive_data: true,
        },
      });

      expect(result.isError).not.toBe(true);
      expect(apiClient.posts).toHaveLength(0);
      expect(apiClient.gets).toHaveLength(0);
      expect((result.content[0] as { text: string }).text).toContain("No customer data was sent to Meta.");
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("rejects replace before parsing or sending customer data", async () => {
    const apiClient = new StubMetaApiClient("token");
    const { client, server } = await connectTestServer(apiClient);

    try {
      const result = await client.callTool({
        name: "meta_upload_custom_audience_csv",
        arguments: {
          audience_id: "audience-1",
          csv_content: "email\nperson@example.com\n",
          operation: "replace",
          acknowledge_sensitive_data: true,
        },
      });

      expect(result.isError).toBe(true);
      expect((result.content[0] as { text: string }).text).toContain("Replace is not supported");
      expect(apiClient.posts).toHaveLength(0);
      expect(apiClient.gets).toHaveLength(0);
    } finally {
      await client.close();
      await server.close();
    }
  });
});
