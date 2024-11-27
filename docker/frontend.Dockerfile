# 第一阶段: 编译React应用
FROM node:22-alpine AS builder

# 设置工作目录
WORKDIR /app

# 复制应用代码
COPY apps/frontend apps/frontend
COPY package.json .
COPY yarn.lock .


# 安装依赖
RUN yarn install

# 构建应用
RUN yarn run client:build

# 第二阶段: 配置Nginx以服务静态文件
FROM nginx:alpine

# 删除默认的Nginx配置文件
RUN rm /etc/nginx/conf.d/default.conf

# 复制编译后的文件到Nginx的html目录
COPY --from=builder /app/apps/frontend/dist /usr/share/nginx/html

# 拷贝自定义的Nginx配置文件到Nginx配置目录
COPY ./docker/frontend.nginx.conf /etc/nginx/conf.d/default.conf.template

COPY ./docker/start-nginx.sh /start-nginx.sh
RUN chmod +x /start-nginx.sh

# 暴露80端口
EXPOSE 80

# 启动Nginx
CMD ["/start-nginx.sh"]

