FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY backend/package.json backend/package-lock.json backend/
RUN npm ci --prefix backend

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3012
EXPOSE 3012
CMD ["node", "backend/server.mjs"]
