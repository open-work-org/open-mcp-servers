import { describe, expect, it } from "vitest";
import { GitHubApiClient } from "../src/services/api.js";

describe("GitHubApiClient", () => {
  it("requires GITHUB_PERSONAL_ACCESS_TOKEN before making requests", async () => {
    await expect(new GitHubApiClient("").request("GET", "/user")).rejects.toThrow(
      "GITHUB_PERSONAL_ACCESS_TOKEN is not configured"
    );
  });

  it("rejects absolute URLs and path traversal", async () => {
    const client = new GitHubApiClient("test-token");
    await expect(client.request("GET", "https://example.com")).rejects.toThrow("relative GitHub API path");
    await expect(client.request("GET", "/repos/owner/../private")).rejects.toThrow("relative GitHub API path");
    await expect(client.request("GET", "//example.com")).rejects.toThrow("relative GitHub API path");
  });
});
