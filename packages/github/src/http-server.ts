import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createUnifiedGitHubServer, type UnifiedGitHubServer } from "./unified.js";

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 3001;
const DEFAULT_PATH = "/github/mcp";
const MAX_BODY_BYTES = 1024 * 1024;

type Session = { transport: StreamableHTTPServerTransport; unified: UnifiedGitHubServer; close: () => Promise<void> };

function envNumber(name: string, fallback: number): number {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function normalizePath(value: string): string {
  const path = value.startsWith("/") ? value : `/${value}`;
  return path.length > 1 ? path.replace(/\/+$/, "") : path;
}

function isLoopback(host: string): boolean { return host === "127.0.0.1" || host === "localhost" || host === "::1"; }

function configuredOrigins(port: number): Set<string> {
  const configured = process.env.MCP_HTTP_ALLOWED_ORIGINS?.split(",").map((origin) => origin.trim()).filter(Boolean);
  return new Set(configured?.length ? configured : [`http://127.0.0.1:${port}`, `http://localhost:${port}`]);
}

function setCorsHeaders(res: ServerResponse, origin: string | undefined): void {
  if (!origin) return;
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, MCP-Protocol-Version, MCP-Session-Id, Last-Event-ID");
  res.setHeader("Access-Control-Expose-Headers", "MCP-Session-Id, MCP-Protocol-Version");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Vary", "Origin");
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  if (res.headersSent) return;
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function sendError(res: ServerResponse, status: number, message: string): void {
  sendJson(res, status, { jsonrpc: "2.0", error: { code: -32000, message }, id: null });
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_BODY_BYTES) throw new Error("Request body is too large");
    chunks.push(buffer);
  }
  const body = Buffer.concat(chunks).toString("utf8").trim();
  return body ? JSON.parse(body) : undefined;
}

function authorizationIsValid(req: IncomingMessage, expectedToken: string | undefined): boolean {
  if (!expectedToken) return true;
  return req.headers.authorization === `Bearer ${expectedToken}`;
}

async function createSession(token: string, sessions: Map<string, Session>): Promise<Session> {
  const unified = await createUnifiedGitHubServer(token);
  let session: Session;
  let closed = false;
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: (sessionId) => { sessions.set(sessionId, session); },
  });
  session = {
    transport,
    unified,
    close: async () => {
      if (closed) return;
      closed = true;
      await transport.close();
      await unified.close();
    },
  };
  transport.onclose = () => {
    if (transport.sessionId) sessions.delete(transport.sessionId);
    if (!closed) { closed = true; void unified.close(); }
  };
  transport.onerror = (error) => console.error("GitHub MCP HTTP transport error:", error);
  await unified.server.connect(transport);
  return session;
}

export async function startGitHubHttpServer(token: string): Promise<void> {
  if (!token) throw new Error("GITHUB_PERSONAL_ACCESS_TOKEN is required to start the GitHub connector.");
  const host = process.env.MCP_HTTP_HOST ?? DEFAULT_HOST;
  const port = envNumber("GITHUB_MCP_HTTP_PORT", 3001);
  const path = normalizePath(process.env.GITHUB_MCP_HTTP_PATH ?? DEFAULT_PATH);
  const authToken = process.env.MCP_HTTP_AUTH_TOKEN;
  const origins = configuredOrigins(port);
  const sessions = new Map<string, Session>();

  if (!isLoopback(host) && !authToken && process.env.MCP_HTTP_ALLOW_UNAUTHENTICATED !== "true") {
    throw new Error("Refusing to expose GitHub MCP HTTP without authentication. Set MCP_HTTP_AUTH_TOKEN, or explicitly set MCP_HTTP_ALLOW_UNAUTHENTICATED=true.");
  }

  const httpServer = createServer(async (req, res) => {
    const origin = typeof req.headers.origin === "string" ? req.headers.origin : undefined;
    setCorsHeaders(res, origin);
    if (req.method === "OPTIONS") {
      if (origin && !origins.has(origin)) { sendError(res, 403, "Origin is not allowed"); return; }
      res.statusCode = 204; res.end(); return;
    }
    if (req.url === "/healthz" && req.method === "GET") { sendJson(res, 200, { status: "ok", transport: "streamable-http", endpoint: path }); return; }
    if (req.url !== path) { sendError(res, 404, "Not found"); return; }
    if (origin && !origins.has(origin)) { sendError(res, 403, "Origin is not allowed"); return; }
    if (!authorizationIsValid(req, authToken)) { res.setHeader("WWW-Authenticate", "Bearer"); sendError(res, 401, "Missing or invalid bearer token"); return; }

    let body: unknown;
    if (req.method === "POST") {
      try { body = await readJsonBody(req); }
      catch (error) { sendError(res, 400, error instanceof SyntaxError ? "Request body must be valid JSON" : (error as Error).message); return; }
    }
    const sessionId = typeof req.headers["mcp-session-id"] === "string" ? req.headers["mcp-session-id"] : undefined;
    let session = sessionId ? sessions.get(sessionId) : undefined;
    if (!session && req.method === "POST" && isInitializeRequest(body)) {
      try { session = await createSession(token, sessions); }
      catch (error) { console.error("GitHub MCP HTTP initialization error:", error); sendError(res, 500, "GitHub MCP server failed to initialize"); return; }
    }
    if (!session) { sendError(res, sessionId ? 404 : 400, sessionId ? "Session not found" : "Missing MCP session ID"); return; }
    try { await session.transport.handleRequest(req, res, body); }
    catch (error) { console.error("GitHub MCP HTTP request error:", error); sendError(res, 500, "MCP request failed"); }
  });
  httpServer.on("error", (error) => console.error("GitHub MCP HTTP server error:", error));
  const shutdown = async (signal: string): Promise<void> => {
    console.error(`Received ${signal}; shutting down GitHub MCP HTTP server.`);
    await Promise.all([...sessions.values()].map((session) => session.close()));
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  };
  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
  await new Promise<void>((resolve, reject) => { httpServer.once("error", reject); httpServer.listen(port, host, () => resolve()); });
  console.error(`GitHub MCP server listening on http://${host}:${port}${path}`);
  console.error(`Health check: http://${host}:${port}/healthz`);
}
