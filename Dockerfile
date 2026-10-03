# ---- build the React client
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci
COPY client client
RUN npm run build

# ---- runtime: API + WebSocket server, also serving the built client
FROM node:22-alpine
ENV NODE_ENV=production PORT=4000 DB_PATH=/data/union.db
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci --omit=dev --workspace server && npm cache clean --force
COPY server server
COPY --from=build /app/client/dist client/dist
VOLUME /data
EXPOSE 4000
USER node
CMD ["node", "--disable-warning=ExperimentalWarning", "server/src/index.js"]
