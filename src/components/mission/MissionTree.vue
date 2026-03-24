<template>
  <div class="mission-map">
    <div class="map-background"></div>

    {{ gameStore.gameState.currentStatus }}

    <!-- En-tête avec progression -->
    <header class="map-header">
      <h1>Carte de Mission</h1>
      <p>Progressez à travers les dangers jusqu'au combat final</p>
      <div class="progress-container">
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: progressPercentage + '%' }"></div>
        </div>
        <span class="progress-text">{{ Math.round(progressPercentage) }}%</span>
      </div>

      <div class="player-status" v-if="mapGenerated">
        <div class="status-item">
          <span class="status-label">Niveau:</span>
          <span class="status-value">{{ currentPlayerRow + 1 }}/{{ mapLayers.length }}</span>
        </div>
        <div class="status-item" v-if="nextAvailableNodes.length > 0">
          <span class="status-label">Choix:</span>
          <span class="status-value"
            >{{ nextAvailableNodes.length }} option{{
              nextAvailableNodes.length > 1 ? 's' : ''
            }}</span
          >
        </div>
      </div>

      <button class="reset-button" @click="resetMap" title="Nouvelle carte">🔄New Map</button>
    </header>

    <!-- Carte verticale -->
    <main class="map-container">
      <div class="map-layers" v-if="mapGenerated">
        <MissionMapLayer
          v-for="layer in mapLayers"
          :key="layer.row"
          :layer="layer"
          :current-player-row="currentPlayerRow"
          :total-layers="mapLayers.length"
          :selected-node-id="selectedNodeId"
          :all-nodes="allNodes"
          @select-node="selectNode"
        />
      </div>

      <!-- Chargement -->
      <div v-else class="loading-map">
        <div class="loading-spinner">⚔️</div>
        <p>Génération de la carte...</p>
      </div>
    </main>

    <!-- Légende et contrôles -->
    <footer class="map-footer">
      <div class="legend">
        <div class="legend-item">
          <span class="legend-icon" style="color: #dc143c">⚔️</span>
          <span>Combat</span>
        </div>
        <div class="legend-item">
          <span class="legend-icon" style="color: #ffd700">👑</span>
          <span>Élite</span>
        </div>
        <div class="legend-item">
          <span class="legend-icon" style="color: #32cd32">🏪</span>
          <span>Magasin</span>
        </div>
        <div class="legend-item">
          <span class="legend-icon" style="color: #9932cc">❓</span>
          <span>Événement</span>
        </div>
        <div class="legend-item">
          <span class="legend-icon" style="color: #4169e1">🏕️</span>
          <span>Repos</span>
        </div>
        <div class="legend-item">
          <span class="legend-icon" style="color: #8b0000">💀</span>
          <span>Boss</span>
        </div>
      </div>

      <button class="home-button" @click="goHome">🏠 Retour à l'accueil</button>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '@/stores/gameStore'
import { useToastStore } from '@/stores/toastStore'
import type { MapNode } from '@/utils'
import MissionMapLayer from './MissionMapLayer.vue'

const router = useRouter()
const gameStore = useGameStore()
const toastStore = useToastStore()

// Utiliser l'état de la carte depuis le gameStore
const mapLayers = computed(() => gameStore.gameState.mapState.layers)
const currentPlayerRow = computed(() => gameStore.gameState.mapState.currentPlayerRow)
const selectedNodeId = computed(() => gameStore.gameState.mapState.selectedNodeId)
const mapGenerated = computed(() => gameStore.gameState.mapState.mapGenerated)

// Computed
const progressPercentage = computed(() => {
  const totalNodes = mapLayers.value.reduce((sum, layer) => sum + layer.nodes.length, 0)
  const completedNodes = mapLayers.value.reduce(
    (sum, layer) => sum + layer.nodes.filter((node) => node.completed).length,
    0,
  )
  return totalNodes > 0 ? (completedNodes / totalNodes) * 100 : 0
})

const allNodes = computed(() => {
  const nodes: MapNode[] = []
  mapLayers.value.forEach((layer) => {
    nodes.push(...layer.nodes)
  })
  return nodes
})

const selectNode = (node: MapNode) => {
  gameStore.selectMapNode(node)
  gameStore.handleMapNodeAction(node, router, toastStore)
}

const resetMap = () => {
  if (!gameStore.gameState.race) {
    toastStore.showError('Aucune race sélectionnée !', { duration: 2000 })
    router.push('/race-selection')
    return
  }
  gameStore.resetMapOnly()
  setTimeout(() => {
    gameStore.initializeMapIfNeeded()
    toastStore.showSuccess('Nouvelle carte générée !', { duration: 2000 })
  }, 200)
}

const nextAvailableNodes = computed(() => {
  const accessible: MapNode[] = []
  mapLayers.value.forEach((layer) => {
    layer.nodes.forEach((node) => {
      if (node.accessible && !node.completed) accessible.push(node)
    })
  })
  return accessible
})

const getConnectionX = (connectionId: string) => {
  const targetNode = allNodes.value.find((n) => n.id === connectionId)
  if (targetNode) {
    return (targetNode.col + 0.5) * 120
  }
  return 60
}

const goHome = () => {
  router.push('/')
}

onMounted(() => {
  gameStore.loadGame()
  if (gameStore.gameState.currentStatus === 'game-over') {
    router.push('/game-over')
    return
  }
  gameStore.initializeMapIfNeeded()
})
</script>

<style scoped>
.mission-map {
  min-height: 100vh;
  background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%);
  color: #f4e4bc;
  position: relative;
  overflow-x: auto;
}

.map-background {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-image:
    radial-gradient(circle at 20% 30%, rgba(218, 165, 32, 0.03) 0%, transparent 50%),
    radial-gradient(circle at 80% 70%, rgba(139, 69, 19, 0.03) 0%, transparent 50%);
  pointer-events: none;
}

.map-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem 2rem;
  background: rgba(0, 0, 0, 0.4);
  border-bottom: 1px solid rgba(218, 165, 32, 0.3);
  position: sticky;
  top: 0;
  z-index: 100;
  backdrop-filter: blur(10px);
}

.map-header h1 {
  font-size: 1.8rem;
  margin: 0;
  color: #daa520;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.7);
}

.map-header p {
  font-size: 0.9rem;
  margin: 0.25rem 0 0;
  opacity: 0.8;
}

.progress-container {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex: 1;
  max-width: 300px;
  margin: 0 2rem;
}

.progress-bar {
  flex: 1;
  height: 8px;
  background: rgba(139, 69, 19, 0.5);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #daa520, #ffd700);
  transition: width 0.5s ease;
}

.progress-text {
  font-size: 0.9rem;
  font-weight: bold;
  color: #daa520;
  min-width: 40px;
}

.player-status {
  display: flex;
  gap: 1rem;
  align-items: center;
  padding: 0.5rem 1rem;
  background: rgba(139, 69, 19, 0.3);
  border-radius: 8px;
  border: 1px solid rgba(218, 165, 32, 0.3);
}

.status-item {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.8rem;
}

.status-label {
  color: #daa520;
  font-weight: bold;
}

.status-value {
  color: #f4e4bc;
}

.reset-button {
  background: rgba(139, 69, 19, 0.4);
  border: 1px solid #8b4513;
  color: #f4e4bc;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 1rem;
}

.reset-button:hover {
  background: rgba(218, 165, 32, 0.3);
  border-color: #daa520;
}

.map-container {
  padding: 2rem;
  position: relative;
  z-index: 1;
}

.map-layers {
  display: flex;
  flex-direction: column;
  gap: 0;
  max-width: fit-content;
  margin: 0 auto;
}

.loading-map {
  text-align: center;
  padding: 4rem 2rem;
}

.loading-spinner {
  font-size: 4rem;
  animation: spin 2s linear infinite;
  margin-bottom: 1rem;
}

.map-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem 2rem;
  background: rgba(0, 0, 0, 0.4);
  border-top: 1px solid rgba(218, 165, 32, 0.3);
  position: sticky;
  bottom: 0;
  z-index: 100;
  backdrop-filter: blur(10px);
}

.paths-legend {
  display: flex;
  gap: 2rem;
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid rgba(218, 165, 32, 0.3);
}

.path-indicator {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.9rem;
}

.path-line {
  width: 40px;
  height: 4px;
  border-radius: 2px;
}

.military-path {
  background: linear-gradient(90deg, #dc143c, #ff6b6b);
}

.balanced-path {
  background: linear-gradient(90deg, #daa520, #ffd700);
}

.economic-path {
  background: linear-gradient(90deg, #32cd32, #98fb98);
}

.legend {
  display: flex;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8rem;
}

.legend-icon {
  font-size: 1.2rem;
}

.home-button {
  background: rgba(139, 69, 19, 0.4);
  border: 1px solid #8b4513;
  color: #f4e4bc;
  padding: 0.8rem 1.5rem;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.home-button:hover {
  background: rgba(218, 165, 32, 0.3);
  border-color: #daa520;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(218, 165, 32, 0.7);
  }
  70% {
    box-shadow: 0 0 0 10px rgba(218, 165, 32, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(218, 165, 32, 0);
  }
}

/* Responsive */
@media (max-width: 768px) {
  .map-header {
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
  }

  .progress-container {
    margin: 0;
    max-width: none;
  }

  .player-status {
    flex-direction: column;
    gap: 0.5rem;
  }

  .status-item {
    justify-content: space-between;
    width: 100%;
  }

  .map-container {
    padding: 1rem;
    overflow-x: auto;
  }

  .legend {
    gap: 1rem;
  }

  .map-footer {
    flex-direction: column;
    gap: 1rem;
  }
}
</style>
