#!/bin/bash

# 颜色定义
GREEN="\033[0;32m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
NC="\033[0m" # No Color

# 检查并终止正在运行的服务
echo -e "${YELLOW}检查并终止正在运行的服务...${NC}"

# 检查前端服务（端口3001）
if lsof -i :3001 > /dev/null 2>&1; then
    echo -e "${YELLOW}发现前端服务正在运行，正在终止...${NC}"
    lsof -ti :3001 | xargs kill -9
    echo -e "${GREEN}前端服务已终止${NC}"
else
    echo -e "${GREEN}前端服务未运行${NC}"
fi

# 检查后端服务（端口3002）
if lsof -i :3002 > /dev/null 2>&1; then
    echo -e "${YELLOW}发现后端服务正在运行，正在终止...${NC}"
    lsof -ti :3002 | xargs kill -9
    echo -e "${GREEN}后端服务已终止${NC}"
else
    echo -e "${GREEN}后端服务未运行${NC}"
fi

# 启动后端服务
echo -e "${YELLOW}启动后端服务...${NC}"
node server/server.js &

# 等待后端服务启动
sleep 2

# 启动前端服务
echo -e "${YELLOW}启动前端服务...${NC}"
npm run dev &

# 等待前端服务启动
sleep 3

# 显示服务状态
echo -e "${GREEN}服务启动完成！${NC}"
echo -e "${GREEN}前端服务: http://localhost:3001${NC}"
echo -e "${GREEN}后端服务: http://localhost:3002${NC}"
