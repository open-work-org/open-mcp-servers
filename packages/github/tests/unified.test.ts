import { afterEach, describe, expect, it, vi } from "vitest";
import { createUnifiedGitHubServer } from "../src/unified.js";

const command = process.env.OPEN_MCP_GITHUB_UPSTREAM_COMMAND;
const args = process.env.OPEN_MCP_GITHUB_UPSTREAM_ARGS;

afterEach(() => {
  if (command === undefined) delete process.env.OPEN_MCP_GITHUB_UPSTREAM_COMMAND;
  else process.env.OPEN_MCP_GITHUB_UPSTREAM_COMMAND = command;
  if (args === undefined) delete process.env.OPEN_MCP_GITHUB_UPSTREAM_ARGS;
  else process.env.OPEN_MCP_GITHUB_UPSTREAM_ARGS = args;
  vi.restoreAllMocks();
});

describe("unified GitHub server", () => {
  it("keeps native tools available when the upstream process cannot start", async () => {
    process.env.OPEN_MCP_GITHUB_UPSTREAM_COMMAND = "/definitely-not-a-github-mcp-server";
    delete process.env.OPEN_MCP_GITHUB_UPSTREAM_ARGS;
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const unified = await createUnifiedGitHubServer("test-token");
    expect(unified.server).toBeDefined();
    await unified.close();
  });
});
