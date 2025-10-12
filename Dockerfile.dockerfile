# Use official Node.js LTS image
FROM node:20-alpine

# Set working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json first for caching
COPY package.json package-lock.json ./

# Install dependencies using NPM
RUN npm install --production

# Copy the rest of the project
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Apply Prisma migrations (automatically deploys migrations to your DB)
RUN npx prisma migrate deploy

# Seed the database
RUN node prisma/seed.js

# Set environment variables (Railway sets PORT automatically)
ENV NODE_ENV=production

# Expose Railway dynamic port (Railway will override this)
EXPOSE 3000

# Start the server
CMD ["node", "server.js"]
