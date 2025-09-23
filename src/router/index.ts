import { createRouter, createWebHistory } from 'vue-router'
import HomeScreen from '@/components/HomeScreen.vue'
import RaceSelector from '@/components/RaceSelector.vue'
import MissionTree from '@/components/MissionTree.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeScreen,
    },
    {
      path: '/race-selection',
      name: 'race-selection',
      component: RaceSelector,
    },
    {
      path: '/mission-tree',
      name: 'mission-tree',
      component: MissionTree,
    },
    {
      path: '/game',
      name: 'game',
      component: () => import('@/components/GameScreen.vue'),
    },
    {
      path: '/game/:section',
      name: 'game-section',
      component: () => import('@/components/GameScreen.vue'),
      props: true,
    },
  ],
})

export default router
