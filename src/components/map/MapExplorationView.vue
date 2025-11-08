<template>
  <div class="map-exploration-view">
    <header class="map-header">
      <h2>🗺️ Carte et Exploration</h2>
      <div class="header-actions">
        <button class="btn-regenerate" @click="regeneratePoints" :disabled="pointsAtMax">
          ⚡ Régénérer points
        </button>
      </div>
    </header>

    <!-- Panneau d'exploration -->
    <ExplorationPanel :selected-tile="selectedTile" @exploration-result="handleExplorationResult" />

    <!-- Grille de la carte -->
    <section class="map-section">
      <MapGrid
        :tiles="mapTiles"
        :selected-tile-id="selectedTileId"
        @select-tile="handleTileSelect"
      />
    </section>

    <!-- Détails de la tuile sélectionnée -->
    <TileDetails
      v-if="selectedTile"
      :tile="selectedTile"
      @attack-tile="handleAttackTile"
      @trade-tile="handleTradeTile"
      @explore-tile="handleExploreTile"
      @scout-tile="handleScoutTile"
    />

    <!-- Toast de notification -->
    <div v-if="notification" class="notification" :class="notification.type">
      {{ notification.message }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useMapStore, type ScoutInfo } from '../../stores/mapStore'

// Composants
import MapGrid from './MapGrid.vue'
import ExplorationPanel from './ExplorationPanel.vue'
import TileDetails from './TileDetails.vue'

// Stores
const mapStore = useMapStore()

// État local
const selectedTileId = ref<string | null>(null)
const notification = ref<{ message: string; type: string } | null>(null)

// Computed
const mapTiles = computed(() => mapStore.mapTiles.value)
const selectedTile = computed(() => {
  if (!selectedTileId.value) return null
  return mapStore.getTileById(selectedTileId.value)
})
const pointsAtMax = computed(
  () => mapStore.explorationPoints.value >= mapStore.mapState.maxExplorationPoints,
)

// Methods
const handleTileSelect = (tileId: string) => {
  const success = mapStore.selectTile(tileId)
  if (success) {
    selectedTileId.value = tileId
  } else {
    showNotification("Cette zone n'a pas encore été explorée", 'warning')
  }
}

const handleExplorationResult = (result: {
  success: boolean
  message: string
  info?: ScoutInfo
}) => {
  if (result.success) {
    showNotification(result.message, 'success')
  } else {
    showNotification(result.message, 'error')
  }
}

const handleAttackTile = (tileId: string) => {
  // TODO: Implémenter le système de combat
  showNotification('Système de combat en développement', 'info')
  console.log('Attack tile:', tileId)
}

const handleTradeTile = (tileId: string) => {
  // TODO: Implémenter le système de commerce
  showNotification('Système de commerce en développement', 'info')
  console.log('Trade with tile:', tileId)
}

const handleExploreTile = (tileId: string) => {
  // TODO: Implémenter l'exploration des ruines
  showNotification('Exploration des ruines en développement', 'info')
  console.log('Explore tile:', tileId)
}

const handleScoutTile = (tileId: string) => {
  const result = mapStore.scout(tileId)
  handleExplorationResult(result)
}

const regeneratePoints = () => {
  mapStore.regenerateExplorationPoints()
  showNotification("Points d'exploration régénérés", 'success')
}

const showNotification = (message: string, type: string) => {
  notification.value = { message, type }
  setTimeout(() => {
    notification.value = null
  }, 3000)
}

// Timer pour la régénération automatique des points
let regenerationTimer: number | null = null

// Lifecycle
onMounted(() => {
  // Charger l'état de la carte
  mapStore.loadMapState()

  // Démarrer le timer de régénération automatique
  regenerationTimer = window.setInterval(() => {
    mapStore.regenerateExplorationPoints()
  }, 60000) // Vérifier toutes les minutes
})

onUnmounted(() => {
  // Nettoyer le timer
  if (regenerationTimer) {
    clearInterval(regenerationTimer)
  }

  // Sauvegarder l'état
  mapStore.saveMapState()
})
</script>

<style scoped>
.map-exploration-view {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.map-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding: 20px;
  background: linear-gradient(135deg, #1e3c72, #2a5298);
  border-radius: 12px;
  color: white;
}

.map-header h2 {
  margin: 0;
  font-size: 1.5em;
}

.header-actions {
  display: flex;
  gap: 10px;
}

.btn-regenerate {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.3);
  padding: 10px 16px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.9em;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-regenerate:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.3);
  transform: translateY(-1px);
}

.btn-regenerate:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.map-section {
  margin: 30px 0;
  display: flex;
  justify-content: center;
}

.notification {
  position: fixed;
  top: 20px;
  right: 20px;
  padding: 15px 20px;
  border-radius: 8px;
  color: white;
  font-weight: 500;
  z-index: 1000;
  animation: slideInRight 0.3s ease;
}

.notification.success {
  background: linear-gradient(135deg, #4caf50, #388e3c);
}

.notification.error {
  background: linear-gradient(135deg, #f44336, #d32f2f);
}

.notification.warning {
  background: linear-gradient(135deg, #ff9800, #f57c00);
}

.notification.info {
  background: linear-gradient(135deg, #2196f3, #1976d2);
}

@keyframes slideInRight {
  from {
    opacity: 0;
    transform: translateX(100%);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@media (max-width: 768px) {
  .map-exploration-view {
    padding: 10px;
  }

  .map-header {
    flex-direction: column;
    gap: 15px;
    text-align: center;
  }

  .map-header h2 {
    font-size: 1.3em;
  }
}
</style>
