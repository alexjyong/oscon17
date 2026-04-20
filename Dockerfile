FROM node:20

WORKDIR /app

# Install deps first for layer caching
# Delete lockfile so npm respects the updated package.json versions
COPY package.json ./
RUN npm install --legacy-peer-deps && npm install --legacy-peer-deps react-search-bar@1.1.4

# Copy app source
COPY . .

# Build webpack bundle
RUN npm run build

# Create directories for uploads/processed images
RUN mkdir -p uploads public/thumbs public/images public/tiles

# Generate self-signed TLS certs for development
RUN mkdir -p /certs && \
    openssl req -x509 -nodes -days 365 \
      -newkey rsa:2048 \
      -keyout /certs/server.key \
      -out /certs/server.crt \
      -subj "/CN=localhost"

ENV TLS_KEY_PATH=/certs/server.key
ENV TLS_CERT_PATH=/certs/server.crt

EXPOSE 8080 4443

CMD ["node", "index-local.js"]
