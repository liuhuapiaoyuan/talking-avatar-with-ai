



#!/bin/bash
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

