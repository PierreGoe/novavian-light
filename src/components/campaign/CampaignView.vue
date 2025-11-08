<template>
  <div class="campaign-view">
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
          <span class="population">👥 Population: {{ town?.population || 0 }}</span>
        </div>
      </div>
      <!-- Ressources Travian -->
      <div class="resources-display">
        <div class="resource-item wood">
          <span class="resource-icon">🪵</span>
          <span class="resource-amount">{{ Math.floor(town?.resources?.wood || 0) }}</span>
          <span class="resource-production"
            >+{{ Math.floor(town?.production?.wood || 0) }}/min</span
          >
        </div>
        <div class="resource-item clay">
          <span class="resource-icon">🧱</span>
          <span class="resource-amount">{{ Math.floor(town?.resources?.clay || 0) }}</span>
          <span class="resource-production"
            >+{{ Math.floor(town?.production?.clay || 0) }}/min</span
          >
        </div>
        <div class="resource-item iron">
          <span class="resource-icon">⚒️</span>
          <span class="resource-amount">{{ Math.floor(town?.resources?.iron || 0) }}</span>
          <span class="resource-production"
            >+{{ Math.floor(town?.production?.iron || 0) }}/min</span
          >
        </div>
        <div class="resource-item crop">
          <span class="resource-icon">🌾</span>
          <span class="resource-amount">{{ Math.floor(town?.resources?.crop || 0) }}</span>
          <span class="resource-production"
            >+{{ Math.floor(town?.production?.crop || 0) }}/min</span
          >
        </div>
      </div>

      <div class="header-actions">
        <button class="btn-exit" @click="exitCampaign">🏠 Retour aux missions</button>
      </div>
    </header>

    <!-- Zone principale divisée en 2 parties -->
    <main class="campaign-content">
      <!-- Vue de la ville (gauche) -->
      <section class="town-section">
        <TownView />
      </section>

      <!-- Vue de la carte/combat (droite) -->
      <section class="map-section">
        <LargeMapExplorationView />
      </section>
    </main>

    <!-- Interface de combat si en combat -->
    <div v-if="isInCombat" class="combat-interface">
      <div class="combat-info">
        <h3>{DEBUG}Combat contre {{ currentMission?.enemy?.name || 'Ennemi' }}</h3>
        <div class="combat-actions">
          <button class="btn-attack" @click="win">⚔️ Gagner</button>
          <button class="btn-defend" @click="lose">🛡️ Perdre</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useMissionStore } from '@/stores/missionStore'
import { useToastStore } from '@/stores/toastStore'
import TownView from './TownView.vue' // Composants enfants
import LargeMapExplorationView from '../map/LargeMapExplorationView.vue' // Nouvelle carte

const router = useRouter()
const missionStore = useMissionStore()
const toastStore = useToastStore()

// Computed
const currentMission = computed(() => missionStore.currentMission.value)
const town = computed(() => missionStore.town.value)
const missionName = computed(() => currentMission.value?.name || 'Camp de Base')
const missionDifficulty = computed(() => currentMission.value?.difficulty)
const isInCombat = computed(() => currentMission.value?.isActive || false)

// Rerender every seconde for show resources production update
const resourceIntervalId = setInterval(() => {
  missionStore.updateResourceProduction()
}, 1000)

onUnmounted(() => {
  clearInterval(resourceIntervalId)
})

// Actions
const exitCampaign = () => {
  missionStore.exitMission()
  router.push('/mission-tree')
}

const win = () => {
  // fake function for win game
  toastStore.showSuccess('Attaque réussie !', { duration: 2000 })
  missionStore.completeMission(true)
  setTimeout(() => {
    exitCampaign()
  }, 1000)
}

const lose = () => {
  toastStore.showError('Vous avez perdu le combat...', { duration: 2000 })
  missionStore.completeMission(false)
  setTimeout(() => {
    exitCampaign()
  }, 1000)
}

// Lifecycle
onMounted(() => {
  // Charger l'état des missions et démarrer les systèmes
  missionStore.loadMissionState()
  missionStore.startAutoSave()
  missionStore.startResourceProduction()
})

onUnmounted(() => {
  // Arrêter les systèmes automatiques
  missionStore.stopAutoSave()
  missionStore.stopResourceProduction()
})
</script>

<style scoped>
.campaign-view {
  min-height: 100vh;
  background: linear-gradient(135deg, #2c1810 0%, #1a0f08 100%);
  color: #f4e4bc;
  display: flex;
  flex-direction: column;
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

.population {
  font-size: 0.9rem;
  color: #f4e4bc;
}

.resources-display {
  display: flex;
  gap: 1.5rem;
  align-items: center;
}

.resource-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.5rem;
  background: rgba(139, 69, 19, 0.2);
  border-radius: 8px;
  border: 1px solid rgba(218, 165, 32, 0.3);
  min-width: 80px;
}

.resource-icon {
  font-size: 1.2rem;
  margin-bottom: 0.25rem;
}

.resource-amount {
  font-weight: bold;
  font-size: 1rem;
  color: #f4e4bc;
}

.resource-production {
  font-size: 0.7rem;
  color: #22c55e;
  opacity: 0.8;
}

.header-actions {
  display: flex;
  gap: 1rem;
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
  display: flex;
  flex: 1;
  gap: 2rem;
  padding: 2rem;
}

.town-section {
  flex: 1;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 12px;
  border: 1px solid rgba(218, 165, 32, 0.3);
  overflow: hidden;
}

.map-section {
  flex: 1;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 12px;
  border: 1px solid rgba(218, 165, 32, 0.3);
  overflow: hidden;
}

.combat-interface {
  position: fixed;
  bottom: 2rem;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.9);
  border: 2px solid #dc143c;
  border-radius: 12px;
  padding: 1.5rem;
  backdrop-filter: blur(10px);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
}

.combat-info h3 {
  margin: 0 0 1rem 0;
  color: #dc143c;
  text-align: center;
}

.combat-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
}

.combat-actions button {
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  font-weight: bold;
  transition: all 0.3s ease;
}

.btn-attack {
  background: #dc143c;
  color: white;
}

.btn-attack:hover {
  background: #b91c1c;
  transform: translateY(-2px);
}

.btn-defend {
  background: #2563eb;
  color: white;
}

.btn-defend:hover {
  background: #1d4ed8;
  transform: translateY(-2px);
}

.btn-retreat {
  background: #f59e0b;
  color: white;
}

.btn-retreat:hover {
  background: #d97706;
  transform: translateY(-2px);
}

/* Responsive */
@media (max-width: 1024px) {
  .campaign-content {
    flex-direction: column;
    gap: 1rem;
  }

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
