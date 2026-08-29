# GitHub tools

## Viewing the complete tool list

MCP clients discover the native tools with the standard `tools/list` method. The returned list is registered by `../src/tools/github.ts` and is the same for stdio and Streamable HTTP deployments.

## Local tool catalog

### General API access

- `github_get_authenticated_user` — inspect the account represented by the PAT.
- `github_rest_api_request` — call any documented GitHub REST endpoint using a relative path.
- `github_graphql` — execute a GitHub GraphQL query or mutation.

### Releases and Git references

- `github_create_release` — create a release and, when needed, its tag.
- `github_create_git_ref` — create a branch or lightweight tag reference from a SHA.
- `github_upload_release_asset` — upload a base64-encoded asset to an existing release.

### Encrypted secrets

- `github_set_organization_secret`
- `github_set_repository_secret`
- `github_set_environment_secret`
- `github_set_dependabot_organization_secret`
- `github_set_dependabot_repository_secret`
- `github_set_codespaces_organization_secret`
- `github_set_codespaces_repository_secret`
- `github_set_codespaces_user_secret`
- `github_set_agent_organization_secret`
- `github_set_agent_repository_secret`
- `github_list_organization_secrets`
- `github_delete_organization_secret`

Secret values are encrypted locally before the GitHub request is sent. See [Encrypted secrets](secrets.md).

## REST escape-hatch examples

The REST tool is useful when GitHub has an endpoint that is not represented by a dedicated native tool. For example:

Create a workflow dispatch:

```json
{
  "method": "POST",
  "path": "/repos/OWNER/REPO/actions/workflows/WORKFLOW_ID/dispatches",
  "body": {
    "ref": "main",
    "inputs": {}
  },
  "response_format": "json"
}
```

Approve a pull request review:

```json
{
  "method": "POST",
  "path": "/repos/OWNER/REPO/pulls/PULL_NUMBER/reviews",
  "body": {
    "event": "APPROVE"
  },
  "response_format": "json"
}
```

The tool accepts only relative paths beginning with a single `/`; it does not forward the PAT to arbitrary hosts.

## Tool availability caveats

The REST escape hatch covers documented JSON-based GitHub REST endpoints permitted by the PAT. Package registry transfers, webhook delivery, OAuth flows, binary or multipart operations, and endpoints requiring a GitHub App may need a separate client or deployment component.
