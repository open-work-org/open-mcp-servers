import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GitHubApiClient, githubErrorMessage } from "./services/api.js";
import { registerGitHubTools } from "./tools/github.js";

type JsonSchema = {
  type?: string; description?: string; properties?: Record<string, JsonSchema>;
  required?: string[]; items?: JsonSchema; enum?: unknown[];
  oneOf?: JsonSchema[]; anyOf?: JsonSchema[];
};

function schemaToZod(schema: JsonSchema = {}): z.ZodTypeAny {
  if (schema.enum?.length) {
    if (schema.enum.every((v): v is string => typeof v === "string")) return z.enum(schema.enum as [string, ...string[]]);
    if (schema.enum.length === 1) return z.literal(schema.enum[0] as any);
    return z.union(schema.enum.map((v) => z.literal(v as any)) as unknown as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]]);
  }
  const alternatives = schema.oneOf ?? schema.anyOf;
  if (alternatives?.length && alternatives.length >= 2) return z.union(alternatives.map(schemaToZod) as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]]);
  let result: z.ZodTypeAny;
  switch (schema.type) {
    case "object": {
      const required = new Set(schema.required ?? []);
      const shape: Record<string, z.ZodTypeAny> = {};
      for (const [name, property] of Object.entries(schema.properties ?? {})) {
        const value = schemaToZod(property);
        shape[name] = required.has(name) ? value : value.optional();
      }
      result = z.object(shape).passthrough();
      break;
    }
    case "array": result = z.array(schemaToZod(schema.items)); break;
    case "string": result = z.string(); break;
    case "integer": result = z.number().int(); break;
    case "number": result = z.number(); break;
    case "boolean": result = z.boolean(); break;
    case "null": result = z.null(); break;
    default: result = z.unknown();
  }
  return schema.description ? result.describe(schema.description) : result;
}

async function listAllTools(client: Client): Promise<Array<Record<string, any>>> {
  const tools: Array<Record<string, any>> = [];
  let cursor: string | undefined;
  do {
    const page = await client.listTools(cursor ? { cursor } : undefined);
    tools.push(...(page.tools as Array<Record<string, any>>));
    cursor = page.nextCursor;
  } while (cursor);
  return tools;
}

export type UnifiedGitHubServer = { server: McpServer; close: () => Promise<void> };

/** Creates the unified server used by both stdio and Streamable HTTP transports. */
export async function createUnifiedGitHubServer(token: string): Promise<UnifiedGitHubServer> {
  if (!token) throw new Error("GITHUB_PERSONAL_ACCESS_TOKEN is required to start the GitHub connector.");

  const image = process.env.GITHUB_MCP_IMAGE ?? "ghcr.io/github/github-mcp-server";
  const upstreamTransport = new StdioClientTransport({
    command: "docker",
    args: ["run", "-i", "--rm", "-e", "GITHUB_PERSONAL_ACCESS_TOKEN", "-e", "GITHUB_TOOLSETS", "-e", "GITHUB_INSIDERS", ...(process.env.GITHUB_HOST ? ["-e", "GITHUB_HOST"] : []), image],
    env: { ...process.env, GITHUB_PERSONAL_ACCESS_TOKEN: token, GITHUB_TOOLSETS: "all", GITHUB_INSIDERS: "true" } as Record<string, string>,
    stderr: "inherit",
  });
  const upstream = new Client({ name: "open-mcp-github-unified", version: "1.0.0" });
  await upstream.connect(upstreamTransport);

  const server = new McpServer({ name: "github-mcp-server", version: "1.0.0" });
  registerGitHubTools(server, new GitHubApiClient(token));
  for (const tool of await listAllTools(upstream)) {
    server.registerTool(tool.name, {
      title: tool.title ?? tool.name,
      description: tool.description,
      inputSchema: schemaToZod((tool.inputSchema ?? {}) as JsonSchema),
      annotations: tool.annotations,
    }, async (args) => {
      try { return await upstream.callTool({ name: tool.name, arguments: args as Record<string, unknown> }) as any; }
      catch (error) { return { content: [{ type: "text" as const, text: githubErrorMessage(error) }], isError: true }; }
    });
  }

  return {
    server,
    close: async () => {
      await server.close();
      await upstream.close();
    },
  };
}
