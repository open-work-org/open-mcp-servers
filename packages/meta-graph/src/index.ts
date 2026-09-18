#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { GraphApiClient } from "./services/api.js";
import { createMetaGraphMcpServer } from "./server-factory.js";

const server = createMetaGraphMcpServer(new GraphApiClient(process.env.META_ACCESS_TOKEN ?? ""));
await server.connect(new StdioServerTransport());
