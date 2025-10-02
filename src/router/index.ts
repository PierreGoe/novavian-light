import { createRouter, createWebHistory } from 'vue-router'
import HomeScreen from '@/components/home/HomeScreen.vue'
import RaceSelector from '@/components/home/RaceSelector.vue'
import MissionTree from '@/components/mission/MissionTree.vue'
import CampaignView from '@/components/campaign/CampaignView.vue'
import GameOverScreen from '@/components/home/GameOverScreen.vue'

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
      path: '/campaign',
      name: 'campaign',
      component: CampaignView,
    },
    {
      path: '/game-over',
      name: 'game-over',
      component: GameOverScreen,
    },
  ],
})

export default router
