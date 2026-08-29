# GitHub connector architecture

## Source layout

```text
src/
├── services/
│   └── api.ts
├── tools/
│   └── github.ts
├── index.ts
├── http-server.ts
├── server-factory.ts
└── op-fallback.ts
```

## File responsibilities

- `index.ts` — executable entrypoint; loads the PAT and selects stdio or Streamable HTTP.
- `http-server.ts` — hosts the native server over HTTP with authentication and per-session lifecycle management.
- `server-factory.ts` — creates the native MCP server.
- `services/api.ts` — REST/GraphQL client, release uploads, path validation, and GitHub error handling.
- `tools/github.ts` — local tool schemas, handlers, release/tag tools, API escape hatches, and encrypted-secret operations.

## Request flow

```text
MCP client
  └── our McpServer
       └── native tool → GitHubApiClient → GitHub REST/GraphQL API
```

Both npm and Docker deployments use this same native request flow. Docker is only a packaging option for Streamable HTTP; it is not used to run another GitHub server.

## Adding a local GitHub tool

Add a strict Zod schema and handler in `tools/github.ts` or split a growing group into a new file under `tools/`. Use `GitHubApiClient` for requests, return the existing JSON/Markdown result shape, and add a focused test under `tests/`.
