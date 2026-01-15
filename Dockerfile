# Use official Node.js LTS
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy dependency files first (for cache)
COPY package.json package-lock.json ./

# Install production dependencies
RUN npm ci --omit=dev

# Copy application source
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Environment
ENV NODE_ENV=production

# Railway injects PORT automatically
EXPOSE 3000

# Start app (run migrations then start server)
CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]
