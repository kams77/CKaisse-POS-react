# KolaPass — image de production (application compilée + serveur Node sans dépendance).
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json .npmrc ./
RUN npm install --no-audit --no-fund
COPY index.html vite.config.ts tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000 DATA_DIR=/data
COPY --from=build /app/dist ./dist
COPY server ./server
COPY package.json ./
VOLUME ["/data"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "server/index.mjs", "--production"]
