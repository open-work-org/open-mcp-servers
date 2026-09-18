import axios, { AxiosError, type AxiosRequestConfig } from "axios";
import { GRAPH_API_BASE } from "../constants.js";

export type GraphApiMethod = "GET" | "POST" | "PATCH" | "DELETE";
export type GraphApiFields = Record<string, unknown>;

function serializeValue(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function serializeFields(fields: GraphApiFields): Record<string, string> {
  const serialized: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields)) {
    const encoded = serializeValue(value);
    if (encoded !== undefined) serialized[key] = encoded;
  }
  return serialized;
}

function rejectAccessToken(fields: GraphApiFields, label: string): void {
  const tokenKey = Object.keys(fields).find((key) => key.toLowerCase() === "access_token");
  if (tokenKey) {
    throw new Error(`${label} must not contain access_token; the server uses META_ACCESS_TOKEN.`);
  }
}

export class GraphApiClient {
  constructor(private readonly accessToken: string) {}

  requireAccessToken(): void {
    if (!this.accessToken) {
      throw new Error(
        "META_ACCESS_TOKEN is not configured. Add it to this MCP server's environment.",
      );
    }
  }

  private validatePath(path: string): string {
    if (
      !path.startsWith("/") ||
      path.startsWith("//") ||
      path.includes("..") ||
      path.includes("?") ||
      path.includes("#") ||
      /[\r\n]/.test(path)
    ) {
      throw new Error("path must be a relative Graph API path beginning with a single '/'. Put query values in params.");
    }
    return path;
  }

  async request<T>(
    method: GraphApiMethod,
    path: string,
    params: GraphApiFields = {},
    body: GraphApiFields = {},
  ): Promise<T> {
    this.requireAccessToken();
    rejectAccessToken(params, "params");
    rejectAccessToken(body, "body");

    const config: AxiosRequestConfig = {
      method,
      url: `${GRAPH_API_BASE}${this.validatePath(path)}`,
      params: {
        access_token: this.accessToken,
        ...serializeFields(params),
      },
      timeout: 30_000,
    };

    if (method !== "GET") {
      const form = new URLSearchParams(serializeFields(body));
      config.data = form;
      config.headers = { "Content-Type": "application/x-www-form-urlencoded" };
    } else if (Object.keys(body).length > 0) {
      throw new Error("GET requests cannot contain body fields; use params instead.");
    }

    const response = await axios.request<T>(config);
    return response.data;
  }
}

export function graphApiErrorMessage(error: unknown): string {
  if (error instanceof AxiosError && error.response) {
    const data = error.response.data as { error?: Record<string, unknown> } | undefined;
    const metaError = data?.error;
    if (metaError) {
      const code = metaError.code;
      const subcode = metaError.error_subcode;
      const message = metaError.message ?? metaError.error_user_msg ?? "Meta Graph API request failed";
      return `Error (${code ?? error.response.status}${subcode ? `/${subcode}` : ""}): ${message}`;
    }
    return `Error: Meta Graph API request failed with status ${error.response.status}.`;
  }
  if (error instanceof Error) return `Error: ${error.message}`;
  return "Error: Unexpected Meta Graph API error.";
}
