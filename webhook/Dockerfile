FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .

RUN apk add --no-cache docker-cli

# Run as root so the webhook handler can access the Docker socket
USER root

EXPOSE 3000
CMD ["node", "index.js"]
