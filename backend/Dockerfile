FROM node:24-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npx prisma generate && npm run build

FROM build AS migrate
USER node
CMD ["npx","prisma","migrate","deploy"]

FROM node:24-bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --omit=optional --no-audit --no-fund \
    && test ! -d node_modules/prisma \
    && test ! -d node_modules/@prisma/config
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/dist ./dist
RUN mkdir -p /app/uploads && chown node:node /app/uploads
ENV NODE_ENV=production API_HOST=0.0.0.0
USER node
EXPOSE 3001
CMD ["node","dist/src/main.js"]
