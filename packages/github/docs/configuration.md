# GitHub connector configuration

## Environment variables

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `GITHUB_PERSONAL_ACCESS_TOKEN` | Yes | — | PAT used by the native GitHub tools. |
| `GITHUB_API_URL` | No | `https://api.github.com` | REST/GraphQL API base used by the native tools. |
| `GITHUB_UPLOADS_URL` | No | `https://uploads.github.com` | Release-asset upload base used by the native tools. |
| `MCP_TRANSPORT` | No | `stdio` | Set to `streamable-http` for the HTTP server. |
| `GITHUB_MCP_HTTP_PORT` | No | `3001` | GitHub HTTP listener port. |
| `GITHUB_MCP_HTTP_PATH` | No | `/github/mcp` | GitHub MCP endpoint path. |
| `MCP_HTTP_HOST` | No | `127.0.0.1` | HTTP bind address. |
| `MCP_HTTP_AUTH_TOKEN` | Required for non-loopback HTTP | — | Bearer token protecting the MCP endpoint. This is separate from the GitHub PAT. |
| `MCP_HTTP_ALLOWED_ORIGINS` | No | Localhost origins | Comma-separated browser origins allowed by CORS. |
| `MCP_HTTP_ALLOW_UNAUTHENTICATED` | No | `false` | Explicitly disables the non-loopback authentication guard; avoid this for production. |

## Build from source

```bash
git clone https://github.com/open-work-org/open-mcp-servers.git
cd open-mcp-servers
npm ci
npm run build
```

To install the published GitHub package:

```bash
npm install -g @open-work-org/github-mcp-server
```

## Stdio client configuration

After installing the package, configure the `github-mcp-server` binary:

```json
{
  "mcpServers": {
    "github": {
      "command": "github-mcp-server",
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "your_pat"
      }
    }
  }
}
```

The client sends MCP requests over stdin/stdout. Diagnostic messages are written to stderr so they do not corrupt the MCP protocol.

The npm `github-mcp-server` executable is the native API-only process. It does not include dynamically discovered official upstream tools and does not require Docker.

## Token handling

The server can optionally resolve a missing token through the 1Password CLI reference configured in the entrypoint. Keep tokens in environment variables or a secret manager, rotate them regularly, and never commit `.env` files.
