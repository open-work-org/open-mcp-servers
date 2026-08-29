# Open MCP Servers

Self-hosted [Model Context Protocol](https://modelcontextprotocol.io/) connectors for Meta and GitHub.

[![CI](https://github.com/open-work-org/open-mcp-servers/actions/workflows/ci.yml/badge.svg)](https://github.com/open-work-org/open-mcp-servers/actions/workflows/ci.yml)
[![Meta package](https://img.shields.io/npm/v/@open-work-org/meta-mcp-server?label=meta%20npm)](https://www.npmjs.com/package/@open-work-org/meta-mcp-server)
[![GitHub package](https://img.shields.io/npm/v/@open-work-org/github-mcp-server?label=github%20npm)](https://www.npmjs.com/package/@open-work-org/github-mcp-server)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

The repository is a small npm workspaces monorepo. Each connector is independently installable and owns its source, tests, package metadata, and documentation. Credentials stay in the environment of the server you run; they are not sent to a hosted Open MCP service.

## Contents

- [Connectors](#connectors)
- [Install a connector](#install-a-connector)
- [Run from source](#run-from-source)
- [Transport options](#transport-options)
- [Configuration and security](#configuration-and-security)
- [Documentation](#documentation)
- [Repository layout](#repository-layout)
- [Development](#development)
- [Releases](#releases)
- [License](#license)

## Connectors

| Connector | npm package | What it provides | Runtime notes |
| --- | --- | --- | --- |
| Meta | [`@open-work-org/meta-mcp-server`](https://www.npmjs.com/package/@open-work-org/meta-mcp-server) | 200 purpose-built tools for Facebook Pages, Instagram, Threads, Ads Manager, Commerce, Conversions API, audiences, insights, and charts | Stdio package; the root Docker image and Compose file expose this connector over Streamable HTTP |
| GitHub | [`@open-work-org/github-mcp-server`](https://www.npmjs.com/package/@open-work-org/github-mcp-server) | Local GitHub REST, GraphQL, release, tag, asset, and encrypted-secret tools | The npm command is native-only; the published container remains available for Streamable HTTP |

Tool availability is permission- and version-dependent. A PAT never grants more access than GitHub or Meta grants to that token.

### Meta

The Meta connector covers:

- Facebook Pages: publishing, comments, messaging, moderation, events, media, Stories, Reels, Live Video, webhooks, and automated responses.
- Instagram: publishing, scheduling, comments, DMs, broadcast channels, discovery, and insights.
- Ads Manager: campaigns, ad sets, ads, creatives, targeting, audiences, pixels, Conversions API, A/B tests, and Advantage+ operations.
- Threads, Commerce, and chart generation.

Start with the [Meta package README](packages/meta/README.md) and [Meta documentation index](packages/meta/docs/README.md).

### GitHub

The GitHub npm package provides one executable:

- `github-mcp-server` — native API-only mode. It exposes the local REST/GraphQL/release/tag/asset/secret tools without starting Docker.

The published container is the same native-only server exposed over Streamable HTTP and does not fetch or start an official upstream binary.

The local GitHub tools include `github_rest_api_request` and `github_graphql` escape hatches, so documented endpoints that do not yet have a dedicated tool can still be reached using the PAT. Native helpers cover releases, Git references, release assets, and encrypted Actions, Dependabot, Codespaces, and Agent secrets.

See the [GitHub package README](packages/github/README.md), [tool guide](packages/github/docs/tools.md), and [GitHub documentation index](packages/github/docs/README.md).

## Install a connector

Install only the package you need. Node.js 18 or newer is supported.

### Meta (stdio)

~~~bash
npm install -g @open-work-org/meta-mcp-server
~~~

Example MCP client configuration:

~~~json
{
  "mcpServers": {
    "meta": {
      "command": "meta-mcp-server",
      "env": {
        "META_ACCESS_TOKEN": "your_meta_token"
      }
    }
  }
}
~~~

Add `THREADS_ACCESS_TOKEN` when using Threads operations. Meta setup, permissions, token lifetimes, and API guides are documented in [packages/meta/docs](packages/meta/docs/README.md).

### GitHub (stdio, native API tools)

~~~bash
npm install -g @open-work-org/github-mcp-server
~~~

Example MCP client configuration:

~~~json
{
  "mcpServers": {
    "github": {
      "command": "github-mcp-server",
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "your_github_pat"
      }
    }
  }
}
~~~

The npm command uses the local native API tools and does not require Docker.

## Run from source

~~~bash
git clone https://github.com/open-work-org/open-mcp-servers.git
cd open-mcp-servers
npm ci
npm run build
~~~

Run Meta after building:

~~~bash
META_ACCESS_TOKEN="your_meta_token" npm start
~~~

Run the GitHub server after building:

~~~bash
GITHUB_PERSONAL_ACCESS_TOKEN="your_github_pat" \
  node packages/github/dist/index.js
~~~

The command above supports stdio by default. For Streamable HTTP, set `MCP_TRANSPORT=streamable-http`:

~~~bash
MCP_TRANSPORT=streamable-http \
GITHUB_PERSONAL_ACCESS_TOKEN="your_github_pat" \
  node packages/github/dist/index.js
~~~

Copy .env.example for a starting point, but keep the real file out of version control.

## Transport options

### Stdio

Stdio is the default and is the simplest option for a local MCP client. The client launches the executable and exchanges MCP messages over stdin/stdout. Diagnostics are written to stderr.

### Streamable HTTP

The Meta entrypoint can be hosted through the root Dockerfile or Compose configuration:

~~~bash
cp .env.example .env
# Set META_ACCESS_TOKEN and MCP_HTTP_AUTH_TOKEN in .env.
docker compose up -d --build
curl http://localhost:3000/healthz
~~~

The default Meta endpoint is http://127.0.0.1:3000/mcp.

The GitHub executable also supports Streamable HTTP:

~~~bash
MCP_TRANSPORT=streamable-http \
MCP_HTTP_HOST=127.0.0.1 \
GITHUB_MCP_HTTP_PORT=3001 \
MCP_HTTP_AUTH_TOKEN="choose-a-long-random-token" \
GITHUB_PERSONAL_ACCESS_TOKEN="your_github_pat" \
node packages/github/dist/index.js
~~~

The default GitHub endpoint is http://127.0.0.1:3001/github/mcp, with a health check at /healthz. For non-loopback hosting, configure MCP_HTTP_AUTH_TOKEN and put the service behind HTTPS. The HTTP bearer token is separate from the GitHub or Meta API token.

See the connector-specific [GitHub Streamable HTTP guide](packages/github/docs/streamable-http.md) and [Meta docs](packages/meta/docs/README.md) for all environment variables and client-specific examples.

## Configuration and security

### Credentials

| Connector | Required server variable | Optional variable |
| --- | --- | --- |
| Meta | `META_ACCESS_TOKEN` | `THREADS_ACCESS_TOKEN` |
| GitHub | `GITHUB_PERSONAL_ACCESS_TOKEN` | `GITHUB_API_URL`, `GITHUB_UPLOADS_URL` |
| HTTP | — | `MCP_TRANSPORT`, `MCP_HTTP_HOST`, `MCP_HTTP_PORT`, `MCP_HTTP_PATH`, `MCP_HTTP_AUTH_TOKEN`, `MCP_HTTP_ALLOWED_ORIGINS` |

Use a fine-grained GitHub PAT with only the repository, organization, and account permissions required by your workflows. Operations such as releases, tags, workflow dispatches, pull-request approvals, package publishing, and organization secrets still depend on the PAT, token type, SSO, organization policy, and the caller's GitHub role.

The connector:

- Reads credentials from the server environment (with an optional 1Password CLI fallback configured by the entrypoint).
- Does not accept a PAT as a tool argument.
- Does not elevate permissions or bypass third-party API policies.
- Validates GitHub REST paths as relative API paths and does not forward the PAT to arbitrary hosts.
- Encrypts supported GitHub secret values locally with LibSodium before sending them to GitHub; plaintext secret values are not included in API request bodies.

Never commit .env files, PATs, access tokens, secret values, private keys, or customer data. For HTTP deployments, store credentials in the host's secret manager and protect the endpoint with HTTPS and a separate bearer token.

## Documentation

| Area | Documentation |
| --- | --- |
| Repository documentation index | [docs/README.md](docs/README.md) |
| GitHub connector overview and setup | [packages/github/docs/README.md](packages/github/docs/README.md) |
| GitHub tool discovery and local catalog | [packages/github/docs/tools.md](packages/github/docs/tools.md) |
| GitHub encrypted secrets | [packages/github/docs/secrets.md](packages/github/docs/secrets.md) |
| GitHub architecture | [packages/github/docs/architecture.md](packages/github/docs/architecture.md) |
| GitHub release workflow | [packages/github/docs/release-workflows.md](packages/github/docs/release-workflows.md) |
| Meta connector overview and setup | [packages/meta/docs/README.md](packages/meta/docs/README.md) |
| Meta authentication | [packages/meta/docs/authentication/access-tokens.md](packages/meta/docs/authentication/access-tokens.md) |
| Meta API guides | [packages/meta/docs/README.md](packages/meta/docs/README.md) |

## Repository layout

~~~text
open-mcp-servers/
├── packages/
│   ├── meta/
│   │   ├── src/                  # Meta MCP implementation
│   │   ├── tests/
│   │   ├── docs/
│   │   ├── package.json
│   │   └── README.md
│   └── github/
│       ├── src/                  # Unified and API-only GitHub implementation
│       ├── tests/
│       ├── docs/
│       ├── package.json
│       └── README.md
├── .github/workflows/
│   ├── ci.yml                    # Tests and builds both packages
│   ├── release.yml               # Shared v-N release orchestration
│   ├── publish-npm.yml           # Reusable npm publishing job
│   └── publish-ghcr.yml          # Reusable Meta and GitHub image publishing jobs
├── Dockerfile                    # Meta Streamable HTTP image
├── Dockerfile.github             # GitHub Streamable HTTP image
├── docker-compose.yml            # Local Meta HTTP deployment
├── docs/                         # Documentation index
├── package.json                  # Workspace scripts and dependency lock
└── .env.example                  # Non-secret configuration template
~~~

## Development

Install dependencies and run the checks from the repository root:

~~~bash
npm ci
npm test
npm run build
~~~

Useful focused commands:

~~~bash
npm run build:meta
npm run build:github
npm run test:watch
npm run clean
~~~

Connector-specific changes belong under packages/<connector>/. Add or update a focused test with every behavior change, keep tool schemas strict, and document new configuration or permissions alongside the connector that owns them.

## Releases

The repository uses one sequential repository tag, such as v-1 or v-2, for a release event. Package versions remain independent:

- @open-work-org/meta-mcp-server is versioned in packages/meta/package.json.
- @open-work-org/github-mcp-server is versioned in packages/github/package.json.

Pushing a new v-N tag runs the release workflow. It tests and builds both packages, detects which connector paths changed, publishes only changed npm package versions, publishes the Meta image only when its runtime inputs changed, and creates one GitHub Release with a manifest of the artifacts. An unchanged package is not republished.

Before creating a release tag:

1. Bump the version of every changed package.
2. Run npm ci, npm test, and npm run build.
3. Push the release commit to main.
4. Create the next unused v-N tag on that commit.

Required repository configuration is documented in [GitHub release workflows](packages/github/docs/release-workflows.md). The npm publish job expects NPM_TOKEN; GitHub Actions uses its short-lived GITHUB_TOKEN for the GitHub Release and GHCR permissions declared in the workflow.

## License

This project is available under the [MIT License](LICENSE). Third-party APIs, tokens, quotas, and platform terms remain the responsibility of the operator.

Not affiliated with or endorsed by Meta Platforms, Inc. or GitHub, Inc.
