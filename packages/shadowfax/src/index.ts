#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getEnvironment } from "./constants.js";
import { ShadowfaxApiClient } from "./services/api.js";
import { createShadowfaxMcpServer } from "./server-factory.js";

const environment = getEnvironment(process.env.SHADOWFAX_ENV);
const server = createShadowfaxMcpServer(new ShadowfaxApiClient(process.env.SHADOWFAX_API_TOKEN ?? "", environment));
await server.connect(new StdioServerTransport());
