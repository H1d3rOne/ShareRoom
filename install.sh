#!/bin/bash

set -u

GREEN="\033[0;32m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
NC="\033[0m"

PROJECT_ROOT=$(cd "$(dirname "$0")" && pwd)
CADDYFILE_PATH="/etc/caddy/Caddyfile"
APP_PORT="3002"
CONFIGURE_DOMAIN="n"
USE_HTTPS="n"
DOMAIN=""

if [ "${EUID:-$(id -u)}" -eq 0 ]; then
  SUDO=""
else
  if command -v sudo >/dev/null 2>&1; then
    SUDO="sudo"
  else
    SUDO=""
  fi
fi

print_section() {
  echo -e "${YELLOW}========================================${NC}"
  echo -e "${YELLOW}   $1${NC}"
  echo -e "${YELLOW}========================================${NC}"
  echo ""
}

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
    print_error "当前操作需要 root 权限，请使用 sudo ./install.sh 重新执行"
    exit 1
  fi
}

ask_yes_no() {
  local prompt="$1"
  local default="$2"
  local answer=""
  local suffix="[y/N]"

  if [ "$default" = "y" ]; then
    suffix="[Y/n]"
  fi

  while true; do
    read -r -p "$prompt $suffix: " answer
    answer=$(printf '%s' "$answer" | tr '[:upper:]' '[:lower:]')

    if [ -z "$answer" ]; then
      answer="$default"
    fi

    case "$answer" in
      y|yes)
        echo "y"
        return 0
        ;;
      n|no)
        echo "n"
        return 0
        ;;
      *)
        print_warning "请输入 y 或 n"
        ;;
    esac
  done
}

ask_with_default() {
  local prompt="$1"
  local default="$2"
  local answer=""

  read -r -p "$prompt (默认: $default): " answer
  if [ -z "$answer" ]; then
    echo "$default"
  else
    echo "$answer"
  fi
}

is_ip_address() {
  local value="$1"
  [[ "$value" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]]
}

is_valid_domain() {
  local value="$1"
  [[ "$value" =~ ^[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$ ]]
}

ensure_command() {
  local cmd="$1"
  local hint="$2"

  if ! command -v "$cmd" >/dev/null 2>&1; then
    print_error "$hint"
    exit 1
  fi
}

install_project_dependencies() {
  ensure_command node "错误: 未检测到 Node.js，请先安装 Node.js (>= 16.0.0)。下载地址: https://nodejs.org/"
  ensure_command npm "错误: 未检测到 npm，请先安装 npm"

  local node_version
  node_version=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
  if [ "$node_version" -lt 16 ]; then
    print_warning "警告: Node.js 版本过低 (当前: $(node -v))，建议使用 >= 16.0.0"
  fi

  print_success "Node.js 版本: $(node -v)"
  print_success "npm 版本: $(npm -v)"
  echo ""

  echo -e "${YELLOW}[1/2] 安装前端依赖...${NC}"
  (cd "$PROJECT_ROOT" && npm install) || {
    print_error "前端依赖安装失败"
    exit 1
  }
  print_success "前端依赖安装完成"

  echo ""
  echo -e "${YELLOW}[2/2] 安装后端依赖...${NC}"
  (cd "$PROJECT_ROOT/server" && npm install) || {
    print_error "后端依赖安装失败"
    exit 1
  }
  print_success "后端依赖安装完成"
}

install_caddy() {
  if command -v caddy >/dev/null 2>&1; then
    print_success "已检测到 Caddy，跳过安装"
    return 0
  fi

  require_sudo_if_needed

  if ! command -v apt-get >/dev/null 2>&1; then
    print_error "当前系统不是 apt 系发行版，暂未集成自动安装 Caddy，请参考 docs/deployment/https-screen-share.md 手动安装"
    exit 1
  fi

  echo ""
  echo -e "${YELLOW}[部署] 安装 Caddy...${NC}"
  $SUDO apt-get update
  $SUDO apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | $SUDO gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | $SUDO tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  $SUDO apt-get update
  $SUDO apt-get install -y caddy
  print_success "Caddy 安装完成"
}

backup_caddyfile() {
  require_sudo_if_needed

  if [ -f "$CADDYFILE_PATH" ]; then
    local backup_path="${CADDYFILE_PATH}.bak.$(date +%Y%m%d%H%M%S)"
    $SUDO cp "$CADDYFILE_PATH" "$backup_path"
    print_success "已备份现有 Caddyfile -> $backup_path"
  fi
}

render_caddy_block() {
  local domain="$1"
  local app_port="$2"
  local use_https="$3"
  local site_address="$domain"

  if [ "$use_https" != "y" ]; then
    site_address="http://$domain"
  fi

  cat <<BLOCK
# BEGIN ShareRoom $domain
$site_address {
  reverse_proxy 127.0.0.1:$app_port
}
# END ShareRoom $domain
BLOCK
}

configure_caddy() {
  local domain="$1"
  local app_port="$2"
  local use_https="$3"
  local temp_file
  local clean_file
  local start_marker="# BEGIN ShareRoom $domain"
  local end_marker="# END ShareRoom $domain"

  require_sudo_if_needed
  backup_caddyfile

  temp_file=$(mktemp)
  clean_file=$(mktemp)

  if [ -f "$CADDYFILE_PATH" ]; then
    $SUDO cp "$CADDYFILE_PATH" "$temp_file"
    awk -v start="$start_marker" -v end="$end_marker" '
      $0 == start { skip=1; next }
      $0 == end { skip=0; next }
      !skip { print }
    ' "$temp_file" > "$clean_file"
  else
    : > "$clean_file"
  fi

  if [ -s "$clean_file" ] && [ "$(tail -c 1 "$clean_file" 2>/dev/null)" != "" ]; then
    echo "" >> "$clean_file"
  fi

  render_caddy_block "$domain" "$app_port" "$use_https" >> "$clean_file"
  $SUDO mkdir -p "$(dirname "$CADDYFILE_PATH")"
  $SUDO cp "$clean_file" "$CADDYFILE_PATH"
  rm -f "$temp_file" "$clean_file"

  $SUDO systemctl enable caddy >/dev/null 2>&1 || true
  $SUDO systemctl reload caddy 2>/dev/null || $SUDO systemctl restart caddy
  $SUDO systemctl status caddy --no-pager || true

  print_success "Caddy 配置完成: $domain"
}

prompt_domain_configuration() {
  echo ""
  CONFIGURE_DOMAIN=$(ask_yes_no "是否配置域名" "n")
  if [ "$CONFIGURE_DOMAIN" != "y" ]; then
    return 0
  fi

  while true; do
    read -r -p "请输入域名: " DOMAIN
    if [ -z "$DOMAIN" ]; then
      print_warning "域名不能为空"
      continue
    fi
    if ! is_valid_domain "$DOMAIN"; then
      print_warning "请输入有效域名，例如 share.example.com"
      continue
    fi
    break
  done

  USE_HTTPS=$(ask_yes_no "是否启用 HTTPS" "y")
  APP_PORT=$(ask_with_default "请输入应用服务端口" "3002")

  if [ "$USE_HTTPS" = "y" ] && is_ip_address "$DOMAIN"; then
    print_error "HTTPS 模式不支持直接使用 IP，请填写已解析到服务器的域名"
    exit 1
  fi
}

print_summary() {
  echo ""
  print_success "========================================"
  print_success "   所有依赖安装完成！"
  print_success "========================================"
  echo ""
  echo "可用命令:"
  echo "  npm run dev        启动前端开发服务器"
  echo "  npm run server     启动后端服务器"
  echo "  npm run start      启动生产服务（托管 dist）"
  echo "  npm run serve      构建并启动生产服务"
  echo "  npm run build      构建生产版本"
  echo ""

  if [ "$CONFIGURE_DOMAIN" = "y" ]; then
    if [ "$USE_HTTPS" = "y" ]; then
      echo "部署访问地址: https://$DOMAIN"
    else
      echo "部署访问地址: http://$DOMAIN"
    fi
    echo "应用服务端口: $APP_PORT"
  else
    echo "未配置域名/Caddy，仍可使用本地或已有部署方式启动项目。"
  fi
}

print_section "ShareRoom 项目依赖安装脚本"
install_project_dependencies
prompt_domain_configuration

if [ "$CONFIGURE_DOMAIN" = "y" ]; then
  install_caddy
  configure_caddy "$DOMAIN" "$APP_PORT" "$USE_HTTPS"
fi

print_summary
