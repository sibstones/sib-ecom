# Production: build SvelteKit static (adapter-static) + nginx
# Build with: docker build --build-arg VITE_API_URL=/api --build-arg PUBLIC_SITE_URL=https://your-domain.com -t fashion-frontend .

# Stage 1: build
FROM node:20-alpine AS builder
WORKDIR /app

ARG CACHE_BUST=0
ARG NODE_OPTIONS=--max-old-space-size=3072
ARG VITE_API_URL=/api
ARG PUBLIC_SITE_URL
RUN echo "cache-bust=${CACHE_BUST}" >/dev/null
ENV NODE_OPTIONS=${NODE_OPTIONS}
ENV VITE_API_URL=${VITE_API_URL}
ENV PUBLIC_SITE_URL=${PUBLIC_SITE_URL}
ENV ADAPTER_STATIC=true

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: serve with nginx
FROM nginx:alpine
COPY --from=builder /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
