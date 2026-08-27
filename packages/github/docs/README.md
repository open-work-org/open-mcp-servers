# GitHub connector

The GitHub connector combines GitHub's [official MCP Server](https://github.com/github/github-mcp-server) with local tools maintained in this repository.

## Documentation

- [Overview](overview.md) — capabilities, modes, and requirements.
- [Configuration](configuration.md) — PATs, environment variables, local setup, and GitHub Enterprise Server.
- [Tools](tools.md) — how the combined tool list works and the local tool catalog.
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

The default executable uses stdio and starts the official GitHub MCP server through Docker. For a Docker-free API-only process, use:

```bash
GITHUB_PERSONAL_ACCESS_TOKEN="your_pat" node packages/github/dist/full-api-index.js
```

Never commit a PAT or include it in a client request. The PAT belongs in the server environment and remains the permission boundary enforced by GitHub.
