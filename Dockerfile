# Stage 1: Build (install deps + generate prisma client)
FROM node:20-alpine AS builder

WORKDIR /app

# Alpine deps (safe for prisma engines)
RUN apk add --no-cache libc6-compat openssl

# Copy package files first for caching
COPY package.json package-lock.json ./

# Copy prisma schema BEFORE npm ci (so prisma can find schema)
COPY prisma ./prisma

# Install all deps (dev + prod)
RUN npm ci

# Copy the rest of the app
COPY . .

# ✅ Generate Prisma client WITHOUT using the prisma binary shim
RUN node node_modules/prisma/build/index.js generate

# Stage 2: Production runtime
FROM node:20-alpine

WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache libc6-compat openssl

# Copy package files
COPY package.json package-lock.json ./

# Copy prisma schema BEFORE npm ci --omit=dev (postinstall safety)
COPY prisma ./prisma

# Install only production deps
RUN npm ci --omit=dev

# Copy app + generated prisma client from builder
COPY --from=builder /app ./

EXPOSE 3000
CMD ["node", "server.js"]