#!/bin/bash

# 颜色定义
GREEN="\033[0;32m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
NC="\033[0m"

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}   ShareRoom 项目依赖安装脚本${NC}"
echo -e "${YELLOW}========================================${NC}"
echo ""

# 检查 Node.js 是否安装
if ! command -v node &> /dev/null; then
    echo -e "${RED}错误: 未检测到 Node.js，请先安装 Node.js (>= 16.0.0)${NC}"
    echo "下载地址: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    echo -e "${RED}警告: Node.js 版本过低 (当前: $(node -v))，建议使用 >= 16.0.0${NC}"
fi

echo -e "${GREEN}Node.js 版本: $(node -v)${NC}"
echo -e "${GREEN}npm 版本: $(npm -v)${NC}"
echo ""

# 安装前端依赖
echo -e "${YELLOW}[1/2] 安装前端依赖...${NC}"
npm install

if [ $? -ne 0 ]; then
    echo -e "${RED}前端依赖安装失败${NC}"
    exit 1
fi
echo -e "${GREEN}前端依赖安装完成${NC}"

# 安装后端依赖（server目录）
echo ""
echo -e "${YELLOW}[2/2] 安装后端依赖...${NC}"
cd server && npm install

if [ $? -ne 0 ]; then
    echo -e "${RED}后端依赖安装失败${NC}"
    cd ..
    exit 1
fi
cd ..
echo -e "${GREEN}后端依赖安装完成${NC}"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   所有依赖安装完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "可用命令:"
echo "  npm run dev        启动前端开发服务器"
echo "  npm run server     启动后端服务器"
echo "  npm run start-all  一键启动前后端"
echo "  npm run build      构建生产版本"
echo ""
