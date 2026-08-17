<template>
  <div class="campaign-view" :style="{ '--timers-panel-width': timersPanelWidth }">
    <!-- Écran de transition/chargement -->
    <Transition name="fade">
      <div v-if="missionStore.isTransitioning.value" class="transition-overlay">
        <div class="transition-content">
          <div class="spinner"></div>
          <h2>🏆 Mission Réussie !</h2>
          <p>Préparation de la prochaine mission...</p>
        </div>
      </div>
    </Transition>

    <!-- En-tête avec informations de mission -->
    <header class="campaign-header">
      <div class="campaign-info">
        <h1>{{ missionName }}</h1>
        <div class="campaign-status">
          <span
            v-if="missionDifficulty"
            class="difficulty-badge"
            :class="`difficulty-${missionDifficulty}`"
          >
            {{ missionDifficulty.toUpperCase() }}
          </span>
        </div>
      </div>
      <!-- Ressources Travian -->
      <div class="resources-display">
        <div
          v-for="key in TRAVIAN_RESOURCE_ORDER"
          :key="key"
          class="resource-item"
          :aria-label="TRAVIAN_RESOURCES[key].label"
        >
          <span class="resource-icon" aria-hidden="true">{{ TRAVIAN_RESOURCES[key].emoji }}</span>
          <span class="resource-values">
            <ResourceCounter
              class="resource-amount"
              :value="missionStore.displayResources.value[key]"
            />
            <span class="resource-cap">/{{ formatNumber(capacity) }}</span>
          </span>
          <span class="resource-production"
            >+{{ Math.floor(town?.production?.[key] || 0) }}/min</span
          >
        </div>
      </div>

      <div class="header-actions">
        <VictoryPointsDisplay />
        <div class="time-display">
          <span class="time-item" title="Temps de mission (plafonne à 2h en offline)">
            ⏱️ {{ formattedGameTime }}
          </span>
          <span class="time-separator">|</span>
          <span class="time-item time-real" title="Heure réelle"> 🕒 {{ formattedRealTime }} </span>
        </div>
        <button class="btn-exit" @click="exitCampaign">🏠 Retour aux missions</button>
      </div>
    </header>

    <!-- Zone principale : sous-vue Village ou Carte (routée) -->
    <main class="campaign-content">
      <div class="campaign-router-view">
        <router-view />
      </div>
    </main>

    <!-- Panneau de timers — sidebar fixe côté droit, symétrique à SideNavBar -->
    <TimersPanel />

    <!-- Rapport de combat (overlay) — vit ici pour s'ouvrir peu importe la sous-vue active -->
    <CombatReportOverlay :report="combatReport" @close="combatReport = null" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useMissionStore, getResourceCapacity } from '@/stores/missionStore'
import { useMapStore } from '@/stores/mapStore'
import { getHQLevel } from '@/data/buildings'
import { TRAVIAN_RESOURCES, TRAVIAN_RESOURCE_ORDER } from '@/data/resources'
import { formatNumber } from '@/utils/formatNumber'
import { useExplorationTicker } from '@/composables/useExplorationTicker'
import VictoryPointsDisplay from './VictoryPointsDisplay.vue'
import TimersPanel from './TimersPanel.vue'
import CombatReportOverlay from '../map/CombatReportOverlay.vue'
import ResourceCounter from '@/components/globals/ResourceCounter.vue'

const router = useRouter()
const missionStore = useMissionStore()
const mapStore = useMapStore()
const { combatReport, start: startTicker, stop: stopTicker } = useExplorationTicker()

// Computed
const currentMission = computed(() => missionStore.currentMission.value)
const town = computed(() => missionStore.town.value)
const hqLevel = computed(() => getHQLevel(town.value?.buildings ?? []))
const capacity = computed(() => getResourceCapacity(hqLevel.value))
const missionName = computed(() => currentMission.value?.name || 'Camp de Base')
const missionDifficulty = computed(() => currentMission.value?.difficulty)

// Temps
const now = ref(Date.now())

const formattedGameTime = computed(() => {
  // Force reactivity on `now`
  void now.value
  const ms = missionStore.getGameTimestamp()
  return formatDuration(ms)
})

const formattedRealTime = computed(() => {
  const d = new Date(now.value)
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
})

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`
  return `${s}s`
}

// Horloge réactive pour les timers affichés (le store gère déjà la production)
const resourceIntervalId = setInterval(() => {
  now.value = Date.now()
}, 1000)

// Actions
const exitCampaign = () => {
  missionStore.exitMission()
  router.push('/mission-tree')
}

// Largeur réservée au panneau de timers (sidebar fixe côté droit) — locale à ce composant
// (le panneau n'existe que sur cette route), synchronisée avec son état collapse stocké
// dans localStorage par TimersPanel.vue. Les valeurs 260px/64px reprennent celles de la
// sidebar de navigation (SideNavBar.vue) pour une largeur collapsed symétrique.
const TIMERS_STORAGE_KEY = 'timers-panel-collapsed'
const timersPanelWidth = ref(localStorage.getItem(TIMERS_STORAGE_KEY) === 'true' ? '64px' : '260px')
const onTimersPanelToggle = (e: Event) => {
  timersPanelWidth.value = (e as CustomEvent<boolean>).detail ? '64px' : '260px'
}

// Lifecycle — ce composant reste monté tant que le joueur est dans la Campagne (Village ou
// Carte), c'est donc l'unique point de démarrage des services de fond (production, file de
// construction/entraînement, résolution des mouvements/combats/raids).
onMounted(() => {
  missionStore.loadMissionState()
  missionStore.startAllServices()
  mapStore.loadMapState()
  startTicker()
  window.addEventListener('timers-panel-toggle', onTimersPanelToggle)
})

onUnmounted(() => {
  clearInterval(resourceIntervalId)
  missionStore.stopAllServices()
  stopTicker()
  mapStore.saveMapState()
  window.removeEventListener('timers-panel-toggle', onTimersPanelToggle)
})
</script>

<style scoped>
.campaign-view {
  min-height: 100vh;
  background: linear-gradient(135deg, #2c1810 0%, #1a0f08 100%);
  color: #f4e4bc;
  display: flex;
  flex-direction: column;
  /* Le panneau de timers est une sidebar fixe (TimersPanel.vue) — on réserve l'espace à
     droite sur tout le layout (header inclus), comme App.vue le fait à gauche pour la
     sidebar de navigation (--sidebar-width). Variable locale : le panneau n'existe que
     sur cette route, inutile de la remonter globalement dans App.vue. */
  padding-right: var(--timers-panel-width, 260px);
  transition: padding-right 0.25s ease;
}

@media (max-width: 768px) {
  /* Le panneau de timers se masque au même palier que la sidebar de navigation. */
  .campaign-view {
    padding-right: 0;
  }
}

.campaign-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 2rem;
  background: rgba(0, 0, 0, 0.4);
  border-bottom: 1px solid rgba(218, 165, 32, 0.3);
  backdrop-filter: blur(10px);
}

.campaign-info h1 {
  font-size: 1.8rem;
  margin: 0;
  color: #daa520;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.7);
}

.campaign-status {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-top: 0.5rem;
}

.difficulty-badge {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: bold;
}

.difficulty-easy {
  background: #22c55e;
  color: white;
}
.difficulty-medium {
  background: #f59e0b;
  color: white;
}
.difficulty-hard {
  background: #ef4444;
  color: white;
}
.difficulty-elite {
  background: #8b5cf6;
  color: white;
}

.resources-display {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
}

.resource-item {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.3rem 0.6rem;
  background: rgba(139, 69, 19, 0.2);
  border-radius: 6px;
  border: 1px solid rgba(218, 165, 32, 0.3);
  line-height: 1.1;
}

.resource-icon {
  font-size: 1rem;
}

.resource-values {
  display: flex;
  align-items: baseline;
  gap: 0.1rem;
}

.resource-amount {
  font-weight: bold;
  font-size: 0.88rem;
  color: #f4e4bc;
}

.resource-cap {
  font-size: 0.7rem;
  color: #94a3b8;
}

.resource-production {
  font-size: 0.68rem;
  color: #22c55e;
  opacity: 0.85;
  white-space: nowrap;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.time-display {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(218, 165, 32, 0.2);
  border-radius: 8px;
  padding: 6px 12px;
  font-size: 0.82rem;
  font-variant-numeric: tabular-nums;
}

.time-item {
  color: #daa520;
  white-space: nowrap;
}

.time-real {
  color: #94a3b8;
}

.time-separator {
  color: rgba(218, 165, 32, 0.3);
}

.btn-exit {
  background: rgba(139, 69, 19, 0.4);
  border: 1px solid #8b4513;
  color: #f4e4bc;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-exit:hover {
  background: rgba(218, 165, 32, 0.3);
  border-color: #daa520;
}

.campaign-content {
  flex: 1;
  padding: 2rem;
}

.campaign-router-view {
  height: 100%;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 12px;
  border: 1px solid rgba(218, 165, 32, 0.3);
  overflow: hidden;
}

/* Écran de transition */
.transition-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.transition-content {
  text-align: center;
  color: #f4e4bc;
}

.transition-content h2 {
  font-size: 2.5rem;
  margin-bottom: 1rem;
  color: #ffd700;
  text-shadow: 0 0 20px rgba(255, 215, 0, 0.5);
}

.transition-content p {
  font-size: 1.2rem;
  margin-top: 1rem;
  opacity: 0.8;
}

.spinner {
  width: 60px;
  height: 60px;
  border: 4px solid rgba(255, 215, 0, 0.2);
  border-top-color: #ffd700;
  border-radius: 50%;
  margin: 0 auto 2rem;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Responsive */
@media (max-width: 1024px) {
  .campaign-header {
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
  }

  .resources-display {
    gap: 1rem;
  }
}

</style>
