



#!/bin/bash



# 使脚本在遇到任何错误时自动退出
set -e

# 定义一个错误处理函数
error_handler() {
    local exit_code=$?
    local line_no=$1
    echo "Error on line $line_no. Exit code: $exit_code"
    exit $exit_code
}

# 使用trap命令捕获错误并调用错误处理函数
trap 'error_handler $LINENO' ERR


VERSION=$(date +%Y%m%d%H%M)
BACK_IMAGE_NAME=liuhuapiaoyuan/ai-human-server
FRONT_IMAGE_NAME=liuhuapiaoyuan/ai-human
# 编译后端
echo "Building backend..."
docker build -f ./docker/server.Dockerfile  -t $BACK_IMAGE_NAME:latest -t $BACK_IMAGE_NAME:$VERSION .

# 编译前端
echo "Building frontend..."
docker build -f ./docker/frontend.Dockerfile -t $FRONT_IMAGE_NAME:latest -t $FRONT_IMAGE_NAME:$VERSION .

echo "Build complete."


echo "Pushing images to Docker Hub..."

docker push $BACK_IMAGE_NAME:latest
docker push $BACK_IMAGE_NAME:$VERSION

docker push $FRONT_IMAGE_NAME:latest
docker push $FRONT_IMAGE_NAME:$VERSION

echo "Push complete."

