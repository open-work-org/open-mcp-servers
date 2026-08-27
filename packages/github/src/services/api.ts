import axios, { AxiosError, type Method } from "axios";

const DEFAULT_API_URL = "https://api.github.com";
const DEFAULT_UPLOADS_URL = "https://uploads.github.com";

function withoutTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

/** A small GitHub REST/GraphQL client. It deliberately accepts relative API paths only. */
export class GitHubApiClient {
  private readonly token: string;
  private readonly apiUrl: string;
  private readonly uploadsUrl: string;

  constructor(
    token: string,
    apiUrl = process.env.GITHUB_API_URL ?? DEFAULT_API_URL,
    uploadsUrl = process.env.GITHUB_UPLOADS_URL ?? DEFAULT_UPLOADS_URL
  ) {
    this.token = token;
    this.apiUrl = withoutTrailingSlash(apiUrl);
    this.uploadsUrl = withoutTrailingSlash(uploadsUrl);
  }

  requireToken(): void {
    if (!this.token) {
      throw new Error(
        "GITHUB_PERSONAL_ACCESS_TOKEN is not configured. Add a fine-grained PAT to your MCP server env. " +
          "Grant only the repository and permissions required for the operations you intend to use."
      );
    }
  }

  private validatePath(path: string): string {
    if (!path.startsWith("/") || path.startsWith("//") || path.includes("..") || /[\r\n]/.test(path)) {
      throw new Error("path must be a relative GitHub API path beginning with a single '/'.");
    }
    return path;
  }

  private headers(accept?: string): Record<string, string> {
    this.requireToken();
    return {
      Accept: accept ?? "application/vnd.github+json",
      Authorization: `Bearer ${this.token}`,
      "X-GitHub-Api-Version": "2026-03-10",
    };
  }

  async request<T>(
    method: Method,
    path: string,
    options: { query?: Record<string, unknown>; body?: unknown; accept?: string } = {}
  ): Promise<T> {
    const response = await this.requestWithStatus<T>(method, path, options);
    return response.data;
  }

  async requestWithStatus<T>(
    method: Method,
    path: string,
    options: { query?: Record<string, unknown>; body?: unknown; accept?: string } = {}
  ): Promise<{ data: T; status: number }> {
    const response = await axios.request<T>({
      method,
      url: `${this.apiUrl}${this.validatePath(path)}`,
      params: options.query,
      data: options.body,
      headers: this.headers(options.accept),
      timeout: 30_000,
    });
    return { data: response.data, status: response.status };
  }

  async graphql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    return this.request<T>("POST", "/graphql", { body: { query, variables: variables ?? {} } });
  }

  async uploadReleaseAssetForRepository<T>(owner: string, repo: string, releaseId: number, name: string, content: Buffer, contentType: string, label?: string): Promise<T> {
    this.requireToken();
    if (!owner || !repo || !Number.isInteger(releaseId) || releaseId < 1 || !name) {
      throw new Error("owner, repo, a positive release_id, and name are required.");
    }
    const response = await axios.post<T>(
      `${this.uploadsUrl}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases/${releaseId}/assets`,
      content,
      {
        headers: { ...this.headers(), "Content-Type": contentType },
        params: { name, ...(label ? { label } : {}) },
        timeout: 60_000,
      }
    );
    return response.data;
  }
}

export function githubErrorMessage(error: unknown): string {
  if (error instanceof AxiosError && error.response) {
    const data = error.response.data as { message?: string; documentation_url?: string } | undefined;
    const detail = data?.message ? `: ${data.message}` : "";
    if (error.response.status === 401) return `GitHub authentication failed${detail}. Check GITHUB_PERSONAL_ACCESS_TOKEN.`;
    if (error.response.status === 403) return `GitHub permission or rate-limit error${detail}. Check the PAT's repository permissions, SSO authorization, and rate-limit headers.`;
    if (error.response.status === 404) return `GitHub resource not found${detail}. The PAT may also lack access to this private resource.`;
    return `GitHub API request failed (${error.response.status})${detail}`;
  }
  return error instanceof Error ? `Error: ${error.message}` : "Error: Unexpected GitHub API error.";
}
