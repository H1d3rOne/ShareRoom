# 多人共享卡住恢复设计

## 背景
线上多人房间中，部分成员会出现共享区域进度在同步，但画面卡住不动的问题。当前架构为 WebRTC mesh + Socket.IO 信令 + DataChannel 文件共享/恢复辅助。

## 已确认根因
1. 数据通道异常关闭后会调用 `ensureDataChannel()` 重建，但没有显式触发重协商，导致新建 channel 可能未真正协商到对端。
2. 远端流目录 `peerStreamCatalog` 会保留旧流；共享流重绑时没有优先筛选 live track，可能重新绑定到已失活的旧流。
3. 连接进入 `disconnected/failed` 时缺少针对共享流的轻量恢复动作。

## 目标
- 数据通道异常重建后能立即完成必要重协商
- 共享流重绑时优先选择 live track，避免绑到 dead stream
- 在多人弱网/抖动下，提高共享画面恢复成功率
- 保持最小侵入，不引入 SFU 级架构改造

## 方案 A
1. DataChannel 重建路径增加 `queueSharedNegotiation(peerId)`。
2. 增加 peer stream 清理与 live track 判断：
   - 新增 `isLiveStreamCandidate()`
   - 新增 `prunePeerStreams()`
   - `pickPrimaryPeerStream()` / `tryBindSharedIncomingStream()` 优先 live stream
3. `pc.onconnectionstatechange` 在 `disconnected` / `failed` 时执行轻量共享恢复：
   - 尝试清理旧流目录
   - 若当前共享来自该 peer，则重绑 incoming stream
   - 请求一次 share sync
4. 补测试覆盖上述行为约束。

## 风险控制
- 不修改现有权限模型
- 不改动整体信令协议，仅增强恢复时机
- 通过现有测试 + 新回归测试验证
