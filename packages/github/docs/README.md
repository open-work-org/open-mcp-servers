# GitHub connector

The GitHub connector exposes native tools maintained in this repository over stdio or Streamable HTTP. It does not depend on or proxy the official GitHub MCP Server.

## Documentation

- [Overview](overview.md) — capabilities, modes, and requirements.
- [Configuration](configuration.md) — PATs, environment variables, local setup, and GitHub Enterprise Server.
- [Tools](tools.md) — the native tool catalog and REST/GraphQL escape hatches.
- [Streamable HTTP](streamable-http.md) — remote hosting, authentication, sessions, and client configuration.
- [Encrypted secrets](secrets.md) — Actions, Dependabot, Codespaces, and Agent secret operations.
- [Architecture](architecture.md) — source layout and runtime call flow.
- [Release and deployment](release-workflows.md) — current status and the planned GitHub-specific release lane.

## Quick start

From a source checkout:

```bash
npm ci
npm run build
GITHUB_PERSONAL_ACCESS_TOKEN="your_pat" node packages/github/dist/index.js
```

The installed `github-mcp-server` command runs the native process and does not require Docker. The same entrypoint supports Streamable HTTP when `MCP_TRANSPORT=streamable-http` is set.

Never commit a PAT or include it in a client request. The PAT belongs in the server environment and remains the permission boundary enforced by GitHub.
