# GitHub encrypted secrets

GitHub does not accept plaintext secret values through the Actions, Dependabot, Codespaces, or Agent secret APIs. The connector performs the required client-side encryption.

## Supported native tools

| GitHub area | Organization | Repository | Environment | User |
| --- | --- | --- | --- | --- |
| Actions | Yes | Yes | Yes | — |
| Dependabot | Yes | Yes | — | — |
| Codespaces | Yes | Yes | — | Yes |
| Agent | Yes | Yes | — | — |

Organization Actions secret listing and deletion are also available.

## Encryption flow

For a write operation, `tools/github.ts`:

1. Gets the target's public key from GitHub.
2. Uses `libsodium-wrappers` sealed-box encryption locally.
3. Sends only `encrypted_value` and `key_id` to GitHub.
4. Returns the HTTP result and secret name, never the plaintext value.

## Organization secret inputs

Organization-level tools accept:

- `org`
- `secret_name` — uppercase letters, numbers, and underscores only.
- `value`
- `visibility` — `all`, `private`, or `selected`.
- `selected_repository_ids` — required when visibility is `selected`.

Repository and environment tools additionally require the owner/repository (and environment name where applicable).

## Security guidance

- Do not place secret values in logs, issue comments, prompts, or release notes.
- Use a PAT with only the required organization/repository permissions.
- Organization policies, SSO, and user roles still control whether GitHub accepts the request.
- Listing secrets returns names and metadata, not values.
