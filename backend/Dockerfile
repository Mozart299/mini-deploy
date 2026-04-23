FROM node:20-alpine

# Install git (needed to clone repos) and railpack
RUN apk add --no-cache git curl bash

# Install railpack
RUN curl -fsSL https://railpack.io/install.sh | bash

WORKDIR /app

# Copy dependencies first to maximize layer cache
COPY package*.json ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src

EXPOSE 3001

CMD ["npx", "tsx", "src/index.ts"]
