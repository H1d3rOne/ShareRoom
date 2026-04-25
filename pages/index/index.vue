<template>
  <div class="container">
    <div class="ambient ambient-left"></div>
    <div class="ambient ambient-right"></div>
    <div class="ambient ambient-top"></div>

    <main class="landing">
      <section class="hero-copy">
        <div class="hero-badge-row">
          <p class="eyebrow">ShareRoom</p>
          <span class="hero-status">共享协作空间</span>
        </div>

        <h1 class="title">把共享、语音、远控和轻游戏，放进同一个房间。</h1>
        <p class="subtitle">
          进入前先确定你的身份。昵称和头像会同步到聊天、视频、共享舞台和游戏席位里，重新加入时也会自动沿用。
        </p>

        <div class="hero-metrics">
          <article class="hero-point">
            <strong>实时共享</strong>
            <span>图片、视频、屏幕内容在房间内同步展示，适合边聊边看。</span>
          </article>
          <article class="hero-point">
            <strong>统一身份</strong>
            <span>头像和昵称会贯穿消息、成员区、视频流与游戏座位。</span>
          </article>
          <article class="hero-point">
            <strong>轻量娱乐</strong>
            <span>五子棋、斗地主等互动玩法直接在共享区域展开。</span>
          </article>
          <article class="hero-point">
            <strong>资料记忆</strong>
            <span>下次进入时，自动恢复你上一次使用的房间身份。</span>
          </article>
        </div>

        <div class="showcase-grid">
          <article class="showcase-card identity-card">
            <span class="card-kicker">当前身份</span>
            <div class="identity-main">
              <UserAvatar :avatar-id="selectedAvatarId" :name="previewDisplayName" :size="84" />
              <div class="identity-copy">
                <strong>{{ previewDisplayName }}</strong>
                <span>{{ selectedAvatarPreset.name }} 头像风格</span>
              </div>
            </div>
            <div class="identity-tags">
              <span class="identity-tag">消息展示</span>
              <span class="identity-tag">视频标签</span>
              <span class="identity-tag">游戏席位</span>
            </div>
          </article>

          <article class="showcase-card feature-card">
            <span class="card-kicker">房间体验</span>
            <div class="feature-list">
              <div class="feature-item">
                <span class="feature-dot blue"></span>
                <div>
                  <strong>共享舞台</strong>
                  <p>共享内容、远程指针和房间内游戏统一在主舞台区域呈现。</p>
                </div>
              </div>
              <div class="feature-item">
                <span class="feature-dot rose"></span>
                <div>
                  <strong>一体化沟通</strong>
                  <p>消息输入旁边直接控制麦克风、听筒和摄像头，交互路径更短。</p>
                </div>
              </div>
              <div class="feature-item">
                <span class="feature-dot orange"></span>
                <div>
                  <strong>房间内对战</strong>
                  <p>邀请成员即可开局，游戏结束后可从共享区域即时关闭窗口。</p>
                </div>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section class="profile-panel">
        <div class="panel-head">
          <div>
            <span class="panel-kicker">Room Identity</span>
            <h2 class="panel-title">设置你的房间身份</h2>
          </div>
          <span class="panel-badge">1 分钟完成</span>
        </div>

        <div class="profile-preview">
          <UserAvatar :avatar-id="selectedAvatarId" :name="previewDisplayName" :size="96" />
          <div class="profile-preview-copy">
            <span class="preview-label">已选身份</span>
            <strong>{{ previewDisplayName }}</strong>
            <span>进入房间后，这个身份会出现在成员列表、消息与游戏座位里。</span>
          </div>
          <div class="preview-stack" aria-hidden="true">
            <span
              v-for="preset in AVATAR_PRESETS.slice(0, 4)"
              :key="preset.id"
              class="preview-stack-item"
              :class="{ active: preset.id === selectedAvatarId }"
            >
              <UserAvatar :avatar-id="preset.id" :name="preset.name" :size="34" />
            </span>
          </div>
        </div>

        <div class="field-group">
          <label class="field-label" for="displayName">房间昵称</label>
          <input
            id="displayName"
            v-model="displayName"
            class="text-input"
            maxlength="20"
            placeholder="输入你的昵称"
            @blur="normalizeDraftProfile"
          />
          <p class="field-helper">最多 20 个字符，会显示在消息、成员列表和视频标签中。</p>
        </div>

        <div class="field-group">
          <div class="field-row">
            <div class="field-label">默认头像</div>
            <span class="field-caption">选择更适合你风格的角色形象</span>
          </div>
          <div class="avatar-grid">
            <button
              v-for="preset in AVATAR_PRESETS"
              :key="preset.id"
              type="button"
              class="avatar-option"
              :class="{ active: selectedAvatarId === preset.id }"
              @click="selectedAvatarId = preset.id"
            >
              <UserAvatar :avatar-id="preset.id" :name="preset.name" :size="60" />
              <span>{{ preset.name }}</span>
            </button>
          </div>
        </div>

        <div class="action-panel">
          <button class="btn create-btn" @click="createRoom">
            <span>创建新房间</span>
            <small>生成独立房间号，立即进入房间主舞台</small>
          </button>

          <div class="join-panel">
            <div class="join-panel-header">
              <div>
                <label class="field-label" for="roomId">加入现有房间</label>
                <p class="field-helper">输入房间 ID，沿用当前头像与昵称加入。</p>
              </div>
              <span class="join-pill">Quick Join</span>
            </div>
            <div class="join-row">
              <input
                id="roomId"
                v-model="roomId"
                class="text-input room-input"
                placeholder="例如 120301"
                @keyup.enter="joinRoom"
              />
              <button class="btn join-btn" @click="joinRoom">加入房间</button>
            </div>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import UserAvatar from '../../components/UserAvatar.vue'
import { AVATAR_PRESETS, ensureStoredUserProfile, normalizeDisplayName, saveStoredUserProfile } from '../../utils/userProfile'

const router = useRouter()
const roomId = ref('')
const storedProfile = ensureStoredUserProfile()
const displayName = ref(storedProfile.displayName)
const selectedAvatarId = ref(storedProfile.avatarId)

const previewDisplayName = computed(() => {
  const trimmed = `${displayName.value || ''}`.trim()
  return trimmed || storedProfile.displayName
})

const selectedAvatarPreset = computed(() => {
  return AVATAR_PRESETS.find((item) => item.id === selectedAvatarId.value) || AVATAR_PRESETS[0]
})

function normalizeDraftProfile() {
  displayName.value = normalizeDisplayName(displayName.value)
}

function persistProfile() {
  const nextProfile = saveStoredUserProfile({
    displayName: displayName.value,
    avatarId: selectedAvatarId.value
  })

  displayName.value = nextProfile.displayName
  selectedAvatarId.value = nextProfile.avatarId
  return nextProfile
}

const createRoom = () => {
  persistProfile()
  const newRoomId = Math.floor(Math.random() * 1000000).toString().padStart(6, '0')

  router.push({
    path: `/room/${newRoomId}`,
    query: { isCreator: true }
  })
}

const joinRoom = () => {
  if (!roomId.value.trim()) {
    alert('请输入房间ID')
    return
  }

  persistProfile()

  router.push({
    path: `/room/${roomId.value.trim()}`,
    query: { isCreator: false }
  })
}
</script>

<style scoped>
.container {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
  color: var(--text-primary);
  padding: 32px;
}

.ambient {
  position: absolute;
  border-radius: 999px;
  filter: blur(72px);
  opacity: 0.44;
  pointer-events: none;
}

.ambient-left {
  width: 320px;
  height: 320px;
  left: -72px;
  top: 10%;
  background: rgba(59, 130, 246, 0.22);
}

.ambient-right {
  width: 360px;
  height: 360px;
  right: -120px;
  bottom: 5%;
  background: rgba(225, 29, 72, 0.18);
}

.ambient-top {
  width: 240px;
  height: 240px;
  top: -60px;
  left: 48%;
  background: rgba(249, 115, 22, 0.14);
}

.landing {
  position: relative;
  z-index: 1;
  min-height: calc(100vh - 64px);
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(380px, 500px);
  gap: 28px;
  align-items: center;
}

.hero-copy {
  max-width: 680px;
}

.hero-badge-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.eyebrow {
  margin: 0;
  padding: 10px 14px;
  border-radius: 999px;
  background: rgba(59, 130, 246, 0.14);
  border: 1px solid rgba(96, 165, 250, 0.2);
  color: #dbeafe;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.24em;
  text-transform: uppercase;
}

.hero-status {
  padding: 10px 14px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(167, 185, 210, 0.14);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 600;
}

.title {
  margin: 24px 0 0;
  max-width: 760px;
  color: #ffffff;
  font-family: var(--font-display);
  font-size: clamp(42px, 5vw, 74px);
  line-height: 0.96;
  letter-spacing: -0.05em;
}

.subtitle {
  max-width: 590px;
  margin: 22px 0 0;
  color: var(--text-secondary);
  font-size: 18px;
  line-height: 1.7;
}

.hero-metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin-top: 34px;
}

.hero-point {
  min-height: 116px;
  padding: 20px;
  border-radius: 24px;
  background: linear-gradient(180deg, rgba(7, 14, 25, 0.88), rgba(12, 22, 38, 0.72));
  border: 1px solid rgba(167, 185, 210, 0.12);
  backdrop-filter: blur(20px);
  box-shadow: var(--shadow-soft);
}

.hero-point strong {
  display: block;
  color: #ffffff;
  font-size: 16px;
  margin-bottom: 10px;
}

.hero-point span {
  color: var(--text-muted);
  font-size: 14px;
  line-height: 1.7;
}

.showcase-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.06fr);
  gap: 16px;
  margin-top: 20px;
}

.showcase-card {
  padding: 22px;
  border-radius: 28px;
  border: 1px solid rgba(167, 185, 210, 0.14);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.07), rgba(255, 255, 255, 0.03)),
    rgba(7, 14, 25, 0.72);
  box-shadow: var(--shadow-soft);
  backdrop-filter: blur(20px);
}

.card-kicker {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 0 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.identity-main {
  display: flex;
  align-items: center;
  gap: 18px;
  margin-top: 18px;
}

.identity-copy strong {
  display: block;
  color: #ffffff;
  font-size: 24px;
  line-height: 1.08;
}

.identity-copy span {
  display: block;
  margin-top: 8px;
  color: var(--text-secondary);
  font-size: 14px;
}

.identity-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 18px;
}

.identity-tag {
  padding: 8px 12px;
  border-radius: 999px;
  background: rgba(59, 130, 246, 0.12);
  color: #dbeafe;
  font-size: 12px;
  font-weight: 600;
}

.feature-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-top: 18px;
}

.feature-item {
  display: grid;
  grid-template-columns: 12px minmax(0, 1fr);
  gap: 14px;
  align-items: flex-start;
}

.feature-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  margin-top: 7px;
  box-shadow: 0 0 0 6px rgba(255, 255, 255, 0.04);
}

.feature-dot.blue {
  background: #60a5fa;
}

.feature-dot.rose {
  background: #fb7185;
}

.feature-dot.orange {
  background: #fb923c;
}

.feature-item strong {
  display: block;
  color: #ffffff;
  font-size: 15px;
}

.feature-item p {
  margin-top: 6px;
  color: var(--text-muted);
  font-size: 14px;
  line-height: 1.7;
}

.profile-panel {
  padding: 28px;
  border-radius: 32px;
  background:
    radial-gradient(circle at top right, rgba(225, 29, 72, 0.12), transparent 30%),
    linear-gradient(180deg, rgba(8, 15, 28, 0.9), rgba(10, 20, 36, 0.78));
  border: 1px solid rgba(167, 185, 210, 0.14);
  backdrop-filter: blur(24px);
  box-shadow: var(--shadow-strong);
}

.panel-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 22px;
}

.panel-kicker {
  display: block;
  color: #fb7185;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.panel-title {
  margin-top: 10px;
  font-family: var(--font-display);
  font-size: 30px;
  line-height: 1.02;
  letter-spacing: -0.04em;
}

.panel-badge {
  flex: 0 0 auto;
  padding: 9px 12px;
  border-radius: 999px;
  background: rgba(249, 115, 22, 0.14);
  color: #fed7aa;
  font-size: 12px;
  font-weight: 700;
}

.profile-preview {
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 18px;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(167, 185, 210, 0.12);
}

.preview-label {
  display: inline-flex;
  margin-bottom: 10px;
  color: #dbeafe;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.profile-preview-copy strong {
  display: block;
  color: #ffffff;
  font-size: 24px;
}

.profile-preview-copy span:last-child {
  display: block;
  margin-top: 8px;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.7;
}

.preview-stack {
  margin-left: auto;
  display: flex;
  align-items: center;
}

.preview-stack-item {
  display: inline-flex;
  padding: 4px;
  margin-left: -8px;
  border-radius: 999px;
  background: rgba(8, 15, 28, 0.9);
  border: 1px solid rgba(167, 185, 210, 0.1);
  transition: transform 0.22s ease, border-color 0.22s ease, box-shadow 0.22s ease;
}

.preview-stack-item.active {
  transform: translateY(-4px);
  border-color: rgba(96, 165, 250, 0.36);
  box-shadow: 0 16px 28px rgba(37, 99, 235, 0.16);
}

.field-group {
  margin-top: 22px;
}

.field-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 12px;
}

.field-label {
  display: block;
  color: #dbeafe;
  font-size: 13px;
  font-weight: 600;
}

.field-caption,
.field-helper {
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.6;
}

.field-helper {
  margin-top: 10px;
}

.text-input {
  width: 100%;
  min-height: 54px;
  border: 1px solid rgba(167, 185, 210, 0.18);
  border-radius: 18px;
  background: rgba(7, 14, 25, 0.58);
  color: #ffffff;
  padding: 0 16px;
  font-size: 15px;
  transition: border-color 0.22s ease, box-shadow 0.22s ease, background 0.22s ease, transform 0.22s ease;
}

.text-input:focus {
  outline: none;
  border-color: rgba(96, 165, 250, 0.52);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.16);
  background: rgba(11, 20, 34, 0.88);
  transform: translateY(-1px);
}

.avatar-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.avatar-option {
  min-height: 122px;
  border: 1px solid rgba(167, 185, 210, 0.14);
  border-radius: 22px;
  background: linear-gradient(180deg, rgba(7, 14, 25, 0.66), rgba(15, 23, 42, 0.44));
  padding: 14px 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: transform 0.22s ease, border-color 0.22s ease, box-shadow 0.22s ease, background 0.22s ease;
}

.avatar-option:hover {
  transform: translateY(-3px);
  border-color: rgba(96, 165, 250, 0.26);
  background: linear-gradient(180deg, rgba(8, 15, 28, 0.82), rgba(19, 30, 50, 0.62));
  box-shadow: 0 20px 36px rgba(2, 8, 23, 0.22);
}

.avatar-option.active {
  border-color: rgba(96, 165, 250, 0.54);
  background:
    radial-gradient(circle at top, rgba(96, 165, 250, 0.16), transparent 50%),
    rgba(10, 19, 34, 0.86);
  box-shadow: inset 0 0 0 1px rgba(96, 165, 250, 0.18), 0 18px 34px rgba(37, 99, 235, 0.14);
}

.avatar-option span {
  font-size: 12px;
  font-weight: 700;
}

.action-panel {
  margin-top: 26px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.join-panel {
  padding: 18px;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(167, 185, 210, 0.12);
}

.join-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 14px;
  margin-bottom: 14px;
}

.join-panel-header .field-helper {
  margin-top: 8px;
}

.join-pill {
  flex: 0 0 auto;
  padding: 8px 12px;
  border-radius: 999px;
  background: rgba(59, 130, 246, 0.14);
  color: #dbeafe;
  font-size: 12px;
  font-weight: 700;
}

.join-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
}

.btn {
  border: none;
  border-radius: 18px;
  padding: 15px 18px;
  color: #fff;
  cursor: pointer;
  font-size: 15px;
  font-weight: 600;
  transition: transform 0.22s ease, filter 0.22s ease, box-shadow 0.22s ease;
}

.btn:hover {
  transform: translateY(-2px);
  filter: brightness(1.04);
}

.create-btn {
  min-height: 82px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 6px;
  background: linear-gradient(135deg, #2563eb, #7c3aed);
  box-shadow: 0 24px 48px rgba(37, 99, 235, 0.26);
}

.create-btn span,
.join-btn {
  font-weight: 700;
}

.create-btn small {
  color: rgba(255, 255, 255, 0.82);
  font-size: 13px;
  font-weight: 500;
}

.join-btn {
  min-width: 132px;
  background: linear-gradient(135deg, #f97316, #e11d48);
  box-shadow: 0 20px 42px rgba(225, 29, 72, 0.22);
}

.btn:focus-visible,
.avatar-option:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.24);
}

@media (max-width: 1024px) {
  .landing {
    grid-template-columns: 1fr;
    align-items: start;
  }

  .hero-copy {
    max-width: none;
  }

  .showcase-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .container {
    padding: 18px;
  }

  .landing {
    min-height: auto;
    gap: 20px;
  }

  .hero-metrics,
  .avatar-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .panel-head,
  .field-row,
  .join-panel-header {
    flex-direction: column;
  }

  .profile-preview {
    flex-direction: column;
    align-items: flex-start;
  }

  .preview-stack {
    margin-left: 0;
  }

  .join-row {
    grid-template-columns: 1fr;
  }

  .join-btn {
    width: 100%;
  }
}

@media (max-width: 560px) {
  .title {
    font-size: 38px;
  }

  .hero-metrics,
  .avatar-grid {
    grid-template-columns: 1fr;
  }

  .showcase-card,
  .profile-panel {
    padding: 20px;
  }
}
</style>
