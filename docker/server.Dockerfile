FROM node:22-alpine AS build

# 设置工作目录
WORKDIR /app

# 复制应用代码 复制apps/backend ,复制 package.json,yarn.lock 
COPY apps/backend apps/backend
COPY package.json .
COPY yarn.lock .

# 安装依赖
RUN yarn install

# 3000
EXPOSE 3000

# 启动应用 运行server:start
CMD ["yarn", "server:start"]

