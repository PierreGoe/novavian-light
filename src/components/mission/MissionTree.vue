<template>
  <div class="mission-map">
    <div class="map-background"></div>

    <!-- En-tête : titre de la page + progression/objectif de cette carte -->
    <header class="map-header">
      <div class="map-header-title">
        <h1>Carte de Mission</h1>
        <p>Progressez à travers les dangers jusqu'au combat final</p>
      </div>

      <div class="map-header-status" v-if="mapGenerated">
        <div class="progress-container">
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: progressPercentage + '%' }"></div>
          </div>
          <span class="progress-text">{{ Math.round(progressPercentage) }}%</span>
        </div>

        <div class="player-status">
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
          <div
            class="status-item status-item--vp"
            :class="{ 'status-item--vp-done': totalCombatVP >= COMBAT_VP_GOAL }"
          >
            <span class="status-label">⚔️ Objectif :</span>
            <span class="status-value">{{ totalCombatVP }} / {{ COMBAT_VP_GOAL }} PV</span>
          </div>
        </div>
      </div>

      <button class="reset-button" @click="resetMap" title="Nouvelle carte">🔄 Nouvelle carte</button>
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
      <div class="legends">
        <div class="legend">
          <div class="legend-item">
            <span class="legend-icon" style="color: var(--node-combat)">⚔️</span>
            <span>Combat</span>
          </div>
          <div class="legend-item">
            <span class="legend-icon" style="color: var(--node-elite)">👑</span>
            <span>Élite</span>
          </div>
          <div class="legend-item">
            <span class="legend-icon" style="color: var(--node-shop)">🏪</span>
            <span>Magasin</span>
          </div>
          <div class="legend-item">
            <span class="legend-icon" style="color: var(--node-event)">❓</span>
            <span>Événement</span>
          </div>
          <div class="legend-item">
            <span class="legend-icon" style="color: var(--node-rest)">🏕️</span>
            <span>Repos</span>
          </div>
          <div class="legend-item">
            <span class="legend-icon" style="color: var(--node-boss)">💀</span>
            <span>Boss</span>
          </div>
        </div>

        <div class="status-legend">
          <div class="legend-item">
            <span class="legend-icon status-icon-completed">✓</span>
            <span>Terminé</span>
          </div>
          <div class="legend-item">
            <span class="legend-icon status-icon-accessible">→</span>
            <span>Accessible</span>
          </div>
          <div class="legend-item">
            <span class="legend-icon status-icon-locked">🔒</span>
            <span>Verrouillé — terminez un nœud connecté pour le débloquer</span>
          </div>
        </div>
      </div>

      <button class="home-button" @click="goHome">🏠 Retour à l'accueil</button>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore, COMBAT_VP_GOAL } from '@/stores/gameStore'
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

// Progression de la carte de mission + objectif de PV combat
const progressPercentage = computed(() => {
  const totalNodes = mapLayers.value.reduce((sum, layer) => sum + layer.nodes.length, 0)
  const completedNodes = mapLayers.value.reduce(
    (sum, layer) => sum + layer.nodes.filter((node) => node.completed).length,
    0,
  )
  return totalNodes > 0 ? (completedNodes / totalNodes) * 100 : 0
})

const nextAvailableNodes = computed(() => {
  const accessible: MapNode[] = []
  mapLayers.value.forEach((layer) => {
    layer.nodes.forEach((node) => {
      if (node.accessible && !node.completed) accessible.push(node)
    })
  })
  return accessible
})

const totalCombatVP = computed(() => gameStore.victoryPoints.value.combat)

// Computed
const allNodes = computed(() => {
  const nodes: MapNode[] = []
  mapLayers.value.forEach((layer) => {
    nodes.push(...layer.nodes)
  })
  return nodes
})

const selectNode = (node: MapNode) => {
  // selectMapNode contient déjà le guard et appelle handleMapNodeAction en interne
  // On appelle handleMapNodeAction séparément uniquement pour passer router et toastStore
  // mais avec le guard appliqué ici aussi pour éviter tout doublon
  if (node.completed || (!node.accessible && !node.inProgress)) return

  gameStore.selectMapNode(node)
  gameStore.handleMapNodeAction(node, router, toastStore)
}

const resetMap = () => {
  if (!gameStore.gameState.race) {
    toastStore.showError('Aucune race sélectionnée !', { duration: 2000 })
    router.push('/race-selection')
    return
  }
  if (
    progressPercentage.value > 0 &&
    !window.confirm('Générer une nouvelle carte effacera votre progression actuelle. Continuer ?')
  ) {
    return
  }
  gameStore.resetMapOnly()
  gameStore.initializeMapIfNeeded()
  toastStore.showSuccess('Nouvelle carte générée !', { duration: 2000 })
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
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%);
  color: #f4e4bc;
  position: relative;
  overflow: hidden;
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
  gap: 1.5rem;
  flex-wrap: wrap;
  padding: 1.5rem 2rem;
  background: rgba(0, 0, 0, 0.4);
  border-bottom: 1px solid rgba(218, 165, 32, 0.3);
  position: sticky;
  top: 0;
  z-index: 100;
  backdrop-filter: blur(10px);
}

.map-header-title {
  flex-shrink: 0;
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

.map-header-status {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.progress-container {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  min-width: 140px;
}

.progress-bar {
  flex: 1;
  height: 8px;
  background: rgba(139, 69, 19, 0.5);
  border-radius: 4px;
  overflow: hidden;
  min-width: 80px;
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
  white-space: nowrap;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.8rem;
}

.status-item--vp {
  padding: 0.2rem 0.6rem;
  border-radius: 12px;
  background: rgba(218, 165, 32, 0.1);
  border: 1px solid rgba(218, 165, 32, 0.3);
}

.status-item--vp-done {
  background: rgba(34, 139, 34, 0.15);
  border-color: rgba(34, 139, 34, 0.5);
  animation: vp-pulse 2.2s ease-in-out infinite;
}

@keyframes vp-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(34, 139, 34, 0);
  }
  50% {
    box-shadow: 0 0 0 5px rgba(34, 139, 34, 0.2);
  }
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
  flex: 1;
  overflow-y: auto;
  overflow-x: auto;
  padding: 1rem 2rem;
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

.legends {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.legend,
.status-legend {
  display: flex;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.status-legend {
  gap: 1rem;
  opacity: 0.85;
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

.status-legend .legend-icon {
  font-size: 0.85rem;
  width: 1.3rem;
  height: 1.3rem;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
}

.status-icon-completed {
  background: #228b22;
  color: white;
}

.status-icon-accessible {
  background: #daa520;
  color: white;
}

.status-icon-locked {
  background: #444;
  color: #888;
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

  .map-header-status {
    width: 100%;
    flex-direction: column;
    align-items: stretch;
  }

  .player-status {
    flex-direction: column;
    align-items: stretch;
    gap: 0.4rem;
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
