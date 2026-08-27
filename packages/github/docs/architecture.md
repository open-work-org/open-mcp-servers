# GitHub connector architecture

## Source layout

```text
src/
├── services/
│   └── api.ts
├── tools/
│   └── github.ts
├── index.ts
├── unified.ts
├── http-server.ts
├── server-factory.ts
├── full-api-index.ts
└── op-fallback.ts
```

## File responsibilities

- `index.ts` — executable entrypoint; loads the PAT and selects stdio or Streamable HTTP.
- `unified.ts` — starts the official upstream server, discovers its tools, converts schemas, and proxies calls.
- `http-server.ts` — hosts the unified server over HTTP with authentication and per-session lifecycle management.
- `server-factory.ts` — creates the local API-only MCP server.
- `full-api-index.ts` — starts the API-only server over stdio.
- `services/api.ts` — REST/GraphQL client, release uploads, path validation, and GitHub error handling.
- `tools/github.ts` — local tool schemas, handlers, release/tag tools, API escape hatches, and encrypted-secret operations.

## Unified request flow

```text
MCP client
  └── our McpServer
       ├── local tool → GitHubApiClient → GitHub API
       └── upstream tool → MCP Client → official GitHub MCP process
```

The official server is not compiled into this repository. It runs as a separate process and communicates using MCP over stdio. This keeps upstream tool updates independent from local tool implementations.

## API-only request flow

```text
MCP client
  └── server-factory.ts
       └── tools/github.ts
            └── services/api.ts
                 └── GitHub REST/GraphQL API
```

Use this path for tests or environments that cannot run Docker.

## Adding a local GitHub tool

Add a strict Zod schema and handler in `tools/github.ts` or split a growing group into a new file under `tools/`. Use `GitHubApiClient` for requests, return the existing JSON/Markdown result shape, and add a focused test under `tests/`.
