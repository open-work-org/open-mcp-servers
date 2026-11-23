# @open-work-org/shadowfax-mcp-server

Local stdio MCP server for the Shadowfax Forward Logistics API.

## Configure

Get an API token from the Shadowfax SFX 360 Partner Portal. Staging and production use separate credentials.

```json
{
  "mcpServers": {
    "shadowfax": {
      "command": "npx",
      "args": ["-y", "@open-work-org/shadowfax-mcp-server"],
      "env": {
        "SHADOWFAX_API_TOKEN": "your_shadowfax_token",
        "SHADOWFAX_ENV": "production"
      }
    }
  }
}
```

`SHADOWFAX_ENV` defaults to `production`. Set it to `staging` with the matching staging token. Staging uses `https://dale.staging.shadowfax.in/api`; production uses `https://dale.shadowfax.in/api`.

The package runs locally over stdio and does not start an HTTP listener. It uses Shadowfax Token authentication. The token is added to the Authorization header and cannot be supplied through tool arguments.

## Tool

`shadowfax_fwd` sends a request to the configured Shadowfax Forward Logistics API host. Provide the HTTP `method`, API `path`, optional query `params`, and optional JSON `body`. Paths are limited to `/v1/clients/`, `/v3/clients/`, and `/v4/clients/` routes; caller-supplied hosts, credentials, query strings inside the path, and fragments are rejected.

GET requests are read-only. POST, PUT, PATCH, and DELETE require `confirm_mutation: true`. This includes POST endpoints that only read data, such as bulk tracking, because the tool requires confirmation for every non-GET method.

Shadowfax may respond with HTTP 200 and `message: "Failure"` when an order is rejected or its payload fails validation. The tool marks that response as an error and includes the response body so the caller can inspect the reason.

Example: check delivery serviceability:

```json
{
  "method": "GET",
  "path": "/v1/clients/serviceability/",
  "params": {
    "service": "marketplace",
    "pincodes": "560034"
  }
}
```

Example: track an order:

```json
{
  "method": "GET",
  "path": "/v4/clients/orders/SF1234567890/track/"
}
```

Example: place a forward order (write request):

```json
{
  "method": "POST",
  "path": "/v3/clients/orders/",
  "confirm_mutation": true,
  "body": {
    "customer_details": {
      "name": "Rahul Sharma",
      "contact": "9876543210",
      "address_line_1": "42 MG Road, Koramangala",
      "city": "BANGALORE",
      "pincode": 560034,
      "state": "Karnataka"
    },
    "order_details": {
      "client_order_id": "FWD-TEST-001",
      "product_value": 1299,
      "payment_mode": "prepaid",
      "cod_amount": 0,
      "order_service": "Regular"
    },
    "pickup_details": {
      "pickup_type": "seller",
      "name": "TechStore Pvt Ltd",
      "contact": "9876543211",
      "address_line_1": "15 Industrial Area Phase 2",
      "city": "BANGALORE",
      "pincode": 560058
    },
    "return_details": {
      "return_type": "seller",
      "name": "TechStore Pvt Ltd",
      "contact": "9876543211",
      "address_line_1": "15 Industrial Area Phase 2",
      "city": "BANGALORE",
      "pincode": 560058
    },
    "product_details": [
      {
        "sku_name": "Wireless Bluetooth Headphones",
        "sku_id": "SKU-HEADPHONE-001",
        "price": 1299,
        "category": "Electronics",
        "hsn_code": "85183000",
        "invoice_no": "INV-2026-001"
      }
    ]
  }
}
```

See the [Shadowfax Forward Logistics API documentation](https://developer.shadowfax.in/docs/api/forward-logistics) for required fields and endpoint-specific request formats. The tool returns binary responses, such as PDF labels, as base64 JSON.

## Build from this repository

```bash
npm run build:shadowfax
npm run start:shadowfax
```
