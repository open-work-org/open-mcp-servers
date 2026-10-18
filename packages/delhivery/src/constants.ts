export const RESPONSE_CHARACTER_LIMIT = 80_000;
export const RESPONSE_BYTE_LIMIT = 2_000_000;
export const REQUEST_TIMEOUT_MS = 30_000;

export type DelhiveryEnvironment = "staging" | "production";

export const API_BASE_URLS: Record<DelhiveryEnvironment, string> = {
  staging: "https://staging-express.delhivery.com",
  production: "https://track.delhivery.com",
};

export function getEnvironment(value: string | undefined): DelhiveryEnvironment {
  const environment = (value ?? "staging").toLowerCase();
  if (environment === "staging" || environment === "production") return environment;
  throw new Error('DELHIVERY_ENV must be either "staging" or "production".');
}
