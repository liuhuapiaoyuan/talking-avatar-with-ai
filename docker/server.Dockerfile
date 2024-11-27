FROM node:22-alpine AS builder

# 设置工作目录
WORKDIR /app

# 复制应用代码 复制apps/backend ,复制 package.json,yarn.lock 
COPY apps/backend/package.json apps/backend/package.json
COPY package.json .
COPY yarn.lock .

RUN yarn install --frozen-lockfile

# 构建阶段结束，开始定义运行时环境
FROM node:18-alpine

# 创建工作目录
WORKDIR /app

# 从构建阶段复制 node_modules
COPY apps/backend apps/backend
COPY package.json .
COPY --from=builder /app/node_modules ./node_modules

# 3000
EXPOSE 3000

# 启动应用 运行server:start
CMD ["yarn", "server:start"]

