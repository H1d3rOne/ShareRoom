#!/bin/bash

set -u

GREEN="\033[0;32m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
NC="\033[0m"

PROJECT_ROOT=$(cd "$(dirname "$0")" && pwd)
PID_DIR="$PROJECT_ROOT/.run"
PID_FILE="$PID_DIR/shareroom.pid"

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

stop_caddy() {
  if ! command -v systemctl >/dev/null 2>&1; then
    print_warning "未检测到 systemctl，跳过 Caddy 停止"
    return 0
  fi

  if ! command -v caddy >/dev/null 2>&1; then
    print_warning "未检测到 Caddy，跳过 Caddy 停止"
    return 0
  fi

  if [ -n "$SUDO" ]; then
    $SUDO systemctl stop caddy >/dev/null 2>&1 || print_warning "Caddy 停止失败，请手动检查"
  else
    systemctl stop caddy >/dev/null 2>&1 || print_warning "Caddy 停止失败，请手动检查"
  fi
}

stop_app() {
  if [ -f "$PID_FILE" ]; then
    local pid
    pid=$(cat "$PID_FILE" 2>/dev/null || true)
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      sleep 1
      kill -9 "$pid" 2>/dev/null || true
      print_success "已停止 ShareRoom 进程: $pid"
    fi
    rm -f "$PID_FILE"
  fi

  local extra_pids
  extra_pids=$(pgrep -f "node server/server.js" || true)
  if [ -n "$extra_pids" ]; then
    print_warning "检测到残留 ShareRoom 进程，尝试清理"
    pkill -f "node server/server.js" 2>/dev/null || true
    sleep 1
    pkill -9 -f "node server/server.js" 2>/dev/null || true
  fi
}

stop_app
stop_caddy
print_success "所有服务已停止"
