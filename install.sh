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
ACME_WEBROOT_BASE="/var/www/shareroom-certbot"
APP_PORT="3002"
CONFIGURE_DOMAIN="n"
USE_HTTPS="n"
HTTPS_PORT="443"
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

is_valid_port() {
  local value="$1"
  [[ "$value" =~ ^[0-9]+$ ]] && [ "$value" -ge 1 ] && [ "$value" -le 65535 ]
}

port_in_use() {
  local port="$1"

  if command -v ss >/dev/null 2>&1; then
    $SUDO ss -H -tln "( sport = :${port} )" | grep -q .
    return $?
  fi

  if command -v netstat >/dev/null 2>&1; then
    $SUDO netstat -tln 2>/dev/null | awk -v target=":${port}" '$4 ~ (target "$") { found=1 } END { exit(found ? 0 : 1) }'
    return $?
  fi

  print_error "未检测到 ss 或 netstat，无法检查端口占用"
  exit 1
}

describe_port_usage() {
  local port="$1"

  if command -v ss >/dev/null 2>&1; then
    $SUDO ss -H -tlnp "( sport = :${port} )" || true
    return 0
  fi

  if command -v netstat >/dev/null 2>&1; then
    $SUDO netstat -tlnp 2>/dev/null | awk -v target=":${port}" '$4 ~ (target "$")'
    return 0
  fi

  print_warning "未检测到 ss 或 netstat，无法打印端口占用详情"
}

port_used_by_nginx() {
  local port="$1"

  if command -v ss >/dev/null 2>&1; then
    $SUDO ss -H -tlnp "( sport = :${port} )" | grep -q nginx
    return $?
  fi

  if command -v netstat >/dev/null 2>&1; then
    $SUDO netstat -tlnp 2>/dev/null | awk -v target=":${port}" '$4 ~ (target "$")' | grep -q nginx
    return $?
  fi

  return 1
}

select_https_port() {
  HTTPS_PORT="443"

  if ! port_in_use 443; then
    return 0
  fi

  if port_used_by_nginx 443; then
    print_success "检测到 443 已由 Nginx 监听，将继续复用 443"
    return 0
  fi

  print_warning "检测到 443 已被非 Nginx 进程占用，请输入新的 HTTPS 端口"
  describe_port_usage 443

  while true; do
    local answer=""
    read -r -p "请输入 HTTPS 端口: " answer

    if ! is_valid_port "$answer"; then
      print_warning "请输入 1-65535 之间的有效端口"
      continue
    fi

    if [ "$answer" = "$APP_PORT" ]; then
      print_warning "HTTPS 端口不能与应用服务端口相同"
      continue
    fi

    if port_in_use "$answer"; then
      print_warning "端口 $answer 已被占用，请重新输入"
      describe_port_usage "$answer"
      continue
    fi

    HTTPS_PORT="$answer"
    return 0
  done
}

verify_https_listener() {
  local use_https="$1"

  if [ "$use_https" != "y" ]; then
    return 0
  fi

  if ! port_used_by_nginx "$HTTPS_PORT"; then
    print_error "HTTPS 端口 $HTTPS_PORT 未被 Nginx 监听，安装未完成"
    describe_port_usage "$HTTPS_PORT"
    exit 1
  fi
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

acme_webroot_path() {
  local domain="$1"
  echo "$ACME_WEBROOT_BASE/$domain"
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
    print_warning "未检测到 HTTPS 证书，后续将尝试执行 certbot certonly --webroot -w $(acme_webroot_path "$domain") -d $domain 申请证书"
  fi
}

validate_existing_nginx_config() {
  require_sudo_if_needed

  if ! command -v nginx >/dev/null 2>&1; then
    return 0
  fi

  if $SUDO nginx -t >/dev/null 2>&1; then
    print_success "现有 Nginx 全局配置校验通过"
    return 0
  fi

  print_error "检测到现有 Nginx 全局配置无效，ShareRoom 不会覆盖你的 /etc/nginx/nginx.conf"
  print_error "请先手动修复后再重试：sudo nginx -t"
  print_warning "若报错类似 unknown directive \"http2\"，通常是 nginx.conf 中用了旧版本 Nginx 不支持的 'http2 on;' 写法"
  print_warning "可改回 server 块里的 'listen 443 ssl http2;'，或升级 Nginx 后再重试"
  exit 1
}

prepare_acme_webroot() {
  local domain="$1"
  local webroot
  webroot=$(acme_webroot_path "$domain")

  require_sudo_if_needed
  $SUDO mkdir -p "$webroot"
  $SUDO chmod 755 "$ACME_WEBROOT_BASE" "$webroot"
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
    validate_existing_nginx_config
  fi

  if [ "$USE_HTTPS" = "y" ]; then
    if ! command -v certbot >/dev/null 2>&1; then
      echo ""
      echo -e "${YELLOW}[部署] 安装 certbot...${NC}"
      $SUDO apt-get update
      $SUDO apt-get install -y certbot
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
  local webroot
  webroot=$(acme_webroot_path "$domain")

  if [ "$use_https" = "y" ] && [ "$cert_ready" = "y" ]; then
    cat <<BLOCK
# BEGIN ShareRoom $domain
server {
    listen 80;
    server_name $domain;

    location /.well-known/acme-challenge/ {
        root $webroot;
    }

    location / {
        return 301 https://\$host\$request_uri;
    }
}

server {
    listen $HTTPS_PORT ssl http2;
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

    location /.well-known/acme-challenge/ {
        root $webroot;
    }

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
  local webroot
  webroot=$(acme_webroot_path "$domain")

  require_sudo_if_needed
  ensure_command certbot "错误: 未检测到 certbot，请先安装 certbot"

  if certificates_exist "$domain"; then
    print_success "已检测到 $domain 的现有证书，跳过签发"
    return 0
  fi

  prepare_acme_webroot "$domain"
  print_warning "开始为 $domain 申请 HTTPS 证书（将调用 certbot certonly --webroot -w $webroot -d $domain）..."
  $SUDO certbot certonly --webroot -w "$webroot" -d "$domain" || {
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
  prepare_acme_webroot "$domain"

  if [ "$use_https" = "y" ] && certificates_exist "$domain"; then
    cert_ready="y"
  fi

  write_nginx_site "$domain" "$app_port" "$use_https" "$cert_ready"
  enable_nginx_site "$domain"
  reload_nginx_config

  if [ "$use_https" = "y" ] && [ "$cert_ready" = "y" ]; then
    verify_https_listener "$use_https"
  fi

  if [ "$use_https" = "y" ] && [ "$cert_ready" != "y" ]; then
    request_https_certificate "$domain"
    write_nginx_site "$domain" "$app_port" "$use_https" "y"
    enable_nginx_site "$domain"
    reload_nginx_config
    verify_https_listener "$use_https"
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

  if [ "$USE_HTTPS" = "y" ]; then
    select_https_port
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
      if [ "$HTTPS_PORT" = "443" ]; then
        echo "部署访问地址: https://$DOMAIN"
      else
        echo "部署访问地址: https://$DOMAIN:$HTTPS_PORT"
      fi
      echo "HTTPS 监听端口: $HTTPS_PORT"
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
