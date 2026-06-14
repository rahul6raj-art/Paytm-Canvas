FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/craft-api/package.json ./packages/craft-api/

RUN npm ci --workspace=@paytm-craft/api --include-workspace-root

COPY packages/craft-api ./packages/craft-api

WORKDIR /app/packages/craft-api
RUN npx prisma generate

ENV CRAFT_API_PORT=4000
EXPOSE 4000

CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]
