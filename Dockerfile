# ---- Build stage ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
COPY views ./views
# `build` compiles the Tailwind stylesheet into public/ and then TypeScript.
RUN npm run build

# ---- Runtime stage ----
FROM node:22-alpine
ENV NODE_ENV=production \
    PORT=8000
WORKDIR /app

# Production dependencies only, no install scripts.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY views ./views
COPY --from=build /app/public ./public
COPY --from=build /app/src/assets/fonts ./src/assets/fonts

# Run as the unprivileged `node` user shipped with the base image.
USER node
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://127.0.0.1:8000/health || exit 1

CMD ["node", "dist/index.js"]
