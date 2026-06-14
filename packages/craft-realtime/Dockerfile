FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/craft-api/package.json ./packages/craft-api/
COPY packages/craft-realtime/package.json ./packages/craft-realtime/

RUN npm ci --workspace=@paytm-craft/api --workspace=@paytm-craft/realtime --include-workspace-root

COPY packages/craft-api ./packages/craft-api
COPY packages/craft-realtime ./packages/craft-realtime

WORKDIR /app/packages/craft-api
RUN npx prisma generate

ENV CRAFT_SYNC_PORT=4001
EXPOSE 4001

WORKDIR /app
CMD ["npm", "run", "start", "-w", "@paytm-craft/realtime"]
