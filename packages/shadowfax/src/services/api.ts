import {
  API_BASE_URLS,
  REQUEST_TIMEOUT_MS,
  RESPONSE_BYTE_LIMIT,
  RESPONSE_CHARACTER_LIMIT,
  type ShadowfaxEnvironment,
} from "../constants.js";

export type ShadowfaxMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export type ShadowfaxFields = Record<string, unknown>;

function encodeField(value: unknown): string {
  if (value === null || value === undefined) return "";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

function serializeFields(fields: ShadowfaxFields): Record<string, string> {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, encodeField(value)]));
}

function rejectCredentials(fields: ShadowfaxFields, label: string): void {
  const credentialKey = Object.keys(fields).find((key) =>
    ["token", "authorization", "api_key", "apikey", "access_token"].includes(key.toLowerCase()),
  );
  if (credentialKey) {
    throw new Error(`${label} must not contain credentials; the server injects SHADOWFAX_API_TOKEN in the Authorization header.`);
  }
}

function validatePath(path: string): string {
  if (
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path.includes("..") ||
    path.includes("?") ||
    path.includes("#") ||
    /[\r\n]/.test(path) ||
    !/^\/v(?:1|3|4)\/clients\//.test(path)
  ) {
    throw new Error("path must be a Forward Logistics client API path like /v4/clients/orders/{awb}/track/. Put query values in params.");
  }
  return path;
}

function truncate(text: string): string {
  if (text.length <= RESPONSE_CHARACTER_LIMIT) return text;
  return `${text.slice(0, RESPONSE_CHARACTER_LIMIT)}\n\n[Response truncated at ${RESPONSE_CHARACTER_LIMIT} characters.]`;
}

function isBusinessFailure(contentType: string, body: string): boolean {
  if (!/json/i.test(contentType)) return false;
  try {
    const parsed: unknown = JSON.parse(body);
    return typeof parsed === "object" && parsed !== null && "message" in parsed && parsed.message === "Failure";
  } catch {
    return false;
  }
}

export class ShadowfaxApiClient {
  constructor(
    private readonly token: string,
    private readonly environment: ShadowfaxEnvironment,
  ) {}

  private requireToken(): void {
    if (!this.token.trim()) {
      throw new Error("SHADOWFAX_API_TOKEN is not configured. Add it to this MCP server's environment.");
    }
  }

  async request(
    method: ShadowfaxMethod,
    path: string,
    params: ShadowfaxFields = {},
    body: ShadowfaxFields = {},
  ): Promise<{ text: string; isBusinessFailure: boolean }> {
    this.requireToken();
    rejectCredentials(params, "params");
    rejectCredentials(body, "body");
    if (method === "GET" && Object.keys(body).length > 0) {
      throw new Error("GET requests cannot contain a body; use params instead.");
    }

    const baseUrl = API_BASE_URLS[this.environment];
    const url = new URL(`/api${validatePath(path)}`, baseUrl);
    if (url.origin !== new URL(baseUrl).origin || !/^\/api\/v(?:1|3|4)\/clients\//.test(url.pathname)) {
      throw new Error("Only the configured Shadowfax API host is allowed.");
    }
    for (const [key, value] of Object.entries(serializeFields(params))) url.searchParams.set(key, value);

    const headers: Record<string, string> = {
      Authorization: `Token ${this.token}`,
      Accept: "application/json, application/pdf, application/octet-stream;q=0.9, */*;q=0.8",
    };
    const init: RequestInit = {
      method,
      headers,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      redirect: "error",
    };

    if (method !== "GET" && method !== "DELETE") {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    } else if (method === "DELETE" && Object.keys(body).length > 0) {
      throw new Error("DELETE requests cannot contain a body; pass parameters in params.");
    }

    let response: Response;
    try {
      response = await fetch(url, init);
    } catch (error) {
      if (error instanceof Error && error.name === "TimeoutError") {
        throw new Error(`Shadowfax request timed out after ${REQUEST_TIMEOUT_MS / 1000} seconds.`);
      }
      throw new Error(error instanceof Error ? `Shadowfax request failed: ${error.message}` : "Shadowfax request failed.");
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    const contentType = response.headers.get("content-type") ?? "application/octet-stream";
    const truncated = bytes.length > RESPONSE_BYTE_LIMIT;
    const bodyBytes = truncated ? bytes.subarray(0, RESPONSE_BYTE_LIMIT) : bytes;
    let responseBody: string;
    if (/json|text|xml|javascript|urlencoded/i.test(contentType)) {
      responseBody = truncate(new TextDecoder().decode(bodyBytes));
      if (truncated) responseBody += `\n\n[Response bytes truncated at ${RESPONSE_BYTE_LIMIT}.]`;
    } else {
      responseBody = JSON.stringify({
        encoding: "base64",
        data: Buffer.from(bodyBytes).toString("base64"),
        ...(truncated ? { truncated: true, byteLimit: RESPONSE_BYTE_LIMIT } : {}),
      });
    }

    const text = `HTTP ${response.status} ${response.statusText}\nContent-Type: ${contentType}\n\n${responseBody}`;
    if (!response.ok) throw new Error(truncate(text));
    return { text: truncate(text), isBusinessFailure: isBusinessFailure(contentType, responseBody) };
  }
}
