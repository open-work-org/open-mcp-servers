# @open-work-org/github-mcp-server

Self-hosted GitHub MCP connector combining the official GitHub MCP Server with PAT-authorized REST, GraphQL, release, tag, asset, and encrypted-secret tools.

## Install

```bash
npm install -g @open-work-org/github-mcp-server
```

The package provides two executables:

- `github-mcp-server` — unified official-upstream plus local tools. Docker must be available because the official server runs as a child process.
- `github-full-api-mcp-server` — local REST/GraphQL/release/secret tools without Docker.

Configure `GITHUB_PERSONAL_ACCESS_TOKEN` in the MCP server environment. The PAT is never supplied by the MCP client in a tool request.

## Documentation

See [`docs/README.md`](docs/README.md) for configuration, tool discovery, Streamable HTTP, encrypted secrets, architecture, and release workflows.
