# Next.js standalone image for remote-mode Craft (self-hosted web tier).
# Build from repo root:
#   docker build -f deploy/web/Dockerfile \
#     --build-arg NEXT_PUBLIC_PAYTM_CRAFT_API_URL=https://api.example.com/v1 \
#     --build-arg NEXT_PUBLIC_PAYTM_CRAFT_SYNC_URL=wss://sync.example.com/yjs \
#     --build-arg NEXT_PUBLIC_PAYTM_CRAFT_STORAGE_URL=https://cdn.example.com/craft-assets \
#     -t craft-web .

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_PAYTM_CRAFT_MODE=remote
ARG NEXT_PUBLIC_PAYTM_CRAFT_API_URL
ARG NEXT_PUBLIC_PAYTM_CRAFT_SYNC_URL
ARG NEXT_PUBLIC_PAYTM_CRAFT_STORAGE_URL

ENV NEXT_PUBLIC_PAYTM_CRAFT_MODE=$NEXT_PUBLIC_PAYTM_CRAFT_MODE
ENV NEXT_PUBLIC_PAYTM_CRAFT_API_URL=$NEXT_PUBLIC_PAYTM_CRAFT_API_URL
ENV NEXT_PUBLIC_PAYTM_CRAFT_SYNC_URL=$NEXT_PUBLIC_PAYTM_CRAFT_SYNC_URL
ENV NEXT_PUBLIC_PAYTM_CRAFT_STORAGE_URL=$NEXT_PUBLIC_PAYTM_CRAFT_STORAGE_URL
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
