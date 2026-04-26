#!/bin/bash

set -u

GREEN="\033[0;32m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
NC="\033[0m"

PROJECT_ROOT=$(cd "$(dirname "$0")" && pwd)
PID_DIR="$PROJECT_ROOT/.run"
PID_FILE="$PID_DIR/shareroom.pid"
LOG_FILE="$PID_DIR/shareroom.log"

if [ "${EUID:-$(id -u)}" -eq 0 ]; then
  SUDO=""
else
  if command -v sudo >/dev/null 2>&1; then
    SUDO="sudo"
  else
    SUDO=""
  fi
fi

print_success() {
  echo -e "${GREEN}$1${NC}"
}

print_warning() {
  echo -e "${YELLOW}$1${NC}"
}

print_error() {
  echo -e "${RED}$1${NC}"
}

start_caddy() {
  if ! command -v systemctl >/dev/null 2>&1; then
    print_warning "未检测到 systemctl，跳过 Caddy 启动"
    return 0
  fi

  if ! command -v caddy >/dev/null 2>&1; then
    print_warning "未检测到 Caddy，跳过 Caddy 启动"
    return 0
  fi

  if [ -n "$SUDO" ]; then
    $SUDO systemctl start caddy >/dev/null 2>&1 || print_warning "Caddy 启动失败，请手动检查"
    $SUDO systemctl status caddy --no-pager >/dev/null 2>&1 || true
  else
    systemctl start caddy >/dev/null 2>&1 || print_warning "Caddy 启动失败，请手动检查"
    systemctl status caddy --no-pager >/dev/null 2>&1 || true
  fi
}

stop_existing_app() {
  if [ -f "$PID_FILE" ]; then
    local existing_pid
    existing_pid=$(cat "$PID_FILE" 2>/dev/null || true)
    if [ -n "$existing_pid" ] && kill -0 "$existing_pid" 2>/dev/null; then
      print_warning "检测到 ShareRoom 已在运行，先停止旧进程: $existing_pid"
      kill "$existing_pid" 2>/dev/null || true
      sleep 1
      kill -9 "$existing_pid" 2>/dev/null || true
    fi
    rm -f "$PID_FILE"
  fi

  pgrep -f "node server/server.js" >/dev/null 2>&1 && {
    print_warning "检测到残留的 ShareRoom 进程，尝试清理"
    pkill -f "node server/server.js" 2>/dev/null || true
    sleep 1
    pkill -9 -f "node server/server.js" 2>/dev/null || true
  }
}

mkdir -p "$PID_DIR"

print_warning "检查并停止旧的 ShareRoom 进程..."
stop_existing_app

print_warning "构建前端资源..."
(cd "$PROJECT_ROOT" && npm run build) || {
  print_error "构建失败，启动中止"
  exit 1
}

print_warning "启动 ShareRoom 生产服务..."
(
  cd "$PROJECT_ROOT" && \
  nohup npm run start > "$LOG_FILE" 2>&1 &
  echo $! > "$PID_FILE"
)

sleep 2

if [ ! -f "$PID_FILE" ]; then
  print_error "启动失败：未生成 PID 文件"
  exit 1
fi

pid=$(cat "$PID_FILE")
if ! kill -0 "$pid" 2>/dev/null; then
  print_error "启动失败：进程未存活，请查看日志 $LOG_FILE"
  exit 1
fi

print_warning "启动 Caddy..."
start_caddy

print_success "ShareRoom 服务启动完成"
echo "应用 PID: $pid"
echo "日志文件: $LOG_FILE"
echo "生产服务地址: http://127.0.0.1:3002"
echo "如已配置域名与 HTTPS，请通过你的域名访问"
