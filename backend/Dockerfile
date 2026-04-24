FROM node:20-slim

# Install git (needed to clone repos) and curl
RUN apt-get update && apt-get install -y --no-install-recommends git curl ca-certificates && rm -rf /var/lib/apt/lists/*

# Install railpack — musl binary runs fine on glibc (statically linked)
RUN ARCH=$(uname -m) && \
    if [ "$ARCH" = "aarch64" ]; then ARCH="arm64"; fi && \
    curl -fsSL "https://github.com/railwayapp/railpack/releases/download/v0.23.0/railpack-v0.23.0-${ARCH}-unknown-linux-musl.tar.gz" \
    | tar -xz -C /usr/local/bin railpack && \
    chmod +x /usr/local/bin/railpack

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src

EXPOSE 3001

CMD ["npx", "tsx", "src/index.ts"]
