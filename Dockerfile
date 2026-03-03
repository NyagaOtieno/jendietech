# ---- builder ----
FROM node:20-alpine AS builder
WORKDIR /app

# Copy package files first
COPY package*.json ./

# ✅ Copy prisma schema BEFORE npm ci (so postinstall prisma generate can find it)
COPY prisma ./prisma

# Install deps (postinstall runs here)
RUN npm ci

# Copy the rest of the code
COPY . .

# (Optional but safe) ensure prisma client is generated
RUN npx prisma generate

# ---- runtime ----
FROM node:20-alpine AS runner
WORKDIR /app

# Copy built app
COPY --from=builder /app /app

EXPOSE 8080
CMD ["node", "server.js"]