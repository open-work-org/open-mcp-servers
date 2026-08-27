import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import sodium from "libsodium-wrappers";
import { GitHubApiClient, githubErrorMessage } from "../services/api.js";

const JsonValue = z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(z.unknown()), z.record(z.unknown())]);
const JsonObject = z.record(z.unknown());
const ResponseFormat = z.enum(["json", "markdown"]).default("json");

function result(data: unknown, responseFormat: "json" | "markdown" = "json") {
  return { content: [{ type: "text" as const, text: responseFormat === "json" ? JSON.stringify(data, null, 2) : `\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\`` }] };
}

function failure(error: unknown) {
  return { content: [{ type: "text" as const, text: githubErrorMessage(error) }], isError: true as const };
}

const SecretName = z.string().regex(/^[A-Z0-9_]+$/, "secret_name must contain only uppercase letters, numbers, and underscores");
const Visibility = z.enum(["all", "private", "selected"]);
const OrganizationSecretSchema = z.object({
  org: z.string().min(1), secret_name: SecretName, value: z.string(), visibility: Visibility,
  selected_repository_ids: z.array(z.number().int().positive()).optional(),
}).strict().superRefine((input, ctx) => {
  if (input.visibility === "selected" && (!input.selected_repository_ids || input.selected_repository_ids.length === 0)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["selected_repository_ids"], message: "required when visibility is selected" });
  }
  if (input.visibility !== "selected" && input.selected_repository_ids !== undefined) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["selected_repository_ids"], message: "only allowed when visibility is selected" });
  }
});
const RepositorySecretSchema = z.object({ owner: z.string().min(1), repo: z.string().min(1), secret_name: SecretName, value: z.string() }).strict();
const EnvironmentSecretSchema = z.object({ owner: z.string().min(1), repo: z.string().min(1), environment_name: z.string().min(1), secret_name: SecretName, value: z.string() }).strict();

type SecretKey = { key_id: string; key: string };

export async function encryptSecret(value: string, publicKey: string): Promise<string> {
  await sodium.ready;
  const key = sodium.from_base64(publicKey, sodium.base64_variants.ORIGINAL);
  const encrypted = sodium.crypto_box_seal(sodium.from_string(value), key);
  return sodium.to_base64(encrypted, sodium.base64_variants.ORIGINAL);
}

async function putEncryptedSecret(
  client: GitHubApiClient,
  keyPath: string,
  secretPath: string,
  secretName: string,
  value: string,
  extra: Record<string, unknown> = {}
): Promise<{ status: number; secret_name: string }> {
  const publicKey = await client.request<SecretKey>("GET", keyPath);
  if (!publicKey?.key_id || !publicKey.key) throw new Error("GitHub returned an invalid secrets public key.");
  const encryptedValue = await encryptSecret(value, publicKey.key);
  const response = await client.requestWithStatus("PUT", secretPath, { body: { encrypted_value: encryptedValue, key_id: publicKey.key_id, ...extra } });
  return { status: response.status, secret_name: secretName };
}

function registerEncryptedSecretTool(
  server: McpServer,
  name: string,
  title: string,
  description: string,
  inputSchema: z.ZodTypeAny,
  handler: (args: any) => Promise<unknown>
): void {
  server.registerTool(name, { title, description, inputSchema, annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true } }, async (args) => {
    try { return result(await handler(args)); } catch (error) { return failure(error); }
  });
}

function registerSecretTools(server: McpServer, client: GitHubApiClient): void {
  registerEncryptedSecretTool(server, "github_set_organization_secret", "Set GitHub Actions organization secret", "Encrypts a secret locally with LibSodium and creates or updates an organization Actions secret. The plaintext value is never sent to GitHub.", OrganizationSecretSchema, async (input) => putEncryptedSecret(client, `/orgs/${encodeURIComponent(input.org)}/actions/secrets/public-key`, `/orgs/${encodeURIComponent(input.org)}/actions/secrets/${input.secret_name}`, input.secret_name, input.value, { visibility: input.visibility, ...(input.selected_repository_ids ? { selected_repository_ids: input.selected_repository_ids } : {}) }));
  registerEncryptedSecretTool(server, "github_set_repository_secret", "Set GitHub Actions repository secret", "Encrypts a secret locally with LibSodium and creates or updates a repository Actions secret.", RepositorySecretSchema, async (input) => putEncryptedSecret(client, `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/actions/secrets/public-key`, `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/actions/secrets/${input.secret_name}`, input.secret_name, input.value));
  registerEncryptedSecretTool(server, "github_set_environment_secret", "Set GitHub Actions environment secret", "Encrypts a secret locally with LibSodium and creates or updates an environment Actions secret.", EnvironmentSecretSchema, async (input) => putEncryptedSecret(client, `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/environments/${encodeURIComponent(input.environment_name)}/secrets/public-key`, `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/environments/${encodeURIComponent(input.environment_name)}/secrets/${input.secret_name}`, input.secret_name, input.value));

  registerEncryptedSecretTool(server, "github_set_dependabot_organization_secret", "Set Dependabot organization secret", "Encrypts a secret locally with LibSodium and creates or updates an organization Dependabot secret.", OrganizationSecretSchema, async (input) => putEncryptedSecret(client, `/orgs/${encodeURIComponent(input.org)}/dependabot/secrets/public-key`, `/orgs/${encodeURIComponent(input.org)}/dependabot/secrets/${input.secret_name}`, input.secret_name, input.value, { visibility: input.visibility, ...(input.selected_repository_ids ? { selected_repository_ids: input.selected_repository_ids } : {}) }));
  registerEncryptedSecretTool(server, "github_set_dependabot_repository_secret", "Set Dependabot repository secret", "Encrypts a secret locally with LibSodium and creates or updates a repository Dependabot secret.", RepositorySecretSchema, async (input) => putEncryptedSecret(client, `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/dependabot/secrets/public-key`, `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/dependabot/secrets/${input.secret_name}`, input.secret_name, input.value));

  registerEncryptedSecretTool(server, "github_set_codespaces_organization_secret", "Set Codespaces organization secret", "Encrypts a secret locally with LibSodium and creates or updates an organization Codespaces secret.", OrganizationSecretSchema, async (input) => putEncryptedSecret(client, `/orgs/${encodeURIComponent(input.org)}/codespaces/secrets/public-key`, `/orgs/${encodeURIComponent(input.org)}/codespaces/secrets/${input.secret_name}`, input.secret_name, input.value, { visibility: input.visibility, ...(input.selected_repository_ids ? { selected_repository_ids: input.selected_repository_ids } : {}) }));
  registerEncryptedSecretTool(server, "github_set_codespaces_repository_secret", "Set Codespaces repository secret", "Encrypts a secret locally with LibSodium and creates or updates a repository Codespaces secret.", RepositorySecretSchema, async (input) => putEncryptedSecret(client, `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/codespaces/secrets/public-key`, `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/codespaces/secrets/${input.secret_name}`, input.secret_name, input.value));
  registerEncryptedSecretTool(server, "github_set_codespaces_user_secret", "Set Codespaces user secret", "Encrypts a secret locally with LibSodium and creates or updates the authenticated user's Codespaces secret.", z.object({ secret_name: SecretName, value: z.string(), selected_repository_ids: z.array(z.number().int().positive()).optional() }).strict(), async (input) => putEncryptedSecret(client, "/user/codespaces/secrets/public-key", `/user/codespaces/secrets/${input.secret_name}`, input.secret_name, input.value, input.selected_repository_ids ? { selected_repository_ids: input.selected_repository_ids } : {}));

  registerEncryptedSecretTool(server, "github_set_agent_organization_secret", "Set agent organization secret", "Encrypts a secret locally with LibSodium and creates or updates an organization agent secret.", OrganizationSecretSchema, async (input) => putEncryptedSecret(client, `/orgs/${encodeURIComponent(input.org)}/agents/secrets/public-key`, `/orgs/${encodeURIComponent(input.org)}/agents/secrets/${input.secret_name}`, input.secret_name, input.value, { visibility: input.visibility, ...(input.selected_repository_ids ? { selected_repository_ids: input.selected_repository_ids } : {}) }));
  registerEncryptedSecretTool(server, "github_set_agent_repository_secret", "Set agent repository secret", "Encrypts a secret locally with LibSodium and creates or updates a repository agent secret.", RepositorySecretSchema, async (input) => putEncryptedSecret(client, `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/agents/secrets/public-key`, `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/agents/secrets/${input.secret_name}`, input.secret_name, input.value));

  server.registerTool("github_list_organization_secrets", { title: "List GitHub Actions organization secrets", description: "Lists organization Actions secrets without revealing their values.", inputSchema: z.object({ org: z.string().min(1), per_page: z.number().int().min(1).max(100).optional(), page: z.number().int().min(1).optional() }).strict(), annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true } }, async ({ org, per_page, page }) => { try { return result(await client.request("GET", `/orgs/${encodeURIComponent(org)}/actions/secrets`, { query: { per_page, page } })); } catch (error) { return failure(error); } });
  server.registerTool("github_delete_organization_secret", { title: "Delete GitHub Actions organization secret", description: "Permanently deletes an organization Actions secret by name.", inputSchema: z.object({ org: z.string().min(1), secret_name: SecretName }).strict(), annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true } }, async ({ org, secret_name }) => { try { const response = await client.requestWithStatus("DELETE", `/orgs/${encodeURIComponent(org)}/actions/secrets/${secret_name}`); return result({ status: response.status, secret_name }); } catch (error) { return failure(error); } });
}

/** Registers typed high-value tools and complete REST/GraphQL escape hatches. */
export function registerGitHubTools(server: McpServer, client: GitHubApiClient): void {
  registerSecretTools(server, client);
  server.registerTool("github_get_authenticated_user", {
    title: "Get authenticated GitHub user", description: "Returns the GitHub account represented by the configured PAT.",
    inputSchema: z.object({ response_format: ResponseFormat }).strict(), annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async ({ response_format }) => { try { return result(await client.request("GET", "/user"), response_format); } catch (e) { return failure(e); } });

  server.registerTool("github_rest_api_request", {
    title: "GitHub REST API request", description: "Calls any documented GitHub REST API endpoint permitted by the configured PAT. Use a relative path such as /repos/OWNER/REPO/releases. This is the complete REST API access tool; it never sends the PAT to another host.",
    inputSchema: z.object({ method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]), path: z.string().min(1), query: JsonObject.optional(), body: JsonValue.optional(), accept: z.string().optional(), response_format: ResponseFormat }).strict(),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
  }, async ({ method, path, query, body, accept, response_format }) => { try { return result(await client.request(method, path, { query, body, accept }), response_format); } catch (e) { return failure(e); } });

  server.registerTool("github_graphql", {
    title: "GitHub GraphQL API", description: "Executes any GitHub GraphQL query or mutation permitted by the configured PAT.",
    inputSchema: z.object({ query: z.string().min(1), variables: JsonObject.optional(), response_format: ResponseFormat }).strict(),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
  }, async ({ query, variables, response_format }) => { try { return result(await client.graphql(query, variables), response_format); } catch (e) { return failure(e); } });

  server.registerTool("github_create_release", {
    title: "Create GitHub release", description: "Creates a GitHub release. If tag_name does not already exist, GitHub creates a lightweight tag at target_commitish.",
    inputSchema: z.object({ owner: z.string().min(1), repo: z.string().min(1), tag_name: z.string().min(1), target_commitish: z.string().optional(), name: z.string().optional(), body: z.string().optional(), draft: z.boolean().optional(), prerelease: z.boolean().optional(), generate_release_notes: z.boolean().optional(), make_latest: z.enum(["true", "false", "legacy"]).optional() }).strict(),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  }, async ({ owner, repo, ...body }) => { try { return result(await client.request("POST", `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases`, { body })); } catch (e) { return failure(e); } });

  server.registerTool("github_create_git_ref", {
    title: "Create Git reference", description: "Creates a Git reference, including branches and lightweight tags. Use ref refs/tags/VERSION and a commit SHA to create a tag.",
    inputSchema: z.object({ owner: z.string().min(1), repo: z.string().min(1), ref: z.string().regex(/^refs\/(heads|tags)\//), sha: z.string().min(1) }).strict(),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  }, async ({ owner, repo, ref, sha }) => { try { return result(await client.request("POST", `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/refs`, { body: { ref, sha } })); } catch (e) { return failure(e); } });

  server.registerTool("github_upload_release_asset", {
    title: "Upload GitHub release asset", description: "Uploads a base64-encoded file to an existing GitHub release.",
    inputSchema: z.object({ owner: z.string().min(1), repo: z.string().min(1), release_id: z.number().int().positive(), name: z.string().min(1), content_base64: z.string().min(1), content_type: z.string().default("application/octet-stream"), label: z.string().optional() }).strict(),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  }, async ({ owner, repo, release_id, name, content_base64, content_type, label }) => { try { return result(await client.uploadReleaseAssetForRepository(owner, repo, release_id, name, Buffer.from(content_base64, "base64"), content_type, label)); } catch (e) { return failure(e); } });
}
