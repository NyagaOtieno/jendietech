FROM node:20-alpine

WORKDIR /app

# Install all dependencies (including dev)
COPY package.json package-lock.json ./
RUN npm ci

# Copy project files
COPY . .

# Make prisma CLI executable
RUN chmod +x node_modules/.bin/prisma

# Generate Prisma client
RUN npx prisma generate

ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "server.js"]
