# @open-work-org/meta-graph-mcp-server

Universal Meta Graph API MCP server with one low-level tool: `meta_graph_api_request`.

## Install

```bash
npm install -g @open-work-org/meta-graph-mcp-server
```

Configure the MCP server with one environment variable:

```json
{
  "command": "meta-graph-mcp-server",
  "env": {
    "META_ACCESS_TOKEN": "your_meta_access_token"
  }
}
```

The server sends requests to the configured Graph API version, defaulting to `v21.0`. Override it with `META_GRAPH_API_VERSION` when required.

## Tool

`meta_graph_api_request` accepts `method`, `path`, `params`, and `body`. `GET` is read-only. `POST`, `PATCH`, and `DELETE` require `confirm_mutation: true`.

The token is injected by the server and cannot be supplied through request parameters. The tool supports JSON/form-style Graph API requests; multipart uploads, pagination, and asynchronous workflows may still need specialized handling.
