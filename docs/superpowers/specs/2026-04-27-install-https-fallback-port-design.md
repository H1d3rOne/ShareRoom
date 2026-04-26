# install.sh HTTPS 备用端口设计

## 背景

当前 `install.sh` 在启用 HTTPS 时默认假设 Nginx 能监听 `443`。但线上实际存在另一类环境：

- 服务器已运行其他业务
- `443` 被非 Nginx 进程占用（例如 `xray`）
- `certbot --webroot` 仍可在 `80` 端口成功签发证书
- 脚本最终却可能在 `443` 未被 Nginx 接管的情况下输出“配置完成”，形成假成功

本次变更目标是在不破坏现有交互式安装体验的前提下，让 `install.sh` 在 `443` 被占用时支持人工输入备用 HTTPS 端口，并在安装完成后做真实监听校验。

## 目标

- 默认仍优先使用 `443`
- 当 `443` 被**非 Nginx 进程**占用时，提示用户输入 HTTPS 备用端口
- 最终允许通过 `https://<domain>:<https_port>` 访问
- 证书签发继续使用 `80` 端口的 ACME webroot，不依赖 HTTPS 端口
- 避免“脚本输出成功，但实际 HTTPS 不可用”的假成功状态

## 非目标

- 不自动扫描和分配备用端口
- 不修改现有 `start.sh` / `stop.sh` 服务管理逻辑
- 不接管或停止占用 `443` 的第三方进程
- 不处理多域名、多站点共享单个证书的复杂场景

## 用户交互设计

### 现有流程保留

安装脚本仍先询问：

1. 是否配置域名
2. 域名
3. 是否启用 HTTPS
4. 应用服务端口（默认 `3002`）

### 新增 HTTPS 端口选择流程

仅在以下条件同时满足时触发：

- `CONFIGURE_DOMAIN = y`
- `USE_HTTPS = y`
- `443` 被占用，且占用方不是 Nginx

触发后脚本行为：

1. 打印 `443` 当前占用信息
2. 提示用户输入新的 HTTPS 端口
3. 校验端口是否合法且未占用
4. 校验通过后将该端口作为本次部署的 `HTTPS_PORT`

### 端口输入规则

用户输入的 HTTPS 端口必须满足：

- 整数
- 范围 `1-65535`
- 不等于应用服务端口 `APP_PORT`
- 未被其他进程监听

如果校验失败，脚本循环提示重新输入。

## 配置生成设计

### 新增变量

脚本新增：

- `HTTPS_PORT="443"`

其用途：

- 默认值为 `443`
- 仅在 `443` 被非 Nginx 进程占用时改写为用户输入值

### Nginx 站点配置

#### HTTP 站点

`80` 端口逻辑保持不变：

- 用于 `/.well-known/acme-challenge/`
- HTTPS 已启用时用于重定向到 HTTPS

#### HTTPS 站点

由原来的：

```nginx
listen 443 ssl http2;
```

改为：

```nginx
listen <HTTPS_PORT> ssl http2;
```

因此：

- `443` 可用时，行为与现在一致
- `443` 不可用时，例如监听 `8443`，最终地址为 `https://domain:8443`

## 证书申请设计

证书申请继续沿用当前实现：

```bash
certbot certonly --webroot -w <webroot> -d <domain>
```

原因：

- ACME HTTP-01 challenge 走 `80` 端口
- 与最终 HTTPS 监听端口无关
- 因此备用 HTTPS 端口不会影响签证书

## 校验与保护

### 安装前校验

新增 `443` 监听状态检查：

- 若 `443` 空闲：直接使用 `443`
- 若 `443` 被 Nginx 占用：允许继续使用 `443`
- 若 `443` 被非 Nginx 进程占用：进入备用端口输入流程

### 安装后校验

在 `reload_nginx_config` 成功之后，增加 HTTPS 端口监听校验：

- 目标端口是否已被 Nginx 监听
- 如果未被 Nginx 监听，则直接报错退出

这个校验用于阻止以下情况被误判为成功：

- Nginx 配置文件语法正确
- Nginx reload 成功
- 但目标 HTTPS 端口仍由其他进程占用，或根本没被 Nginx 接管

## 摘要输出设计

安装完成摘要改为根据最终 `HTTPS_PORT` 输出：

- `443` 时：
  - `部署访问地址: https://domain`
- 非 `443` 时：
  - `部署访问地址: https://domain:https_port`

并额外输出：

- `HTTPS 监听端口: <HTTPS_PORT>`

## 实现建议

建议增加以下辅助函数：

- `is_valid_port()`：校验端口格式与范围
- `port_in_use()`：检查端口是否被监听
- `port_used_by_nginx()`：检查指定端口是否由 Nginx 监听
- `describe_port_usage()`：打印端口占用信息
- `select_https_port()`：处理 `443` 检查与备用端口输入逻辑
- `verify_https_listener()`：reload 后校验目标 HTTPS 端口是否由 Nginx 接管

## 测试场景

至少验证以下场景：

1. `443` 空闲，启用 HTTPS
   - 应继续监听 `443`
   - 摘要显示 `https://domain`

2. `443` 被非 Nginx 进程占用，启用 HTTPS
   - 应提示输入备用端口
   - 输入合法空闲端口后成功安装
   - 摘要显示 `https://domain:port`

3. 输入非法端口
   - 提示并重新输入

4. 输入已占用端口
   - 提示并重新输入

5. 输入与 `APP_PORT` 相同端口
   - 提示并重新输入

6. reload 后目标 HTTPS 端口未被 Nginx 监听
   - 脚本必须报错退出
   - 不得打印“配置完成”成功结论

## 风险与兼容性

### 风险

- 某些旧版 Nginx 仍会对 `listen ... http2` 给出 deprecated warning，但不影响本次端口逻辑
- 某些环境下端口占用检测依赖 `ss` / `netstat`，实现时要优先选择系统常见工具

### 兼容性

- 对现有默认场景兼容：`443` 空闲时行为几乎不变
- 对已有 HTTP-only 部署兼容：不启用 HTTPS 时不触发新逻辑
- 对已有非 ShareRoom 业务兼容：脚本只检测占用，不主动停止其他服务
