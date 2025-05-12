FROM node:18-alpine

WORKDIR /app

# 安裝編譯必需套件
RUN apk add --no-cache \
    python3 \
    python3-dev \
    py3-pip \
    py3-setuptools \
    make \
    g++ \
    sqlite \
    sqlite-dev

# 設置編譯環境變量
ENV PYTHON=/usr/bin/python3 \
    npm_config_build_from_source=true \
    npm_config_python=/usr/bin/python3 \
    CFLAGS="-I/usr/include" \
    LDFLAGS="-L/usr/lib" \
    SQLITE3_BINARY_HOST_MIRROR="" \
    npm_config_node_sqlite3_binary_host_mirror=""

# 複製package.json並安裝依賴
COPY package*.json ./

RUN npm install --build-from-source

# 複製應用程式檔案
COPY . .

# 建立資料庫目錄並設定權限
RUN mkdir -p /app/data && \
    chown -R node:node /app

# 建立一個預設的admin.json檔案，僅在外部未掛載時使用
RUN echo '{"username": "admin", "password": "admin"}' > /app/data/admin.json

USER node

EXPOSE 3004

CMD ["npm", "start"]
