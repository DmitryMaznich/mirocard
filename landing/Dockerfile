FROM node:22-alpine

WORKDIR /app
COPY index.html og.png server.mjs ./

ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "server.mjs"]
