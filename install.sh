#!/bin/bash

set -u

GREEN="\033[0;32m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
NC="\033[0m"

PROJECT_ROOT=$(cd "$(dirname "$0")" && pwd)
NGINX_SITES_AVAILABLE_DIR="/etc/nginx/sites-available"
NGINX_SITES_ENABLED_DIR="/etc/nginx/sites-enabled"
CERTBOT_CERT_DIR="/etc/letsencrypt/live"
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

site_file_path() {
  local domain="$1"
  echo "$NGINX_SITES_AVAILABLE_DIR/$domain"
}

site_link_path() {
  local domain="$1"
  echo "$NGINX_SITES_ENABLED_DIR/$domain"
}

fullchain_path() {
  local domain="$1"
  echo "$CERTBOT_CERT_DIR/$domain/fullchain.pem"
}

privkey_path() {
  local domain="$1"
  echo "$CERTBOT_CERT_DIR/$domain/privkey.pem"
}

certificates_exist() {
  local domain="$1"
  [ -f "$(fullchain_path "$domain")" ] && [ -f "$(privkey_path "$domain")" ]
}

describe_nginx_site_status() {
  local domain="$1"
  local site_file
  local site_link
  site_file=$(site_file_path "$domain")
  site_link=$(site_link_path "$domain")

  if [ -f "$site_file" ]; then
    if grep -q '^# BEGIN ShareRoom ' "$site_file" 2>/dev/null; then
      print_warning "检测到 ShareRoom 站点配置已存在: $site_file，将在备份后覆盖更新"
    else
      print_warning "检测到站点配置已存在: $site_file，将在备份后按 ShareRoom 配置覆盖"
    fi
  else
    print_success "未检测到现有站点配置，将创建: $site_file"
  fi

  if [ -L "$site_link" ] || [ -f "$site_link" ]; then
    print_warning "检测到 Nginx 启用链接已存在: $site_link，将复用并更新"
  else
    print_success "未检测到 Nginx 启用链接，将创建: $site_link"
  fi
}

describe_certificate_status() {
  local domain="$1"

  if certificates_exist "$domain"; then
    print_success "检测到 HTTPS 证书已存在，将直接复用: $(fullchain_path "$domain")"
  else
    print_warning "未检测到 HTTPS 证书，后续将尝试执行 certbot --nginx -d $domain 申请证书"
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

install_nginx_stack() {
  require_sudo_if_needed

  if ! command -v apt-get >/dev/null 2>&1; then
    print_error "当前系统不是 apt 系发行版，暂未集成自动安装 Nginx / certbot，请手动安装后重试"
    exit 1
  fi

  if ! command -v nginx >/dev/null 2>&1; then
    echo ""
    echo -e "${YELLOW}[部署] 安装 Nginx...${NC}"
    $SUDO apt-get update
    $SUDO apt-get install -y nginx
    print_success "Nginx 安装完成"
  else
    print_success "已检测到 Nginx，跳过安装"
  fi

  if [ "$USE_HTTPS" = "y" ]; then
    if ! command -v certbot >/dev/null 2>&1; then
      echo ""
      echo -e "${YELLOW}[部署] 安装 certbot...${NC}"
      $SUDO apt-get update
      $SUDO apt-get install -y certbot python3-certbot-nginx
      print_success "certbot 安装完成"
    else
      print_success "已检测到 certbot，跳过安装"
    fi
  fi
}

backup_nginx_site() {
  local domain="$1"
  local site_file
  site_file=$(site_file_path "$domain")

  require_sudo_if_needed

  if [ -f "$site_file" ]; then
    local backup_path="${site_file}.bak.$(date +%Y%m%d%H%M%S)"
    $SUDO cp "$site_file" "$backup_path"
    print_success "已备份现有 Nginx 站点配置 -> $backup_path"
  fi
}

render_proxy_location() {
  local app_port="$1"

  cat <<BLOCK
    location / {
        proxy_pass http://127.0.0.1:$app_port;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 3600;
        proxy_send_timeout 3600;
    }
BLOCK
}

render_nginx_config() {
  local domain="$1"
  local app_port="$2"
  local use_https="$3"
  local cert_ready="$4"

  if [ "$use_https" = "y" ] && [ "$cert_ready" = "y" ]; then
    cat <<BLOCK
# BEGIN ShareRoom $domain
server {
    listen 80;
    server_name $domain;
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name $domain;
    ssl_certificate $(fullchain_path "$domain");
    ssl_certificate_key $(privkey_path "$domain");
$(render_proxy_location "$app_port")
}
# END ShareRoom $domain
BLOCK
  else
    cat <<BLOCK
# BEGIN ShareRoom $domain
server {
    listen 80;
    server_name $domain;
$(render_proxy_location "$app_port")
}
# END ShareRoom $domain
BLOCK
  fi
}

write_nginx_site() {
  local domain="$1"
  local app_port="$2"
  local use_https="$3"
  local cert_ready="$4"
  local site_file
  site_file=$(site_file_path "$domain")

  local temp_file
  temp_file=$(mktemp)
  render_nginx_config "$domain" "$app_port" "$use_https" "$cert_ready" > "$temp_file"

  $SUDO mkdir -p "$NGINX_SITES_AVAILABLE_DIR" "$NGINX_SITES_ENABLED_DIR"
  $SUDO cp "$temp_file" "$site_file"
  rm -f "$temp_file"
}

enable_nginx_site() {
  local domain="$1"
  local site_file
  local site_link
  site_file=$(site_file_path "$domain")
  site_link=$(site_link_path "$domain")

  $SUDO ln -sfn "$site_file" "$site_link"
}

reload_nginx_config() {
  require_sudo_if_needed

  if ! command -v nginx >/dev/null 2>&1; then
    print_error "未检测到 Nginx，无法校验并重载配置"
    exit 1
  fi

  $SUDO nginx -t || {
    print_error "Nginx 配置校验失败"
    exit 1
  }

  if command -v systemctl >/dev/null 2>&1; then
    $SUDO systemctl reload nginx || {
      print_error "Nginx 重载失败"
      exit 1
    }
  else
    $SUDO nginx -s reload || {
      print_error "Nginx 重载失败"
      exit 1
    }
  fi
}

request_https_certificate() {
  local domain="$1"

  require_sudo_if_needed
  ensure_command certbot "错误: 未检测到 certbot，请先安装 certbot"

  if certificates_exist "$domain"; then
    print_success "已检测到 $domain 的现有证书，跳过签发"
    return 0
  fi

  print_warning "开始为 $domain 申请 HTTPS 证书（将调用 certbot --nginx -d $domain）..."
  $SUDO certbot --nginx -d "$domain" || {
    print_error "certbot 申请证书失败，请根据提示手动处理后重试"
    exit 1
  }

  if ! certificates_exist "$domain"; then
    print_error "证书申请完成后未找到证书文件，请手动检查 certbot 状态"
    exit 1
  fi
}

configure_nginx() {
  local domain="$1"
  local app_port="$2"
  local use_https="$3"
  local cert_ready="n"

  require_sudo_if_needed
  describe_nginx_site_status "$domain"
  if [ "$use_https" = "y" ]; then
    describe_certificate_status "$domain"
  fi
  backup_nginx_site "$domain"

  if [ "$use_https" = "y" ] && certificates_exist "$domain"; then
    cert_ready="y"
  fi

  write_nginx_site "$domain" "$app_port" "$use_https" "$cert_ready"
  enable_nginx_site "$domain"
  reload_nginx_config

  if [ "$use_https" = "y" ] && [ "$cert_ready" != "y" ]; then
    request_https_certificate "$domain"
    write_nginx_site "$domain" "$app_port" "$use_https" "y"
    enable_nginx_site "$domain"
    reload_nginx_config
  fi

  print_success "Nginx 配置完成: $domain"
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
      print_warning "请输入有效域名，例如 room.thanhthao.us.ci"
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
      echo "HTTPS 入口: Nginx 固定监听 443"
    else
      echo "部署访问地址: http://$DOMAIN"
    fi
    echo "应用服务端口: $APP_PORT"
    echo "Nginx 反代目标: http://127.0.0.1:$APP_PORT"
  else
    echo "未配置域名/Nginx，仍可使用本地或已有部署方式启动项目。"
  fi
}

print_section "ShareRoom 项目依赖安装脚本（Nginx 模式）"
install_project_dependencies
prompt_domain_configuration

if [ "$CONFIGURE_DOMAIN" = "y" ]; then
  install_nginx_stack
  configure_nginx "$DOMAIN" "$APP_PORT" "$USE_HTTPS"
fi

print_summary
