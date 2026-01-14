# Ocean Depths Frontend - Multi-stage Dockerfile

# ============================================
# Base stage
# ============================================
FROM node:20-alpine as base

WORKDIR /app

# Install dependencies for native modules
RUN apk add --no-cache libc6-compat

# ============================================
# Development stage
# ============================================
FROM base as development

# Copy package files
COPY package*.json ./

# Install all dependencies
RUN npm ci

# Copy source code
COPY . .

EXPOSE 5173

# Development command with hot reload
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# ============================================
# Builder stage
# ============================================
FROM base as builder

COPY package*.json ./
RUN npm ci

COPY . .

# Build for production
RUN npm run build

# ============================================
# Production stage - serve with nginx
# ============================================
FROM nginx:alpine as production

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
