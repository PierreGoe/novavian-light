import { createRouter, createWebHistory } from 'vue-router'
import HomeScreen from '@/components/HomeScreen.vue'
import RaceSelector from '@/components/RaceSelector.vue'
import MissionTree from '@/components/MissionTree.vue'
import CampaignView from '@/components/CampaignView.vue'

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
  ],
})

export default router
