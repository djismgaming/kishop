FROM node:22.23.2-alpine3.24 AS backend-builder

WORKDIR /app

COPY backend/package*.json ./
RUN npm ci --omit=dev

COPY backend/*.js ./

FROM node:22.23.2-alpine3.24

WORKDIR /app

RUN apk add --no-cache nginx su-exec && \
    # Remove npm/corepack from the runtime image - not needed to run the app,
    # and their bundled dependencies carry known CVEs
    rm -rf /usr/local/lib/node_modules/npm \
           /usr/local/lib/node_modules/corepack \
           /opt/yarn-v* /usr/local/bin/npm /usr/local/bin/npx \
           /usr/local/bin/corepack /usr/local/bin/yarn* /usr/local/bin/yarnpkg

COPY --from=backend-builder /app/node_modules ./node_modules
COPY --from=backend-builder /app/*.js ./
COPY --from=backend-builder /app/package.json ./

COPY index.html /usr/share/nginx/html/
COPY styles.css /usr/share/nginx/html/
COPY app.js /usr/share/nginx/html/
COPY manifest.json /usr/share/nginx/html/
COPY icon.svg /usr/share/nginx/html/
COPY *.png /usr/share/nginx/html/

RUN touch /usr/share/nginx/html/.gitkeep


RUN mkdir -p /etc/nginx/http.d

COPY nginx.conf /etc/nginx/http.d/default.conf

RUN mkdir -p /data && chown -R node:node /data

COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 80 3001

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
