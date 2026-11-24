# Imagen multi-etapa del backend (documento técnico, sección 5.4).
# La primera etapa instala solo dependencias de producción; la final corre con un usuario sin privilegios.

# Etapa 1: dependencias
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Etapa 2: imagen final
FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY src ./src
# Script del código 2FA: docker compose exec api npm run totp
COPY scripts/totp.js ./scripts/totp.js
COPY package.json ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3000/health > /dev/null || exit 1
CMD ["node", "src/server.js"]
