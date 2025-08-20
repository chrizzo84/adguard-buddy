# Use official Node.js LTS image for AMD64
FROM node:20-bullseye AS builder

WORKDIR /app

COPY . .

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.14.0 --activate

# Install dependencies with pnpm und baue native Module
RUN pnpm install --frozen-lockfile && pnpm rebuild
# Run linting before build, fail on warnings
RUN pnpm lint --max-warnings 0

# Build Next.js app
RUN pnpm build


# Production image
FROM node:20-bullseye

WORKDIR /app

COPY --from=builder /app ./

# Install pnpm in production image
RUN npm install -g pnpm@8


# Set image labels for metadata
ARG BUILD_DATE
ARG VCS_REF
ARG VERSION
LABEL org.opencontainers.image.created="${BUILD_DATE}" \
	org.opencontainers.image.revision="${VCS_REF}" \
	org.opencontainers.image.source="https://github.com/chrizzo84/adguard-buddy" \
	org.opencontainers.image.version="${VERSION}"

ENV NODE_ENV=production

EXPOSE 3000

CMD ["pnpm", "start"]
