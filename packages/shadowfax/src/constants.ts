export const RESPONSE_CHARACTER_LIMIT = 80_000;
export const RESPONSE_BYTE_LIMIT = 2_000_000;
export const REQUEST_TIMEOUT_MS = 30_000;

export type ShadowfaxEnvironment = "staging" | "production";

export const API_BASE_URLS: Record<ShadowfaxEnvironment, string> = {
  staging: "https://dale.staging.shadowfax.in",
  production: "https://dale.shadowfax.in",
};

export function getEnvironment(value: string | undefined): ShadowfaxEnvironment {
  const environment = (value ?? "production").toLowerCase();
  if (environment === "staging" || environment === "production") return environment;
  throw new Error('SHADOWFAX_ENV must be either "staging" or "production".');
}
