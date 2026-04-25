<template>
  <div class="app-shell">
    <router-view />
  </div>
</template>

<script setup>
// WebSocket连接已在room.vue中实现，这里不需要重复初始化
</script>

<style>
.app-shell {
  min-height: 100vh;
}
</style>
