FROM node:22-slim
WORKDIR /app
COPY package.json ./
COPY index.html favicon.svg ./
COPY web ./web
COPY core ./core
COPY server ./server
ENV HOST=0.0.0.0 PORT=3188 DATA_DIR=/app/data
EXPOSE 3188
VOLUME ["/app/data"]
CMD ["node", "server/index.mjs"]
