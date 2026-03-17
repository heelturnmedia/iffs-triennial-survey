# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .

# Vite bakes env vars at build time — pass them in as build args
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_MAPBOX_TOKEN

ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_MAPBOX_TOKEN=$VITE_MAPBOX_TOKEN

RUN npm run build

# ── Stage 2: serve ────────────────────────────────────────────────────────────
FROM nginx:stable-alpine

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# SPA routing config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
