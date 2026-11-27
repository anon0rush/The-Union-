FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci
COPY frontend frontend
RUN npm run build

FROM node:22-alpine
ENV NODE_ENV=production PORT=4000 DB_PATH=/data/union.db
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci --omit=dev --workspace backend && npm cache clean --force
COPY backend backend
COPY --from=build /app/frontend/dist frontend/dist
RUN mkdir -p /data && chown node:node /data
VOLUME /data
EXPOSE 4000
USER node
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:4000/api/health || exit 1
CMD ["node", "--disable-warning=ExperimentalWarning", "backend/src/server.js"]
