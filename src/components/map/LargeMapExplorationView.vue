<template>
  <div class="large-map-exploration-view">
    <!-- Instructions -->
    <div class="controls-help">
      <div class="help-item">🖱️ <strong>Clic & Glisser</strong>: Déplacer la carte</div>
      <div class="help-item">⌨️ <strong>Flèches / WASD</strong>: Navigation</div>
      <div class="help-item">🔍 <strong>Boutons +/-</strong>: Zoom</div>
      <div class="help-item">⌨️ <strong>Espace</strong>: Centrer sur position</div>
    </div>

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

    <!-- Panel éclaireurs -->
    <section class="scouts-panel">
      <div class="scouts-panel-header">
        <h3 class="scouts-title">🔭 Éclaireurs</h3>
        <div class="scouts-available">
          <span
            v-for="i in 4"
            :key="i"
            class="scout-dot"
            :class="{ active: i <= scoutsAvailable }"
          >🧍</span>
          <span class="scouts-count">{{ scoutsAvailable }} / 4 disponible{{ scoutsAvailable > 1 ? 's' : '' }}</span>
        </div>
      </div>

      <!-- Missions en cours -->
      <div v-if="activeScoutMissions.length > 0" class="scouts-section">
        <div class="scouts-section-label">En mission</div>
        <div class="scouts-list">
          <div v-for="mission in activeScoutMissions" :key="mission.id" class="scout-mission active">
            <div class="scout-mission-icon">🔭</div>
            <div class="scout-mission-info">
              <span class="scout-coords">({{ mission.target.x }}, {{ mission.target.y }})</span>
              <div class="scout-progress-bar">
                <div
                  class="scout-progress-fill"
                  :style="{ width: getMissionProgress(mission) + '%' }"
                ></div>
              </div>
            </div>
            <div class="scout-timer">{{ formatTimeRemaining(mission.endsAt) }}</div>
          </div>
        </div>
      </div>

      <!-- Missions terminées récemment -->
      <div v-if="completedScoutMissions.length > 0" class="scouts-section">
        <div class="scouts-section-label">Terminées</div>
        <div class="scouts-list">
          <div v-for="mission in completedScoutMissions" :key="mission.id" class="scout-mission completed">
            <div class="scout-mission-icon">✅</div>
            <div class="scout-mission-info">
              <span class="scout-coords">({{ mission.target.x }}, {{ mission.target.y }})</span>
              <span class="scout-done-label">Zone découverte</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Aucune mission -->
      <div v-if="activeScoutMissions.length === 0 && completedScoutMissions.length === 0" class="scouts-empty">
        Cliquez sur une case inconnue pour envoyer un éclaireur
      </div>
    </section>

    <!-- Toast de notification -->
    <Transition name="slide-fade">
      <div v-if="notification" class="notification" :class="notification.type">
        {{ notification.message }}
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useMapStore } from '../../stores/mapStore'
import { useMissionStore } from '../../stores/missionStore'

// Composants
import LargeMapGrid from './LargeMapGrid.vue'
import TileDetails from './TileDetails.vue'

// Stores
const mapStore = useMapStore()
const missionStore = useMissionStore()

// État local
const selectedTileId = ref<string | null>(null)
const notification = ref<{ message: string; type: string } | null>(null)
const currentTime = ref(Date.now())

// Computed
const mapTiles = computed(() => mapStore.mapTiles.value)
const selectedTile = computed(() => {
  if (!selectedTileId.value) return null
  return mapStore.getTileById(selectedTileId.value)
})
const scoutsAvailable = computed(() => missionStore.scoutsAvailable.value)
const activeScoutMissions = computed(() =>
  missionStore.getScoutMissions.value.filter((m) => m.status === 'pending'),
)
const completedScoutMissions = computed(() =>
  missionStore.getScoutMissions.value.filter((m) => m.status === 'completed'),
)

// Helpers scouts
const formatTimeRemaining = (endsAt: number): string => {
  const remaining = Math.max(0, endsAt - currentTime.value)
  const seconds = Math.ceil(remaining / 1000)
  if (seconds <= 0) return 'Arrivée...'
  if (seconds < 60) return `${seconds}s`
  return `${Math.floor(seconds / 60)}m${seconds % 60}s`
}

const getMissionProgress = (mission: { startedAt: number; endsAt: number }): number => {
  const total = mission.endsAt - mission.startedAt
  const elapsed = currentTime.value - mission.startedAt
  return Math.min(100, Math.max(0, (elapsed / total) * 100))
}

// Methods
const handleTileSelect = (tileId: string) => {
  const tile = mapStore.getTileById(tileId)

  if (!tile) {
    showNotification('Case introuvable', 'error')
    return
  }

  // Si la case n'est pas explorée, proposer une mission d'éclaireur
  if (!tile.explored) {
    const target = { x: tile.position.x, y: tile.position.y }

    // Vérifier si on peut lancer une mission
    if (!missionStore.canStartScoutMission(target)) {
      if (missionStore.scoutsAvailable.value <= 0) {
        showNotification('Aucun éclaireur disponible', 'warning')
      } else {
        showNotification("Cette case est déjà en cours d'exploration", 'warning')
      }
      return
    }

    // Lancer la mission d'éclaireur
    const success = missionStore.startScoutMission(target)
    if (success) {
      showNotification(`🔭 Éclaireur envoyé vers (${target.x}, ${target.y})`, 'success')
    } else {
      showNotification("Impossible de lancer la mission d'éclaireur", 'error')
    }
    return
  }

  // Si la case est explorée, la sélectionner normalement
  const success = mapStore.selectTile(tileId)
  if (success) {
    selectedTileId.value = tileId
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
  if (result.success) {
    showNotification(result.message, 'success')
  } else {
    showNotification(result.message, 'error')
  }
}

const showNotification = (message: string, type: string) => {
  notification.value = { message, type }
  setTimeout(() => {
    notification.value = null
  }, 3000)
}

// Timer pour la régénération automatique des points
let regenerationTimer: number | null = null
let displayRefreshTimer: number | null = null

// Lifecycle
onMounted(() => {
  // Charger l'état de la carte (doit être fait AVANT tout le reste)
  const hasLoadedMap = mapStore.loadMapState()
  console.log('Map loaded:', hasLoadedMap, 'Tiles count:', mapStore.mapTiles.value.length)

  // Charger l'état du mission store
  missionStore.loadMissionState()

  // Démarrer les services du mission store
  missionStore.startAllServices()

  // Synchroniser immédiatement les cases découvertes au chargement
  const discoveredTiles = missionStore.getDiscoveredTiles.value
  let hasChanges = false
  discoveredTiles.forEach((tileKey: string) => {
    const [x, y] = tileKey.split(',').map(Number)
    const tile = mapStore.getTileAt(x, y)
    if (tile && !tile.explored) {
      tile.explored = true
      hasChanges = true
    }
  })
  if (hasChanges) {
    mapStore.saveMapState()
  }

  // Démarrer le timer de régénération automatique
  regenerationTimer = window.setInterval(() => {
    mapStore.regenerateExplorationPoints()
  }, 60000) // Vérifier toutes les minutes

  // Timer pour forcer le rafraîchissement de l'affichage des timers
  // Les computed vérifieront automatiquement l'état des missions
  displayRefreshTimer = window.setInterval(() => {
    // Mettre à jour le temps pour forcer le recalcul des timers
    currentTime.value = Date.now()

    // Synchroniser les cases découvertes avec le mapStore
    const discoveredTiles = missionStore.getDiscoveredTiles.value
    let hasChanges = false
    discoveredTiles.forEach((tileKey: string) => {
      const [x, y] = tileKey.split(',').map(Number)
      const tile = mapStore.getTileAt(x, y)
      if (tile && !tile.explored) {
        tile.explored = true
        hasChanges = true
      }
    })
    // Ne sauvegarder qu'une seule fois s'il y a eu des changements
    if (hasChanges) {
      mapStore.saveMapState()
    }
  }, 1000) // Vérifier toutes les secondes pour un affichage fluide
})

onUnmounted(() => {
  // Nettoyer les timers
  if (regenerationTimer) {
    clearInterval(regenerationTimer)
  }
  if (displayRefreshTimer) {
    clearInterval(displayRefreshTimer)
  }

  // Arrêter les services du mission store
  missionStore.stopAllServices()

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

/* ===== Scout Panel ===== */
.scouts-panel {
  background: rgba(15, 25, 50, 0.7);
  border: 1px solid rgba(100, 149, 237, 0.35);
  border-radius: 12px;
  padding: 16px 20px;
  margin-top: 16px;
}

.scouts-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
  flex-wrap: wrap;
  gap: 8px;
}

.scouts-title {
  margin: 0;
  font-size: 1rem;
  color: #93c5fd;
  font-weight: 600;
}

.scouts-available {
  display: flex;
  align-items: center;
  gap: 6px;
}

.scout-dot {
  font-size: 1rem;
  opacity: 0.25;
  transition: opacity 0.3s ease;
}

.scout-dot.active {
  opacity: 1;
}

.scouts-count {
  font-size: 0.8rem;
  color: #93c5fd;
  margin-left: 4px;
  white-space: nowrap;
}

.scouts-section {
  margin-bottom: 12px;
}

.scouts-section-label {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #64748b;
  margin-bottom: 6px;
}

.scouts-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.scout-mission {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid transparent;
}

.scout-mission.active {
  border-color: rgba(100, 149, 237, 0.3);
}

.scout-mission.completed {
  border-color: rgba(34, 197, 94, 0.25);
  background: rgba(34, 197, 94, 0.05);
}

.scout-mission-icon {
  font-size: 1.1rem;
  flex-shrink: 0;
}

.scout-mission-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.scout-coords {
  font-size: 0.82rem;
  color: #cbd5e1;
  font-weight: 500;
}

.scout-done-label {
  font-size: 0.75rem;
  color: #4ade80;
}

.scout-progress-bar {
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  overflow: hidden;
}

.scout-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #93c5fd);
  border-radius: 2px;
  transition: width 0.5s ease;
}

.scout-timer {
  font-size: 0.8rem;
  color: #93c5fd;
  font-weight: 600;
  white-space: nowrap;
  flex-shrink: 0;
}

.scouts-empty {
  font-size: 0.82rem;
  color: #475569;
  text-align: center;
  padding: 10px 0;
  font-style: italic;
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
