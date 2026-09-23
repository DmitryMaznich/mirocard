FROM node:22-slim

WORKDIR /app

# Release identity. Railway passes its provided variables into a Dockerfile
# build only when they are declared as ARG; RAILWAY_GIT_COMMIT_SHA is the
# commit being deployed. GIT_SHA is for manual/CI builds:
#   docker build --build-arg GIT_SHA=$(git rev-parse HEAD) .
# The build fails without a SHA (REQUIRE_GIT_SHA=1) so an image that can't
# say which commit it is never ships. See scripts/build-info.mjs.
ARG RAILWAY_GIT_COMMIT_SHA
ARG GIT_SHA
ARG REQUIRE_GIT_SHA=1

COPY package.json package-lock.json ./
RUN npm ci

COPY backend/package.json backend/package-lock.json backend/
RUN npm ci --prefix backend

COPY . .
RUN if [ "$REQUIRE_GIT_SHA" = "1" ]; then node scripts/build-info.mjs --write --require-sha; else node scripts/build-info.mjs --write; fi
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3012
EXPOSE 3012
CMD ["node", "backend/server.mjs"]
