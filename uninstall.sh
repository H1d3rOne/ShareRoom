#!/bin/bash

set -u

GREEN="\033[0;32m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
NC="\033[0m"

PROJECT_ROOT=$(cd "$(dirname "$0")" && pwd)
RUN_DIR="$PROJECT_ROOT/.run"
STOP_SCRIPT="$PROJECT_ROOT/./stop.sh"
CADDYFILE_PATH="/etc/caddy/Caddyfile"
CADDY_SOURCE_LIST="/etc/apt/sources.list.d/caddy-stable.list"
CADDY_KEYRING="/usr/share/keyrings/caddy-stable-archive-keyring.gpg"

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

require_sudo_if_needed() {
  if [ -n "$SUDO" ]; then
    return 0
  fi

  if [ "${EUID:-$(id -u)}" -ne 0 ]; then
    print_error "当前操作需要 root 权限，请使用 sudo ./uninstall.sh 重新执行"
    exit 1
  fi
}

run_stop_script() {
  if [ -x "$STOP_SCRIPT" ]; then
    "$STOP_SCRIPT" || print_warning "stop.sh 执行失败，继续卸载流程"
  elif [ -f "$STOP_SCRIPT" ]; then
    bash "$STOP_SCRIPT" || print_warning "stop.sh 执行失败，继续卸载流程"
  else
    print_warning "未找到 stop.sh，跳过服务停止脚本"
  fi
}

restore_latest_caddy_backup() {
  require_sudo_if_needed

  local latest_backup
  latest_backup=$(find /etc/caddy -maxdepth 1 -type f -name 'Caddyfile.bak.*' 2>/dev/null | sort | tail -n 1)

  if [ -n "$latest_backup" ]; then
    $SUDO cp "$latest_backup" "$CADDYFILE_PATH"
    print_success "已恢复 Caddyfile 备份: $latest_backup"
    return 0
  fi

  return 1
}

remove_shareroom_caddy_blocks() {
  require_sudo_if_needed

  if [ ! -f "$CADDYFILE_PATH" ]; then
    return 0
  fi

  local temp_file
  temp_file=$(mktemp)

  awk '
    /^# BEGIN ShareRoom / { skip=1; next }
    /^# END ShareRoom / { skip=0; next }
    !skip { print }
  ' "$CADDYFILE_PATH" > "$temp_file"

  $SUDO cp "$temp_file" "$CADDYFILE_PATH"
  rm -f "$temp_file"
  print_success "已移除 ShareRoom 写入的 Caddy 配置块"
}

stop_caddy_service() {
  if ! command -v systemctl >/dev/null 2>&1; then
    return 0
  fi

  if [ -n "$SUDO" ]; then
    $SUDO systemctl stop caddy >/dev/null 2>&1 || true
    $SUDO systemctl disable caddy >/dev/null 2>&1 || true
  else
    systemctl stop caddy >/dev/null 2>&1 || true
    systemctl disable caddy >/dev/null 2>&1 || true
  fi
}

purge_caddy() {
  require_sudo_if_needed

  if ! command -v apt-get >/dev/null 2>&1; then
    print_warning "当前系统不是 apt 系发行版，跳过自动卸载 Caddy 包"
    return 0
  fi

  if dpkg -s caddy >/dev/null 2>&1; then
    $SUDO apt-get purge -y caddy || print_warning "Caddy purge 失败，请手动检查"
    $SUDO apt-get autoremove -y >/dev/null 2>&1 || true
  else
    print_warning "未检测到已安装的 Caddy 包，跳过 purge"
  fi

  $SUDO rm -f "$CADDY_SOURCE_LIST"
  $SUDO rm -f "$CADDY_KEYRING"
}

cleanup_project_runtime() {
  rm -rf "$RUN_DIR"
  print_success "已清理运行目录: $RUN_DIR"
}

print_warning "停止现有 ShareRoom / Caddy 服务..."
run_stop_script

print_warning "回滚 Caddy 配置..."
if ! restore_latest_caddy_backup; then
  remove_shareroom_caddy_blocks
fi
stop_caddy_service

print_warning "卸载 Caddy..."
purge_caddy

print_warning "清理项目运行产物..."
cleanup_project_runtime

print_success "卸载完成"
echo "已完成: 停止 ShareRoom、回滚 Caddy 配置、卸载 Caddy、清理 .run/"
echo "未删除: 项目源码、node/npm、node_modules、dist"
