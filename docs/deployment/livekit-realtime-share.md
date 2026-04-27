# LiveKit 实时共享部署说明

ShareRoom 的实时屏幕共享 / 标签页共享支持通过 LiveKit 接入 SFU。

## 环境变量

```bash
LIVEKIT_URL=wss://your-livekit-host
LIVEKIT_API_KEY=your-api-key
LIVEKIT_API_SECRET=your-api-secret
```

## 使用方式

- `install.sh`、`start.sh`、`start_dev.sh` 都会透传以上环境变量。
- 未配置时，实时共享会保持禁用或回退，不影响房间基础功能。
- 配置完成后，前端会通过 `/api/realtime-share/config` 和 `/api/realtime-share/token` 获取接入参数。

## 示例

```bash
export LIVEKIT_URL=wss://livekit.example.com
export LIVEKIT_API_KEY=lk_key
export LIVEKIT_API_SECRET=lk_secret
./start.sh
```
