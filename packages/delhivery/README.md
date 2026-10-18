# @open-work-org/delhivery-mcp-server

Local stdio MCP server for the Delhivery One B2C APIs. It exposes one bounded request tool that can call the documented B2C endpoints while keeping the API token in the local MCP process environment.

## Configure

The server uses staging by default. Set the Delhivery token in your MCP client configuration:

```json
{
  "mcpServers": {
    "delhivery": {
      "command": "delhivery-mcp-server",
      "env": {
        "DELHIVERY_API_TOKEN": "your_delhivery_token",
        "DELHIVERY_ENV": "staging"
      }
    }
  }
}
```

Set `DELHIVERY_ENV` to `production` only with the matching production token. The server maps `staging` to `https://staging-express.delhivery.com` and `production` to `https://track.delhivery.com`. It does not start an HTTP listener; MCP messages use stdin/stdout, and diagnostic output is not written to stdout.

Install with `npm install -g @open-work-org/delhivery-mcp-server`, or run the package from this repository with `npm run build:delhivery` and `npm run start:delhivery`.

## Tool

`delhivery_b2c_api_request` accepts an official Delhivery API `path`, `method`, query `params`, and optional `body`. Use `body_format: "form"` for endpoints documented as `application/x-www-form-urlencoded`; this supports the manifestation payload shape `format=json&data=<JSON>`. Every non-GET call requires `confirm_mutation: true`. The server rejects caller-supplied credentials and arbitrary hosts, and caps returned data.

The tool does not validate endpoint-specific payloads. Check the [Delhivery B2C API documentation](https://one.delhivery.com/developer-portal/documents/b2c/) for endpoint paths and required fields. Some documentation is account-gated and can differ by client and environment.

## Example calls

Shipment tracking (confirm the currently supported fields in your account's docs):

```json
{
  "method": "GET",
  "path": "/api/v1/packages/json/",
  "params": { "waybill": "1122345678722" }
}
```

Shipment manifestation uses a write method and must be explicitly confirmed. Its body commonly uses form encoding with a `format` field and a JSON `data` field, as described in Delhivery's FAQ.
