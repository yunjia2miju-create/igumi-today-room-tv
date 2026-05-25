FROM node:18-alpine

WORKDIR /app

# Copy package descriptors
COPY package*.json ./

# Install dependencies (including devDependencies for build step)
RUN npm ci

# Copy the entire workspace
COPY . .

# Run the build process (Vite + esbuild server bundle)
RUN npm run build

# Configure runtime environment
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

# Startup command
CMD ["node", "dist/server.cjs"]
