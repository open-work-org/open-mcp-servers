# @open-work-org/github-mcp-server

Self-hosted GitHub MCP connector exposing PAT-authorized REST, GraphQL, release, tag, asset, and encrypted-secret tools.

## Install

```bash
npm install -g @open-work-org/github-mcp-server
```

The package provides one native-only executable:

- `github-mcp-server` — local REST, GraphQL, release, tag, asset, and encrypted-secret tools. It does not start Docker or require the official upstream binary.

## Container deployment

Use the published image for Streamable HTTP deployments:

```bash
docker run --rm -p 3001:3001 \
  -e GITHUB_PERSONAL_ACCESS_TOKEN=github_pat_... \
  -e MCP_HTTP_AUTH_TOKEN=choose-a-long-random-token \
  ghcr.io/open-work-org/github-mcp-server:latest
```

The MCP endpoint is `http://HOST:3001/github/mcp` and the health check is `http://HOST:3001/healthz`. Send `Authorization: Bearer <MCP_HTTP_AUTH_TOKEN>` when connecting. The published image is the same native-only server exposed over Streamable HTTP; it does not fetch or run the official GitHub MCP binary.

Configure `GITHUB_PERSONAL_ACCESS_TOKEN` in the MCP server environment. The PAT is never supplied by the MCP client in a tool request.

## Documentation

See [`docs/README.md`](docs/README.md) for configuration, tool discovery, Streamable HTTP, encrypted secrets, architecture, and release workflows.
