FROM node:20-alpine

WORKDIR /app

# Install OpenSSL and libc compatibility for Prisma
RUN apk add --no-cache openssl libc6-compat

# Copy package files and prisma schema
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm install

# Generate Prisma Client
RUN npx prisma generate

# Copy application source and build config
COPY tsconfig.json ./
COPY src ./src
COPY docker-entrypoint.sh ./

# Make entrypoint script executable
RUN chmod +x ./docker-entrypoint.sh

# Build TypeScript to dist/
RUN npm run build

EXPOSE 4000

ENTRYPOINT ["./docker-entrypoint.sh"]
