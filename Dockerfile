# Stage 1: Build (install deps + generate prisma client)
FROM node:20-alpine AS builder

WORKDIR /app

# ✅ Needed on alpine for some node binaries + prisma engines
RUN apk add --no-cache libc6-compat openssl

# Copy package files first for caching
COPY package.json package-lock.json ./

# Copy prisma schema BEFORE npm ci
COPY prisma ./prisma

# Install all deps (dev + prod)
RUN npm ci

# ✅ Ensure prisma binary is executable (fix Permission denied)
RUN chmod +x node_modules/.bin/prisma

# Copy the rest of the app
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Stage 2: Production runtime
FROM node:20-alpine

WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache libc6-compat openssl

COPY package.json package-lock.json ./
COPY prisma ./prisma

RUN npm ci --omit=dev

# Copy the built app + generated prisma client from builder
COPY --from=builder /app ./

EXPOSE 3000
CMD ["node", "server.js"]