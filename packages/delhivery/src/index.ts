#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getEnvironment } from "./constants.js";
import { DelhiveryApiClient } from "./services/api.js";
import { createDelhiveryMcpServer } from "./server-factory.js";

const environment = getEnvironment(process.env.DELHIVERY_ENV);
const server = createDelhiveryMcpServer(new DelhiveryApiClient(process.env.DELHIVERY_API_TOKEN ?? "", environment));
await server.connect(new StdioServerTransport());
