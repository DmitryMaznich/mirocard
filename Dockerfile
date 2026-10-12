# Two stages so a deploy pushes only what the server needs (dist + backend),
# not the sources, the build tooling and a second copy of public/ — the old
# single-stage image was ~1.9 GB and almost all of it was re-pushed on every
# deploy. Build-stage layers are never pushed, so a version bump changing
# package-lock.json no longer re-uploads node_modules either.

FROM node:22-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY backend/package.json backend/package-lock.json backend/
RUN npm ci --prefix backend --omit=dev

COPY . .
# No .git in the build context (see .dockerignore): scripts/git-sha.mjs falls
# back to this Railway-provided build arg for the SHA baked into the frontend.
ARG RAILWAY_GIT_COMMIT_SHA
ENV RAILWAY_GIT_COMMIT_SHA=$RAILWAY_GIT_COMMIT_SHA
RUN npm run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3012

# Runtime needs: package.json (/api/version), backend (+ its node_modules,
# generated/, legal/, materials/), scripts/ (git-sha, backup and reminder
# loops imported by the server), src/ (backend imports src/shared/utils),
# and the built frontend in dist/. Big, rarely-changing parts first.
COPY --from=build /app/backend/node_modules backend/node_modules
COPY --from=build /app/dist dist
COPY --from=build /app/package.json ./
COPY --from=build /app/scripts scripts
COPY --from=build /app/src src
COPY --from=build /app/backend backend

EXPOSE 3012
CMD ["node", "backend/server.mjs"]
