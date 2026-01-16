FROM nginx:alpine

COPY index.html /usr/share/nginx/html/
COPY styles.css /usr/share/nginx/html/
COPY app.js /usr/share/nginx/html/
COPY manifest.json /usr/share/nginx/html/
COPY icon.svg /usr/share/nginx/html/
COPY *.png /usr/share/nginx/html/

COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80 443
