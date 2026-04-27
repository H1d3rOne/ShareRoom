<template>
  <div class="container">
    <div class="ambient ambient-1"></div>
    <div class="ambient ambient-2"></div>
    <div class="ambient ambient-3"></div>

    <main class="landing">
      <header class="hero">
        <div class="hero-badge">ShareRoom</div>
        <h1 class="hero-title">
          <span>共享协作</span>
          <span class="gradient">同一房间</span>
        </h1>
        <p class="hero-sub">实时共享屏幕、视频与网页，语音对话、远控协作与轻游戏，一个房间搞定</p>

        <div class="cta-group">
          <button class="cta-primary" @click="createRoom">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            <span>创建房间</span>
          </button>
          <div class="cta-join">
            <input
              v-model="roomId"
              class="room-input"
              placeholder="输入房间号"
              @keyup.enter="joinRoom"
            />
            <button class="cta-secondary" @click="joinRoom">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
              <span>加入</span>
            </button>
          </div>
        </div>
      </header>

      <div class="identity-bar">
        <div class="identity-left" @click="toggleAvatarDropdown">
          <UserAvatar :avatar-id="selectedAvatarId" :name="previewDisplayName" :size="32" />
          <span class="identity-name">{{ previewDisplayName }}</span>
          <svg class="chevron" :class="{ open: showAvatarDropdown }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        <div class="identity-right">
          <input
            v-model="displayName"
            class="name-input"
            maxlength="20"
            placeholder="你的昵称"
            @blur="normalizeDraftProfile"
          />
        </div>
      </div>

      <Transition name="dropdown">
        <div v-if="showAvatarDropdown" class="avatar-dropdown">
          <div class="dropdown-header">选择头像</div>
          <div class="avatar-grid">
            <button
              v-for="preset in AVATAR_PRESETS"
              :key="preset.id"
              type="button"
              class="avatar-item"
              :class="{ active: selectedAvatarId === preset.id }"
              @click="selectAvatar(preset.id)"
            >
              <UserAvatar :avatar-id="preset.id" :name="preset.name" :size="40" />
              <span>{{ preset.name }}</span>
            </button>
          </div>
        </div>
      </Transition>

      <section class="features">
        <article class="feat">
          <div class="feat-icon blue">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="3"/><path d="m8 21 4-4 4 4"/></svg>
          </div>
          <div>
            <strong>实时共享</strong>
            <p>图片、视频、屏幕、网页同步展示</p>
          </div>
        </article>
        <article class="feat">
          <div class="feat-icon rose">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </div>
          <div>
            <strong>统一身份</strong>
            <p>头像昵称贯穿聊天、成员与游戏</p>
          </div>
        </article>
        <article class="feat">
          <div class="feat-icon orange">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
          </div>
          <div>
            <strong>轻量娱乐</strong>
            <p>五子棋等互动玩法在共享区域展开</p>
          </div>
        </article>
        <article class="feat">
          <div class="feat-icon gold">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
          </div>
          <div>
            <strong>资料记忆</strong>
            <p>下次进入自动恢复上次的房间身份</p>
          </div>
        </article>
      </section>
    </main>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import UserAvatar from '../../components/UserAvatar.vue'
import { AVATAR_PRESETS, ensureStoredUserProfile, normalizeDisplayName, saveStoredUserProfile } from '../../utils/userProfile'

const router = useRouter()
const roomId = ref('')
const storedProfile = ensureStoredUserProfile()
const displayName = ref(storedProfile.displayName)
const selectedAvatarId = ref(storedProfile.avatarId)
const showAvatarDropdown = ref(false)

const previewDisplayName = computed(() => {
  const trimmed = `${displayName.value || ''}`.trim()
  return trimmed || storedProfile.displayName
})

function toggleAvatarDropdown() {
  showAvatarDropdown.value = !showAvatarDropdown.value
}

function selectAvatar(id) {
  selectedAvatarId.value = id
  showAvatarDropdown.value = false
}

function handleClickOutside(e) {
  if (showAvatarDropdown.value && !e.target.closest('.identity-bar') && !e.target.closest('.avatar-dropdown')) {
    showAvatarDropdown.value = false
  }
}

onMounted(() => document.addEventListener('click', handleClickOutside))
onUnmounted(() => document.removeEventListener('click', handleClickOutside))

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
  router.push({ path: `/room/${newRoomId}`, query: { isCreator: true } })
}

const joinRoom = () => {
  if (!roomId.value.trim()) {
    alert('请输入房间ID')
    return
  }
  persistProfile()
  router.push({ path: `/room/${roomId.value.trim()}`, query: { isCreator: false } })
}
</script>

<style scoped>
.container {
  position: relative;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  color: var(--text-primary);
  padding: 32px 24px;
}

.ambient {
  position: absolute;
  border-radius: 999px;
  filter: blur(120px);
  pointer-events: none;
}

.ambient-1 {
  width: 500px;
  height: 500px;
  left: -10%;
  top: -5%;
  background: rgba(59, 130, 246, 0.14);
}

.ambient-2 {
  width: 400px;
  height: 400px;
  right: -8%;
  bottom: -5%;
  background: rgba(225, 29, 72, 0.1);
}

.ambient-3 {
  width: 300px;
  height: 300px;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(124, 58, 237, 0.06);
}

.landing {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 640px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.hero {
  text-align: center;
  margin-bottom: 32px;
}

.hero-badge {
  display: inline-block;
  padding: 6px 16px;
  border-radius: 999px;
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(96, 165, 250, 0.15);
  color: #93c5fd;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  margin-bottom: 24px;
}

.hero-title {
  font-family: var(--font-display);
  font-size: clamp(40px, 7vw, 64px);
  line-height: 1.05;
  letter-spacing: -0.04em;
  color: #ffffff;
  margin: 0 0 20px;
}

.hero-title span {
  display: block;
}

.hero-title .gradient {
  background: linear-gradient(135deg, #60a5fa, #a78bfa, #f0abfc);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero-sub {
  max-width: 440px;
  margin: 0 auto 36px;
  color: var(--text-secondary);
  font-size: 16px;
  line-height: 1.7;
}

.cta-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.cta-primary {
  width: 100%;
  max-width: 360px;
  min-height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  border: none;
  border-radius: 16px;
  background: linear-gradient(135deg, #2563eb, #7c3aed);
  color: #fff;
  font-size: 17px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 16px 48px rgba(37, 99, 235, 0.25);
  transition: transform 0.2s ease, filter 0.2s ease, box-shadow 0.2s ease;
}

.cta-primary svg {
  width: 20px;
  height: 20px;
}

.cta-primary:hover {
  transform: translateY(-2px);
  filter: brightness(1.08);
  box-shadow: 0 20px 56px rgba(37, 99, 235, 0.3);
}

.cta-primary:active {
  transform: translateY(0);
}

.cta-join {
  width: 100%;
  max-width: 360px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
}

.room-input {
  min-height: 48px;
  border: 1px solid rgba(167, 185, 210, 0.14);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.04);
  color: #ffffff;
  padding: 0 16px;
  font-size: 15px;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
}

.room-input:focus {
  outline: none;
  border-color: rgba(96, 165, 250, 0.4);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  background: rgba(255, 255, 255, 0.06);
}

.room-input::placeholder {
  color: rgba(148, 163, 184, 0.45);
}

.cta-secondary {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-width: 100px;
  min-height: 48px;
  border: none;
  border-radius: 14px;
  background: linear-gradient(135deg, #f97316, #e11d48);
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 12px 32px rgba(225, 29, 72, 0.18);
  transition: transform 0.2s ease, filter 0.2s ease;
}

.cta-secondary svg {
  width: 18px;
  height: 18px;
}

.cta-secondary:hover {
  transform: translateY(-1px);
  filter: brightness(1.06);
}

.cta-secondary:active {
  transform: translateY(0);
}

.identity-bar {
  width: 100%;
  max-width: 360px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(167, 185, 210, 0.1);
  margin-bottom: 4px;
}

.identity-left {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px 8px 4px 4px;
  border-radius: 10px;
  transition: background 0.2s ease;
  flex-shrink: 0;
}

.identity-left:hover {
  background: rgba(255, 255, 255, 0.05);
}

.identity-name {
  color: #e2e8f0;
  font-size: 13px;
  font-weight: 600;
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chevron {
  width: 14px;
  height: 14px;
  color: var(--text-muted);
  transition: transform 0.2s ease;
  flex-shrink: 0;
}

.chevron.open {
  transform: rotate(180deg);
}

.identity-right {
  flex: 1;
  min-width: 0;
}

.name-input {
  width: 100%;
  min-height: 36px;
  border: none;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
  color: #ffffff;
  padding: 0 12px;
  font-size: 13px;
  transition: background 0.2s ease;
}

.name-input:focus {
  outline: none;
  background: rgba(255, 255, 255, 0.07);
}

.name-input::placeholder {
  color: rgba(148, 163, 184, 0.4);
}

.avatar-dropdown {
  width: 100%;
  max-width: 360px;
  padding: 16px;
  border-radius: 16px;
  background: rgba(8, 15, 28, 0.85);
  border: 1px solid rgba(167, 185, 210, 0.12);
  backdrop-filter: blur(24px);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.3);
  margin-bottom: 20px;
}

.dropdown-header {
  color: #94a3b8;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  margin-bottom: 12px;
}

.avatar-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.avatar-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 10px 4px;
  border: 1px solid rgba(167, 185, 210, 0.06);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.02);
  cursor: pointer;
  transition: border-color 0.2s ease, background 0.2s ease, transform 0.2s ease;
}

.avatar-item:hover {
  border-color: rgba(167, 185, 210, 0.15);
  background: rgba(255, 255, 255, 0.04);
  transform: translateY(-1px);
}

.avatar-item.active {
  border-color: rgba(96, 165, 250, 0.4);
  background: rgba(59, 130, 246, 0.06);
  box-shadow: 0 0 0 1px rgba(96, 165, 250, 0.1);
}

.avatar-item span {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-muted);
}

.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.features {
  width: 100%;
  max-width: 560px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 28px;
}

.feat {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(167, 185, 210, 0.06);
  transition: border-color 0.25s ease, background 0.25s ease;
}

.feat:hover {
  border-color: rgba(167, 185, 210, 0.12);
  background: rgba(255, 255, 255, 0.04);
}

.feat-icon {
  width: 32px;
  height: 32px;
  min-width: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.feat-icon svg {
  width: 16px;
  height: 16px;
}

.feat-icon.blue {
  background: rgba(59, 130, 246, 0.1);
  color: #60a5fa;
}

.feat-icon.rose {
  background: rgba(225, 29, 72, 0.08);
  color: #fb7185;
}

.feat-icon.orange {
  background: rgba(249, 115, 22, 0.08);
  color: #fb923c;
}

.feat-icon.gold {
  background: rgba(202, 138, 4, 0.08);
  color: #fbbf24;
}

.feat strong {
  display: block;
  color: #e2e8f0;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 4px;
}

.feat p {
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.55;
  margin: 0;
}

@media (max-width: 560px) {
  .container {
    padding: 24px 16px;
  }

  .hero-title {
    font-size: 36px;
  }

  .features {
    grid-template-columns: 1fr;
  }

  .cta-primary,
  .cta-join {
    max-width: none;
  }

  .identity-bar {
    max-width: none;
  }

  .avatar-dropdown {
    max-width: none;
  }

  .avatar-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
</style>
