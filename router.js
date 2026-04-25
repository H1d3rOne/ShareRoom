import { createRouter, createWebHistory } from 'vue-router'
import IndexPage from './pages/index/index.vue'
import RoomPage from './pages/room/room.vue'

const routes = [
  {
    path: '/',
    name: 'Index',
    component: IndexPage
  },
  {
    path: '/room/:roomId',
    name: 'Room',
    component: RoomPage,
    props: true
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router