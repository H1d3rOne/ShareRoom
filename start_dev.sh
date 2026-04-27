#!/bin/bash

set -u

GREEN="\033[0;32m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
NC="\033[0m"

PROJECT_ROOT=$(cd "$(dirname "$0")" && pwd)
backend_pid=""

LIVEKIT_URL="${LIVEKIT_URL:-}"
LIVEKIT_API_KEY="${LIVEKIT_API_KEY:-}"
LIVEKIT_API_SECRET="${LIVEKIT_API_SECRET:-}"
export LIVEKIT_URL LIVEKIT_API_KEY LIVEKIT_API_SECRET

print_success() {
  echo -e "${GREEN}$1${NC}"
}

print_warning() {
  echo -e "${YELLOW}$1${NC}"
}

print_error() {
  echo -e "${RED}$1${NC}"
}

cleanup() {
  if [ -n "$backend_pid" ] && kill -0 "$backend_pid" 2>/dev/null; then
    print_warning "正在停止后端开发服务: $backend_pid"
    kill "$backend_pid" 2>/dev/null || true
    wait "$backend_pid" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

cd "$PROJECT_ROOT"

print_success "后端开发服务: http://127.0.0.1:3002"
print_success "前端开发服务: http://127.0.0.1:3001"
print_warning "启动后端开发服务..."
npm run server &
backend_pid=$!

sleep 1
if ! kill -0 "$backend_pid" 2>/dev/null; then
  print_error "后端开发服务启动失败"
  exit 1
fi

print_warning "启动前端开发服务..."
npm run dev
