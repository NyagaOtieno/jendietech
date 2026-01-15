# Stage 1: Build with devDependencies
FROM node:20-alpine AS builder

WORKDIR /app

# Install all dependencies including dev
COPY package.json package-lock.json ./
RUN npm ci

# Copy project files
COPY . .

# Make Prisma executable
RUN chmod +x node_modules/.bin/prisma

# Generate Prisma client
RUN npx prisma generate

# Stage 2: Production image
FROM node:20-alpine

WORKDIR /app

# Install only production dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy built files and generated prisma client
COPY --from=builder /app .

# Set environment
ENV NODE_ENV=production

EXPOSE 3000

# Start server
CMD ["node", "server.js"]
