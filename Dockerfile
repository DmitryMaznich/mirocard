FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY backend/package.json backend/package-lock.json backend/
RUN npm ci --prefix backend

COPY . .
RUN npm run build

ENV NODE_ENV=production
CMD ["node", "backend/server.mjs"]
