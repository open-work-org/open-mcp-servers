# GitHub connector overview

## What it provides

The connector exposes one native MCP server containing local tools for REST, GraphQL, releases, Git references, release assets, and encrypted secrets.

## Runtime modes

| Executable | Transport | Tool surface | Docker required |
| --- | --- | --- | --- |
| `github-mcp-server` (npm) | stdio | Local REST/GraphQL/release/secret tools | No |
| `ghcr.io/open-work-org/github-mcp-server` | Streamable HTTP | Local REST/GraphQL/release/secret tools | Docker to run the image |

Both entrypoints start the same native server. Local tools call GitHub directly through the repository's API client; no upstream process or binary is downloaded or started.

## Requirements

- Node.js 18 or newer.
- A GitHub personal access token with the permissions required for the operations you intend to perform.
- Docker is not required for the npm executable. Docker is only needed when choosing to run the published container image.

Use a fine-grained PAT where GitHub supports the required operations. Some GitHub APIs and registry operations may require a classic PAT, a GitHub App, or an organization/enterprise role.

## Permission boundary

The connector does not elevate permissions. Every API call uses the configured PAT, and GitHub evaluates that token against the token owner's role, token permissions, repository selection, organization policies, SSO, and endpoint requirements.

## GitHub Enterprise Server

Set `GITHUB_API_URL` and `GITHUB_UPLOADS_URL` when using GitHub Enterprise Server.
