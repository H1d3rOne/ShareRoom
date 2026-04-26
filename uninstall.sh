#!/bin/bash

set -u

GREEN="\033[0;32m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
NC="\033[0m"

PROJECT_ROOT=$(cd "$(dirname "$0")" && pwd)
RUN_DIR="$PROJECT_ROOT/.run"
STOP_SCRIPT="$PROJECT_ROOT/./stop.sh"
NGINX_SITES_AVAILABLE_DIR="/etc/nginx/sites-available"
NGINX_SITES_ENABLED_DIR="/etc/nginx/sites-enabled"
NGINX_CONF_D_DIR="/etc/nginx/conf.d"
NGINX_CONFIG_CHANGED="n"

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

find_shareroom_site_files() {
  local results=""
  for dir in "$NGINX_SITES_AVAILABLE_DIR" "$NGINX_CONF_D_DIR"; do
    if [ -d "$dir" ]; then
      local current
      current=$(grep -Rsl '^# BEGIN ShareRoom ' "$dir" 2>/dev/null || true)
      if [ -n "$current" ]; then
        results="${results}${current}\n"
      fi
    fi
  done

  if [ -n "$results" ]; then
    printf '%b' "$results" | sed '/^$/d' | sort -u
  fi
}

restore_latest_nginx_backup() {
  local site_file="$1"
  local latest_backup
  latest_backup=$(find "$(dirname "$site_file")" -maxdepth 1 -type f -name "$(basename "$site_file").bak.*" 2>/dev/null | sort | tail -n 1)

  if [ -n "$latest_backup" ]; then
    $SUDO cp "$latest_backup" "$site_file"
    print_success "已恢复 Nginx 站点备份: $latest_backup"
    NGINX_CONFIG_CHANGED="y"
    return 0
  fi

  return 1
}

remove_enabled_link() {
  local site_file="$1"
  local site_link="$NGINX_SITES_ENABLED_DIR/$(basename "$site_file")"

  if [ -L "$site_link" ] || [ -f "$site_link" ]; then
    $SUDO rm -f "$site_link"
    print_success "已移除 Nginx 启用链接: $site_link"
    NGINX_CONFIG_CHANGED="y"
  fi
}

remove_shareroom_nginx_sites() {
  require_sudo_if_needed

  local site_files
  site_files=$(find_shareroom_site_files)

  if [ -z "$site_files" ]; then
    print_warning "未检测到 ShareRoom 写入的 Nginx 站点配置"
    return 0
  fi

  while IFS= read -r site_file; do
    [ -z "$site_file" ] && continue
    remove_enabled_link "$site_file"

    if ! restore_latest_nginx_backup "$site_file"; then
      $SUDO rm -f "$site_file"
      print_success "已删除 ShareRoom Nginx 站点文件: $site_file"
      NGINX_CONFIG_CHANGED="y"
    fi
  done <<EOF2
$site_files
EOF2
}

reload_nginx_config() {
  require_sudo_if_needed

  if [ "$NGINX_CONFIG_CHANGED" != "y" ]; then
    return 0
  fi

  if ! command -v nginx >/dev/null 2>&1; then
    print_warning "未检测到 Nginx，跳过配置校验与重载"
    return 0
  fi

  $SUDO nginx -t || {
    print_error "Nginx 配置校验失败，请手动检查"
    exit 1
  }

  if command -v systemctl >/dev/null 2>&1; then
    $SUDO systemctl reload nginx || {
      print_error "Nginx 重载失败，请手动检查"
      exit 1
    }
  else
    $SUDO nginx -s reload || {
      print_error "Nginx 重载失败，请手动检查"
      exit 1
    }
  fi

  print_success "Nginx 配置已重载"
}

cleanup_project_runtime() {
  rm -rf "$RUN_DIR"
  print_success "已清理运行目录: $RUN_DIR"
}

print_warning "停止现有 ShareRoom 服务..."
run_stop_script

print_warning "移除 ShareRoom Nginx 站点配置..."
remove_shareroom_nginx_sites
reload_nginx_config

print_warning "清理项目运行产物..."
cleanup_project_runtime

print_success "卸载完成"
echo "已完成: 停止 ShareRoom、移除 ShareRoom Nginx 站点配置、reload Nginx、清理 .run/"
echo "未删除: 原有 Nginx 其他站点、项目源码、node/npm、node_modules、dist"
