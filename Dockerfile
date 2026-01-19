FROM node:20-alpine AS backend-builder

WORKDIR /app

COPY backend/package*.json ./
RUN npm install --omit=dev

COPY backend/*.js ./

FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache nginx

COPY --from=backend-builder /app/node_modules ./node_modules
COPY --from=backend-builder /app/*.js ./
COPY --from=backend-builder /app/package.json ./

COPY index.html /usr/share/nginx/html/
COPY styles.css /usr/share/nginx/html/
COPY app.js /usr/share/nginx/html/
COPY manifest.json /usr/share/nginx/html/
COPY icon.svg /usr/share/nginx/html/
COPY *.png /usr/share/nginx/html/

RUN apk add --no-cache su-exec

RUN mkdir -p /etc/nginx/http.d

COPY nginx.conf /etc/nginx/http.d/default.conf

RUN mkdir -p /data && chown -R node:node /data

COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 80 3001

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
