import { execFileSync } from "node:child_process";

/**
 * If the given env var is not set, attempt to resolve it from 1Password CLI.
 * Sets process.env[envVar] on success so downstream code can read it normally.
 */
export function resolveApiKey(envVar: string, opRef: string): void {
  // An explicitly empty value is useful for tests and deployments that want to
  // force the connector into its helpful unauthenticated error path. Only use
  // the 1Password fallback when the variable is absent entirely.
  if (process.env[envVar] !== undefined) return;
  try {
    const value = execFileSync("op", ["read", opRef], {
      encoding: "utf-8",
      timeout: 10000,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    if (value) process.env[envVar] = value;
  } catch {
    // 1Password CLI unavailable or item not found
  }
}
