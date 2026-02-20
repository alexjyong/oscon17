FROM node:8

# Debian Stretch is EOL -- point to archived repos
RUN echo "deb http://archive.debian.org/debian stretch main" > /etc/apt/sources.list && \
    echo "deb http://archive.debian.org/debian-security stretch/updates main" >> /etc/apt/sources.list

# Install libvips from system packages (sharp 0.17's bintray download is dead)
RUN apt-get -o Acquire::Check-Valid-Until=false update && \
    apt-get install -y --no-install-recommends libvips-dev && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install deps first for layer caching
COPY package.json package-lock.json* ./
RUN npm install && npm install react-search-bar@1.1.4

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
