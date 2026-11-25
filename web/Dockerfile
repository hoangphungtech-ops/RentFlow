FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY . .
ARG RENTFLOW_API_ORIGIN=http://127.0.0.1:3001
ENV NEXT_TELEMETRY_DISABLED=1 RENTFLOW_API_ORIGIN=${RENTFLOW_API_ORIGIN}
RUN npm run build
FROM node:24-bookworm-slim AS runtime
WORKDIR /app
COPY --chown=node:node --from=build /app/.next/standalone ./
COPY --chown=node:node --from=build /app/.next/static ./.next/static
COPY --chown=node:node --from=build /app/public ./public
RUN mkdir -p .next/cache && chown node:node .next/cache
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000
USER node
EXPOSE 3000
CMD ["node","server.js"]
