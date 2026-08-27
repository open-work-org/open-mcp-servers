# GitHub connector overview

## What it provides

The unified connector exposes one MCP server containing:

1. Every tool returned by the configured official GitHub MCP Server image.
2. Local high-value tools for REST, GraphQL, releases, Git references, release assets, and encrypted secrets.

The upstream tool catalog is discovered at startup through MCP `tools/list`, including paginated responses. Official names and input schemas are preserved. The catalog therefore follows the pinned or selected upstream image rather than a hard-coded count.

## Runtime modes

| Executable | Transport | Tool surface | Docker required |
| --- | --- | --- | --- |
| `github-mcp-server` | stdio or Streamable HTTP | Official upstream tools + local tools | Yes |
| `github-full-api-mcp-server` | stdio | Local REST/GraphQL/release/secret tools | No |

The unified process starts the official server as a child process, connects to it over stdio, and proxies official calls through the local MCP server. Local tools call GitHub directly through the repository's API client.

## Requirements

- Node.js 18 or newer.
- A GitHub personal access token with the permissions required for the operations you intend to perform.
- Docker available to the host when using the unified executable.

Use a fine-grained PAT where GitHub supports the required operations. Some GitHub APIs and registry operations may require a classic PAT, a GitHub App, or an organization/enterprise role.

## Permission boundary

The connector does not elevate permissions. Every official and local API call uses the configured PAT, and GitHub evaluates that token against the token owner's role, token permissions, repository selection, organization policies, SSO, and endpoint requirements.

## GitHub Enterprise Server

Set `GITHUB_HOST` for the official upstream server. Set `GITHUB_API_URL` and `GITHUB_UPLOADS_URL` for the local REST client when using GitHub Enterprise Server.
