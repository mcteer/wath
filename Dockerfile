# Wath core — thin orchestrator container (engine + HTTP MCP/REST API)
#
# Build:  podman build -t wath-core:local .
# Run:    see deploy/podman-compose.yml or docs/onboarding/deploy-podman.md

FROM node:22-alpine AS build

WORKDIR /app

# Workspace install (engine + mcp-server only)
COPY package.json package-lock.json ./
COPY packages/engine/package.json packages/engine/
COPY packages/mcp-server/package.json packages/mcp-server/

RUN npm ci --workspace=@wath/engine --workspace=@wath/mcp-server

COPY packages/engine packages/engine
COPY packages/mcp-server packages/mcp-server
COPY standards standards
COPY state state
COPY templates templates
COPY examples examples
COPY scripts/poll-merge-prs.sh scripts/poll-merge-prs.sh

RUN npm run build --workspace=@wath/engine --workspace=@wath/mcp-server

# --- Runtime ---
FROM node:22-alpine AS runtime

RUN apk add --no-cache tini

WORKDIR /app

ENV NODE_ENV=production \
    WATH_ROOT=/app \
    PORT=8080 \
    WATH_HOST=0.0.0.0

# Production deps only
COPY package.json package-lock.json ./
COPY packages/engine/package.json packages/engine/
COPY packages/mcp-server/package.json packages/mcp-server/

RUN npm ci --omit=dev --workspace=@wath/engine --workspace=@wath/mcp-server

COPY --from=build /app/packages/engine/dist packages/engine/dist
COPY --from=build /app/packages/mcp-server/dist packages/mcp-server/dist
COPY standards standards
COPY state state
COPY templates templates
COPY examples examples
COPY scripts/poll-merge-prs.sh scripts/poll-merge-prs.sh

RUN chmod +x scripts/poll-merge-prs.sh \
  && mkdir -p state/applications \
  && chown -R node:node /app

USER node

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "packages/mcp-server/dist/http.js"]
