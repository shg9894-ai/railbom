FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
RUN npm install -g http-server
COPY --from=builder /app/dist ./dist
CMD ["sh", "-c", "http-server dist -p ${PORT:-3000} --proxy http://localhost:${PORT:-3000}? -c-1"]
