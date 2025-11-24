# Use official Node.js LTS image
FROM node:20-alpine

# Set working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json first for caching
COPY package.json package-lock.json ./

# Install dependencies
RUN npm install --production

# Copy the rest of the project (including prisma folder)
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Set environment variables (Railway sets PORT automatically)
ENV NODE_ENV=production

# Expose port
EXPOSE 3000

# Start the server
CMD ["node", "server.js"]
