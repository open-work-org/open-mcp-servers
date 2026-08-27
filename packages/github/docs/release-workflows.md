# GitHub release and deployment workflow

## Current status

The repository publishes two npm packages from the workspace: `@open-work-org/meta-mcp-server` and `@open-work-org/github-mcp-server`. A single sequential `v-N` repository tag (for example, `v-1` or `v-2`) drives `.github/workflows/release.yml`, which detects changed components, validates package version bumps, publishes changed artifacts, and creates or finalizes one GitHub Release.

The current root `Dockerfile` builds the Meta package and starts its entrypoint. Do not treat it as a GitHub image definition.

## Recommended release lanes

Keep the npm packages independently installable while using one repository release tag:

| Component | Tag pattern | npm package | Image |
| --- | --- | --- | --- |
| Meta | `v-2` | `@open-work-org/meta-mcp-server` | `ghcr.io/open-work-org/meta-mcp-server` |
| GitHub | `v-2` | `@open-work-org/github-mcp-server` | `ghcr.io/open-work-org/github-mcp-server` |

Image jobs can still use path detection to skip an unchanged connector.

## Implemented flow

1. Bump the version in every changed package and run `npm ci`, `npm run build`, and `npm test` locally.
2. Use the GitHub MCP connector to create only the next `v-N` tag (or push it from a protected release commit). Do not create a second release from MCP.
3. `release.yml` compares the tagged commit with the previous release tag and identifies Meta, GitHub, and Meta-image changes.
4. The validation job tests both packages and fails if a changed package did not increase its semver version.
5. The reusable npm workflow publishes only changed package versions that are not already on npm.
6. The reusable GHCR workflow publishes the Meta image only when its runtime inputs changed.
7. After those jobs succeed, Actions creates or finalizes one GitHub Release and attaches `release-manifest.json`.

Actions should use its short-lived `GITHUB_TOKEN` for the GitHub Release and GHCR publishing. The MCP PAT is only needed to create the tag or dispatch an operation. Bump the version in every package whose source or runtime dependencies changed; unchanged package versions are skipped.

## Container runtime caveat

The unified GitHub entrypoint currently starts the official GitHub MCP image through Docker. A standalone GitHub image therefore needs either a Docker-enabled host, a carefully controlled Docker socket, or a future direct-binary launch mode. A dedicated `Dockerfile.github` should be added only after choosing that runtime model.

Until then, publish the npm package or run the GitHub HTTP server on a host with Docker available.
