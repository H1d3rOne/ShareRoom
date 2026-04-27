<template>
  <div class="container">
    <div class="ambient ambient-left"></div>
    <div class="ambient ambient-right"></div>
    <div class="ambient ambient-top"></div>
    <div class="ambient ambient-accent"></div>

    <main class="landing">
      <section class="hero-copy">
        <div class="hero-badge-row">
          <span class="eyebrow">ShareRoom</span>
          <span class="hero-status">共享协作空间</span>
        </div>

        <h1 class="title">
          <span class="title-line">共享、语音、远控</span>
          <span class="title-line accent">与轻游戏</span>
          <span class="title-line">同一房间</span>
        </h1>
        <p class="subtitle">
          进入前确定你的身份。昵称和头像会贯穿聊天、视频、共享舞台与游戏席位，重新加入时自动沿用。
        </p>

        <div class="hero-metrics">
          <article class="hero-point">
            <div class="hero-point-icon blue">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="3"/><path d="m8 21 4-4 4 4"/></svg>
            </div>
            <strong>实时共享</strong>
            <span>图片、视频、屏幕内容在房间内同步展示</span>
          </article>
          <article class="hero-point">
            <div class="hero-point-icon rose">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>
            <strong>统一身份</strong>
            <span>头像和昵称贯穿消息、成员区与游戏座位</span>
          </article>
          <article class="hero-point">
            <div class="hero-point-icon orange">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
            </div>
            <strong>轻量娱乐</strong>
            <span>五子棋等互动玩法直接在共享区域展开</span>
          </article>
          <article class="hero-point">
            <div class="hero-point-icon gold">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
            </div>
            <strong>资料记忆</strong>
            <span>下次进入自动恢复上一次的房间身份</span>
          </article>
        </div>
      </section>

      <section class="profile-panel">
        <div class="panel-head">
          <div>
            <span class="panel-kicker">Room Identity</span>
            <h2 class="panel-title">设置房间身份</h2>
          </div>
          <span class="panel-badge">1 分钟</span>
        </div>

        <div class="profile-preview">
          <UserAvatar :avatar-id="selectedAvatarId" :name="previewDisplayName" :size="72" />
          <div class="profile-preview-copy">
            <span class="preview-label">已选身份</span>
            <strong>{{ previewDisplayName }}</strong>
            <span>进入房间后，身份会出现在成员列表、消息与游戏座位</span>
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
          <p class="field-helper">最多 20 个字符，显示在消息、成员列表和视频标签中</p>
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
              <UserAvatar :avatar-id="preset.id" :name="preset.name" :size="52" />
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
                <p class="field-helper">输入房间 ID，沿用当前头像与昵称加入</p>
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
  padding: 40px 48px;
}

.ambient {
  position: absolute;
  border-radius: 999px;
  filter: blur(100px);
  opacity: 0.35;
  pointer-events: none;
}

.ambient-left {
  width: 400px;
  height: 400px;
  left: -100px;
  top: 8%;
  background: rgba(59, 130, 246, 0.2);
}

.ambient-right {
  width: 360px;
  height: 360px;
  right: -80px;
  bottom: 8%;
  background: rgba(225, 29, 72, 0.14);
}

.ambient-top {
  width: 280px;
  height: 280px;
  top: -80px;
  left: 45%;
  background: rgba(249, 115, 22, 0.1);
}

.ambient-accent {
  width: 200px;
  height: 200px;
  bottom: 20%;
  left: 30%;
  background: rgba(202, 138, 4, 0.08);
}

.landing {
  position: relative;
  z-index: 1;
  min-height: calc(100vh - 80px);
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(400px, 480px);
  gap: 48px;
  align-items: center;
}

.hero-copy {
  max-width: 680px;
}

.hero-badge-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.eyebrow {
  padding: 8px 16px;
  border-radius: 999px;
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(96, 165, 250, 0.15);
  color: #93c5fd;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.2em;
  text-transform: uppercase;
}

.hero-status {
  padding: 8px 14px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(167, 185, 210, 0.1);
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.title {
  margin: 32px 0 0;
  max-width: 680px;
  font-family: var(--font-display);
  font-size: clamp(44px, 5.2vw, 72px);
  line-height: 1.02;
  letter-spacing: -0.04em;
  color: #ffffff;
}

.title-line {
  display: block;
}

.title-line.accent {
  background: linear-gradient(135deg, #60a5fa, #a78bfa, #f0abfc);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.subtitle {
  max-width: 520px;
  margin: 24px 0 0;
  color: var(--text-secondary);
  font-size: 17px;
  line-height: 1.75;
  letter-spacing: 0.01em;
}

.hero-metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 36px;
}

.hero-point {
  padding: 20px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(167, 185, 210, 0.08);
  backdrop-filter: blur(16px);
  transition: border-color 0.3s ease, background 0.3s ease, transform 0.3s ease;
}

.hero-point:hover {
  border-color: rgba(167, 185, 210, 0.16);
  background: rgba(255, 255, 255, 0.05);
  transform: translateY(-2px);
}

.hero-point-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 14px;
}

.hero-point-icon svg {
  width: 18px;
  height: 18px;
}

.hero-point-icon.blue {
  background: rgba(59, 130, 246, 0.12);
  color: #60a5fa;
}

.hero-point-icon.rose {
  background: rgba(225, 29, 72, 0.1);
  color: #fb7185;
}

.hero-point-icon.orange {
  background: rgba(249, 115, 22, 0.1);
  color: #fb923c;
}

.hero-point-icon.gold {
  background: rgba(202, 138, 4, 0.1);
  color: #fbbf24;
}

.hero-point strong {
  display: block;
  color: #f0f4f8;
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 8px;
  letter-spacing: -0.01em;
}

.hero-point span {
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.65;
}

.profile-panel {
  padding: 32px;
  border-radius: 28px;
  background: rgba(8, 15, 28, 0.6);
  border: 1px solid rgba(167, 185, 210, 0.1);
  backdrop-filter: blur(32px);
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.03) inset,
    0 32px 64px rgba(0, 0, 0, 0.3);
}

.panel-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 24px;
}

.panel-kicker {
  display: block;
  color: #fbbf24;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.panel-title {
  margin-top: 8px;
  font-family: var(--font-display);
  font-size: 26px;
  line-height: 1.1;
  letter-spacing: -0.03em;
  color: #ffffff;
}

.panel-badge {
  flex: 0 0 auto;
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(202, 138, 4, 0.1);
  border: 1px solid rgba(202, 138, 4, 0.15);
  color: #fbbf24;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.profile-preview {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(167, 185, 210, 0.08);
}

.preview-label {
  display: inline-block;
  margin-bottom: 6px;
  color: #93c5fd;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.profile-preview-copy strong {
  display: block;
  color: #ffffff;
  font-size: 20px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.profile-preview-copy span:last-child {
  display: block;
  margin-top: 4px;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.6;
}

.field-group {
  margin-top: 20px;
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
  color: #c1cede;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.01em;
}

.field-caption,
.field-helper {
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.6;
}

.field-helper {
  margin-top: 8px;
}

.text-input {
  width: 100%;
  min-height: 48px;
  border: 1px solid rgba(167, 185, 210, 0.12);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.04);
  color: #ffffff;
  padding: 0 16px;
  font-size: 15px;
  transition: border-color 0.25s ease, box-shadow 0.25s ease, background 0.25s ease;
}

.text-input:focus {
  outline: none;
  border-color: rgba(96, 165, 250, 0.4);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  background: rgba(255, 255, 255, 0.06);
}

.text-input::placeholder {
  color: rgba(148, 163, 184, 0.5);
}

.avatar-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.avatar-option {
  min-height: 100px;
  border: 1px solid rgba(167, 185, 210, 0.08);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.02);
  padding: 12px 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--text-muted);
  cursor: pointer;
  transition: border-color 0.25s ease, background 0.25s ease, transform 0.25s ease, box-shadow 0.25s ease;
}

.avatar-option:hover {
  border-color: rgba(167, 185, 210, 0.18);
  background: rgba(255, 255, 255, 0.04);
  transform: translateY(-2px);
}

.avatar-option.active {
  border-color: rgba(96, 165, 250, 0.4);
  background: rgba(59, 130, 246, 0.06);
  box-shadow: 0 0 0 1px rgba(96, 165, 250, 0.12), 0 12px 24px rgba(37, 99, 235, 0.08);
}

.avatar-option span {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.action-panel {
  margin-top: 24px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.join-panel {
  padding: 16px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(167, 185, 210, 0.08);
}

.join-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 14px;
  margin-bottom: 12px;
}

.join-panel-header .field-helper {
  margin-top: 4px;
}

.join-pill {
  flex: 0 0 auto;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.12);
  color: #93c5fd;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.join-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
}

.btn {
  border: none;
  border-radius: 14px;
  padding: 14px 18px;
  color: #fff;
  cursor: pointer;
  font-size: 15px;
  font-weight: 600;
  transition: transform 0.25s ease, filter 0.25s ease, box-shadow 0.25s ease;
}

.btn:hover {
  transform: translateY(-1px);
  filter: brightness(1.06);
}

.btn:active {
  transform: translateY(0);
}

.create-btn {
  min-height: 72px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 4px;
  background: linear-gradient(135deg, #2563eb, #7c3aed);
  box-shadow: 0 16px 40px rgba(37, 99, 235, 0.2);
}

.create-btn span {
  font-weight: 700;
  letter-spacing: -0.01em;
}

.create-btn small {
  color: rgba(255, 255, 255, 0.75);
  font-size: 12px;
  font-weight: 500;
}

.join-btn {
  min-width: 120px;
  background: linear-gradient(135deg, #f97316, #e11d48);
  box-shadow: 0 12px 32px rgba(225, 29, 72, 0.16);
  font-weight: 700;
}

.btn:focus-visible,
.avatar-option:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
}

@media (max-width: 1024px) {
  .container {
    padding: 24px;
  }

  .landing {
    grid-template-columns: 1fr;
    align-items: start;
    gap: 32px;
  }

  .hero-copy {
    max-width: none;
  }
}

@media (max-width: 720px) {
  .container {
    padding: 16px;
  }

  .landing {
    min-height: auto;
    gap: 24px;
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

  .join-row {
    grid-template-columns: 1fr;
  }

  .join-btn {
    width: 100%;
  }
}

@media (max-width: 560px) {
  .title {
    font-size: 36px;
  }

  .hero-metrics,
  .avatar-grid {
    grid-template-columns: 1fr;
  }

  .profile-panel {
    padding: 20px;
  }
}
</style>
