function withoutTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

export const GRAPH_API_VERSION = process.env.META_GRAPH_API_VERSION ?? "v21.0";
export const GRAPH_API_BASE_URL = withoutTrailingSlash(
  process.env.META_GRAPH_API_BASE_URL ?? "https://graph.facebook.com",
);
export const GRAPH_API_BASE = `${GRAPH_API_BASE_URL}/${GRAPH_API_VERSION}`;
export const CHARACTER_LIMIT = 25_000;
