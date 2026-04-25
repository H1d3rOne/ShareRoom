<template>
  <span class="avatar" :style="avatarStyle" :title="titleText">
    <img v-if="preset" :src="preset.src" :alt="titleText" />
    <span v-else class="fallback">{{ fallbackText }}</span>
  </span>
</template>

<script setup>
import { computed } from 'vue'
import { getAvatarPresetById } from '../utils/userProfile'

const props = defineProps({
  avatarId: {
    type: String,
    default: ''
  },
  name: {
    type: String,
    default: ''
  },
  size: {
    type: Number,
    default: 40
  }
})

const preset = computed(() => getAvatarPresetById(props.avatarId))
const titleText = computed(() => `${props.name || '房间成员'} 的头像`)
const fallbackText = computed(() => (props.name || '?').trim().slice(0, 1).toUpperCase() || '?')
const avatarStyle = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`
}))
</script>

<style scoped>
.avatar {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  overflow: hidden;
  background: rgba(15, 23, 42, 0.22);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.18);
}

.avatar img {
  width: 100%;
  height: 100%;
  display: block;
}

.fallback {
  color: #f8fafc;
  font-size: 14px;
  font-weight: 700;
}
</style>
