FROM node:20-slim

# ติดตั้ง Chromium และ dependencies ที่จำเป็นทั้งหมด
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    fonts-thai-tlwg \
    fonts-khmeros \
    fonts-freefont-ttf \
    libxss1 \
    dbus \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# ตั้งค่า environment ให้ Puppeteer ชี้ไปที่ Chromium ที่ติดตั้งไว้
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

CMD ["node", "index.js"]
