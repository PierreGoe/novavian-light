<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useGameStore } from '@/stores/gameStore'
import { useMissionStore } from '@/stores/missionStore'
import { useMapStore } from '@/stores/mapStore'
import SideNavBar from '@/components/globals/SideNavBar.vue'
import ToastContainer from '@/components/globals/ToastContainer.vue'
import PerformanceMonitor from '@/components/globals/PerformanceMonitor.vue'

const gameStore = useGameStore()
const missionStore = useMissionStore()
const mapStore = useMapStore()
const route = useRoute()

// Largeur de la sidebar — synchronisée avec l'état collapse stocké dans localStorage
const STORAGE_KEY = 'sidebar-collapsed'
const sidebarWidth = ref(localStorage.getItem(STORAGE_KEY) === 'true' ? '64px' : '220px')

// Routes sans sidebar (plein écran)
const FULLSCREEN_ROUTES = new Set(['home', 'race-selection', 'game-over'])
const hasSidebar = ref(!FULLSCREEN_ROUTES.has(route.name as string))

watch(
  () => route.name,
  (name) => {
    hasSidebar.value = !FULLSCREEN_ROUTES.has(name as string)
  },
)

// Ecoute les changements de collapse sidebar
const onSidebarToggle = (e: Event) => {
  const collapsed = (e as CustomEvent<boolean>).detail
  sidebarWidth.value = collapsed ? '64px' : '220px'
}

// Sauvegarde d'urgence — garantit 0 perte de données à la fermeture/switch d'onglet
const saveAll = () => {
  missionStore.updateResourceProduction()
  missionStore.saveMissionState()
  mapStore.saveMapState()
  gameStore.saveGame()
}

const onBeforeUnload = () => saveAll()
const onVisibilityChange = () => {
  if (document.visibilityState === 'hidden') saveAll()
}

onMounted(() => {
  gameStore.loadGame()
  gameStore.startAutoSave()
  gameStore.startHostilityTimer()
  window.addEventListener('sidebar-toggle', onSidebarToggle)
  window.addEventListener('beforeunload', onBeforeUnload)
  document.addEventListener('visibilitychange', onVisibilityChange)
})

onUnmounted(() => {
  gameStore.stopAutoSave()
  gameStore.stopHostilityTimer()
  window.removeEventListener('sidebar-toggle', onSidebarToggle)
  window.removeEventListener('beforeunload', onBeforeUnload)
  document.removeEventListener('visibilitychange', onVisibilityChange)
})
</script>

<template>
  <div
    id="app"
    :style="hasSidebar ? { '--sidebar-width': sidebarWidth } : { '--sidebar-width': '0px' }"
  >
    <SideNavBar />

    <!-- Contenu principal décalé selon la largeur de la sidebar -->
    <div class="app-content">
      <RouterView />
      <ToastContainer />
      <PerformanceMonitor />
    </div>
  </div>
</template>

<style>
/* Reset et styles globaux */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  line-height: 1.6;
  color: #f4e4bc;
  background: #1a0f08;
  overflow-x: hidden;
}

#app {
  min-height: 100vh;
  --sidebar-width: 220px;
}

/* Zone de contenu principale — décalée à droite de la sidebar */
.app-content {
  margin-left: var(--sidebar-width);
  min-height: 100vh;
  transition: margin-left 0.25s ease;
}

/* Classe pour les pages full-écran (home, race-selection…) */
.main-content {
  min-height: 100vh;
}

/* Mobile : pas de décalage latéral, padding en bas pour la bottom nav */
@media (max-width: 768px) {
  .app-content {
    margin-left: 0;
    padding-bottom: 64px;
  }
}

/* Transitions de route globales */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-enter-active,
.slide-leave-active {
  transition: transform 0.3s ease;
}

.slide-enter-from {
  transform: translateX(100%);
}

.slide-leave-to {
  transform: translateX(-100%);
}
</style>
