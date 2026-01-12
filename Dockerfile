# Use Node.js LTS
FROM node:18-alpine

# Set working directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build if necessary (NestJS usually needs a build step)
RUN npm run build

# Expose port (Assuming 4000 or different from main API to avoid conflict if on host, but in docker it's isolated)
# Let's assume standard NestJS port 3000 but mapped differently, or configurable via env.
EXPOSE 3000

# Start command
CMD ["node", "dist/main"]
