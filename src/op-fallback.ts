import { execFileSync } from "node:child_process";

/**
 * If the given env var is empty, attempt to resolve it from 1Password CLI.
 * Sets process.env[envVar] on success so downstream code can read it normally.
 */
export function resolveApiKey(envVar: string, opRef: string): void {
  // CI and hosted runners should rely on injected environment variables rather
  // than attempting to contact a local developer's 1Password CLI.
  if (process.env[envVar] || process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true") {
    return;
  }
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
