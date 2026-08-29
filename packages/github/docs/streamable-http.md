# GitHub Streamable HTTP

## Start the server

```bash
MCP_TRANSPORT=streamable-http \
MCP_HTTP_HOST=127.0.0.1 \
GITHUB_MCP_HTTP_PORT=3001 \
MCP_HTTP_AUTH_TOKEN="choose-a-long-random-token" \
GITHUB_PERSONAL_ACCESS_TOKEN="your_github_pat" \
node packages/github/dist/index.js
```

The server exposes:

```text
MCP endpoint: http://127.0.0.1:3001/github/mcp
Health check: http://127.0.0.1:3001/healthz
```

The HTTP bearer token protects this MCP server. It is not the GitHub PAT. The PAT remains an environment variable on the server and is never sent by the MCP client.

## Remote deployment

Bind to `0.0.0.0` only behind HTTPS and with `MCP_HTTP_AUTH_TOKEN` configured:

```bash
MCP_TRANSPORT=streamable-http \
MCP_HTTP_HOST=0.0.0.0 \
MCP_HTTP_AUTH_TOKEN="choose-a-long-random-token" \
GITHUB_PERSONAL_ACCESS_TOKEN="your_github_pat" \
node packages/github/dist/index.js
```

The server refuses non-loopback unauthenticated exposure unless `MCP_HTTP_ALLOW_UNAUTHENTICATED=true` is explicitly set.

## Client configuration

The exact key varies by MCP client, but a typical remote configuration is:

```json
{
  "mcpServers": {
    "github-remote": {
      "url": "https://github-mcp.example.com/github/mcp",
      "headers": {
        "Authorization": "Bearer choose-a-long-random-token"
      }
    }
  }
}
```

## Sessions

The first initialize request creates an MCP session. The server returns a session ID, and subsequent requests use the `MCP-Session-Id` header. Each session creates a native GitHub MCP server and closes it when the session ends.

Clients should perform the normal MCP initialize handshake and then call `tools/list` to discover the native tools.
