FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
COPY packages/meta/package.json packages/meta/package.json
COPY packages/github/package.json packages/github/package.json
RUN npm ci

COPY packages/meta/tsconfig.json packages/meta/tsconfig.json
COPY packages/meta/src packages/meta/src
RUN npm run build:meta
RUN npm prune --omit=dev

FROM node:20-alpine

WORKDIR /app
ENV NODE_ENV=production
ENV MCP_TRANSPORT=streamable-http
ENV MCP_HTTP_HOST=0.0.0.0
ENV MCP_HTTP_PORT=3000
ENV MCP_HTTP_PATH=/mcp

COPY --from=build --chown=node:node /app/packages/meta/package.json ./package.json
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/packages/meta/dist ./dist

USER node
EXPOSE 3000

CMD ["node", "dist/index.js"]
