FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV BUILD_STANDALONE=1 NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=3100 HOSTNAME=0.0.0.0 UPLOAD_DIR=/data/uploads NEXT_TELEMETRY_DISABLED=1
# App server
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
# Migrations + seed tooling (run via `docker compose run app npm run db:setup`)
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json /app/drizzle.config.ts ./
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/src ./src
RUN mkdir -p /data/uploads
EXPOSE 3100
CMD ["node", "server.js"]
