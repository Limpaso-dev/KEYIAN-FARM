FROM node:24-alpine AS build

WORKDIR /app

COPY server/package.json server/package-lock.json ./
RUN npm ci

COPY server/prisma ./prisma
COPY server/prisma7.config.ts ./
RUN npx prisma generate

FROM node:24-alpine AS runtime

WORKDIR /app

COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY server/src ./src
COPY --from=build /app/generated/prisma ./generated/prisma

ENV NODE_ENV=production
EXPOSE 5000

CMD ["npm", "start"]
