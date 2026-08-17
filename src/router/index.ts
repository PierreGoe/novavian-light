import { createRouter, createWebHistory } from 'vue-router'
import HomeScreen from '@/components/home/HomeScreen.vue'
import RaceSelector from '@/components/home/RaceSelector.vue'
import MissionTree from '@/components/mission/MissionTree.vue'
import CampaignView from '@/components/campaign/CampaignView.vue'
import CampaignScoreView from '@/components/campaign/CampaignScoreView.vue'
import GameOverScreen from '@/components/home/GameOverScreen.vue'
import InventoryView from '@/components/inventory/InventoryView.vue'
import BazarMystiqueView from '@/components/inventory/BazarMystiqueView.vue'
import SettingsView from '@/components/settings/SettingsView.vue'
import ReportsView from '@/components/reports/ReportsView.vue'

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
      path: '/campaign-score',
      name: 'campaign-score',
      component: CampaignScoreView,
    },
    {
      path: '/game-over',
      name: 'game-over',
      component: GameOverScreen,
    },
    {
      path: '/inventory',
      name: 'inventory',
      component: InventoryView,
    },
    {
      path: '/bazar',
      name: 'bazar',
      component: BazarMystiqueView,
    },
    {
      path: '/settings',
      name: 'settings',
      component: SettingsView,
    },
    {
      path: '/reports',
      name: 'reports',
      component: ReportsView,
    },
  ],
})

export default router
