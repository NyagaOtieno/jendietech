# Stage 1: Build (install deps + generate prisma client)
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first for caching
COPY package.json package-lock.json ./

# ✅ Copy prisma schema BEFORE npm ci (so postinstall/prisma can find it if it runs)
COPY prisma ./prisma

# Install all deps (dev + prod)
RUN npm ci

# Copy the rest of the app
COPY . .

# Generate Prisma client (safe even if postinstall already did)
RUN npx prisma generate

# Stage 2: Production runtime
FROM node:20-alpine

WORKDIR /app
ENV NODE_ENV=production

# Copy package files
COPY package.json package-lock.json ./

# ✅ Copy prisma schema BEFORE npm ci --omit=dev (so postinstall prisma generate won't fail)
COPY prisma ./prisma

# Install only production deps
RUN npm ci --omit=dev

# Copy the built app + generated prisma client from builder
COPY --from=builder /app ./

EXPOSE 3000

CMD ["node", "server.js"]