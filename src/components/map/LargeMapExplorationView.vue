<template>
  <div class="large-map-exploration-view">
    <header class="map-header">
      <h2>🗺️ Grande Carte d'Exploration ({{ MAP_CONFIG.size }}x{{ MAP_CONFIG.size }})</h2>
      <div class="header-info">
        <span class="map-size-info">
          {{ exploredCount }} / {{ totalTiles }} tuiles explorées
        </span>
      </div>
    </header>

    <!-- Instructions -->
    <div class="controls-help">
      <div class="help-item">🖱️ <strong>Clic & Glisser</strong>: Déplacer la carte</div>
      <div class="help-item">⌨️ <strong>Flèches / WASD</strong>: Navigation</div>
      <div class="help-item">🔍 <strong>Boutons +/-</strong>: Zoom</div>
      <div class="help-item">⌨️ <strong>Espace</strong>: Centrer sur position</div>
    </div>

    <!-- Panneau d'exploration -->
    <ExplorationPanel 
      :selected-tile="selectedTile"
      @exploration-result="handleExplorationResult"
    />

    <!-- Grande grille de la carte -->
    <section class="map-section">
      <LargeMapGrid 
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
    <Transition name="slide-fade">
      <div 
        v-if="notification" 
        class="notification"
        :class="notification.type"
      >
        {{ notification.message }}
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useMapStore, type ScoutInfo, MAP_CONFIG } from '../../stores/mapStore'

// Composants
import LargeMapGrid from './LargeMapGrid.vue'
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

const exploredCount = computed(() => {
  return mapTiles.value.filter(tile => tile.explored).length
})

const totalTiles = computed(() => {
  return MAP_CONFIG.size * MAP_CONFIG.size
})

// Methods
const handleTileSelect = (tileId: string) => {
  const success = mapStore.selectTile(tileId)
  if (success) {
    selectedTileId.value = tileId
  } else {
    showNotification('Cette zone n\'a pas encore été explorée', 'warning')
  }
}

const handleExplorationResult = (result: { success: boolean; message: string; info?: ScoutInfo }) => {
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
.large-map-exploration-view {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
}

.map-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  padding: 20px;
  background: linear-gradient(135deg, #1e3c72, #2a5298);
  border-radius: 12px;
  color: white;
}

.map-header h2 {
  margin: 0;
  font-size: 1.5em;
}

.header-info {
  display: flex;
  align-items: center;
  gap: 15px;
}

.map-size-info {
  background: rgba(255, 255, 255, 0.2);
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 0.9em;
  font-weight: 500;
}

.controls-help {
  background: rgba(42, 82, 152, 0.1);
  border: 1px solid rgba(42, 82, 152, 0.3);
  border-radius: 8px;
  padding: 12px 20px;
  margin-bottom: 15px;
  display: flex;
  flex-wrap: wrap;
  gap: 15px;
  justify-content: center;
}

.help-item {
  font-size: 0.85em;
  color: #666;
  display: flex;
  align-items: center;
  gap: 5px;
}

.help-item strong {
  color: #333;
}

.map-section {
  margin: 20px 0;
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
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
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

/* Animations */
.slide-fade-enter-active {
  transition: all 0.3s ease;
}

.slide-fade-leave-active {
  transition: all 0.3s ease;
}

.slide-fade-enter-from {
  transform: translateX(100%);
  opacity: 0;
}

.slide-fade-leave-to {
  transform: translateX(100%);
  opacity: 0;
}

@media (max-width: 768px) {
  .large-map-exploration-view {
    padding: 10px;
  }
  
  .map-header {
    flex-direction: column;
    gap: 15px;
    text-align: center;
  }
  
  .map-header h2 {
    font-size: 1.2em;
  }
  
  .controls-help {
    flex-direction: column;
    gap: 8px;
    align-items: flex-start;
  }
}
</style>