FROM node:18-alpine

WORKDIR /app

# 安装必要的系统依赖（例如 prisma 可能需要 openssl）
RUN apk add --no-cache openssl

# 复制 package.json 和 package-lock.json
COPY package*.json ./

# 安装依赖
RUN npm install

# 复制 Prisma schema 并生成客户端
COPY prisma ./prisma
RUN npx prisma generate

# 复制源代码并构建
COPY . .
RUN npm run build

# 暴露端口，假设 app.ts 中监听了某些端口，比如 3000
EXPOSE 3000

# 启动服务
CMD ["npm", "start"]
