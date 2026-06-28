FROM node:20-alpine AS builder
# Install build dependencies for better-sqlite3 compilation
RUN apk add --no-cache python3 py3-setuptools make g++
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
# Prune devDependencies so only production modules remain
RUN npm prune --production

FROM node:20-alpine
WORKDIR /app
# Copy pre-compiled production node_modules and built assets
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
EXPOSE 3000
ENV NODE_ENV=production
CMD ["node", "dist/server.js"]
