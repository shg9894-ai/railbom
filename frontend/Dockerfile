FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
RUN npm install -g sirv-cli
COPY --from=builder /app/dist ./dist
CMD ["sh", "-c", "sirv dist --port ${PORT:-3000} --single --host"]
