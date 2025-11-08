<template>
  <div class="large-map-container">

    <!-- Contrôles de zoom -->
    <div class="map-controls">
  <button @click="zoomOut" :disabled="viewportSize === 5" class="control-btn">-</button>
  <span class="zoom-level">{{ viewportSize }}x{{ viewportSize }}</span>
  <button @click="zoomIn" :disabled="viewportSize === 11" class="control-btn">+</button>
      <button @click="centerOnPlayer" class="control-btn">
        🎯 Centre
      </button>
    </div>

    <!-- Coordonnées actuelles -->
    <div class="coordinates-display">
      Position: ({{ viewportCenter.x }}, {{ viewportCenter.y }})
    </div>

    <!-- Viewport principal avec défilement -->
    <div 
      ref="mapViewport"
      class="map-viewport"
      @mousedown="startPan"
      @mousemove="handlePan"
      @mouseup="endPan"
      @mouseleave="endPan"
      :style="{ cursor: isPanning ? 'grabbing' : 'grab' }"
    >
      <div 
        class="map-grid-large"
        :style="getGridStyle()"
      >
        <!-- Rendu uniquement des tuiles visibles -->
        <div
          v-for="tile in visibleTiles"
          :key="tile.id"
          class="map-tile"
          :class="getTileClasses(tile)"
          :style="getTileStyle(tile)"
          @click="selectTile(tile.id)"
        >
          <div class="tile-icon">{{ getTileIcon(tile.type) }}</div>
          <div class="tile-overlay" v-if="!tile.explored">?</div>
          <div class="current-marker" v-if="tile.current">📍</div>
        </div>
      </div>
    </div>

    <!-- Indicateur de chargement -->
    <div v-if="isLoading" class="loading-indicator">
      ⏳ Chargement de la carte...
    </div>
  </div>
</template>

<script setup lang="ts">
const zoomSteps = [5, 7, 9, 11]
function zoomIn() {
  const current = viewportSize.value
  const idx = zoomSteps.indexOf(current)
  if (idx < zoomSteps.length - 1) {
    mapStore.setZoomLevel(zoomSteps[idx + 1])
    viewportOffset.value = { ...mapStore.mapState.viewportOffset }
  }
}
function zoomOut() {
  const current = viewportSize.value
  const idx = zoomSteps.indexOf(current)
  if (idx > 0) {
    mapStore.setZoomLevel(zoomSteps[idx - 1])
    viewportOffset.value = { ...mapStore.mapState.viewportOffset }
  }
}
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useMapStore, type MapTile, MAP_CONFIG } from '../../stores/mapStore'

// Props
interface Props {
  tiles: MapTile[]
  selectedTileId?: string | null
}

const props = defineProps<Props>()

// Emits
const emit = defineEmits<{
  selectTile: [tileId: string]
}>()

// Store
const mapStore = useMapStore()

// Refs
const mapViewport = ref<HTMLElement | null>(null)
const isLoading = ref(false)

// État du viewport
const viewportOffset = ref({ ...mapStore.mapState.viewportOffset })
const viewportSize = computed(() => mapStore.mapState.zoomLevel)

// État du panning (déplacement à la souris)
const isPanning = ref(false)
const panStart = ref({ x: 0, y: 0 })
const panOffset = ref({ x: 0, y: 0 })

// Computed - Tuiles visibles dans le viewport
const visibleTiles = computed(() => {
  const startX = Math.max(0, viewportOffset.value.x)
  const startY = Math.max(0, viewportOffset.value.y)
  const endX = Math.min(MAP_CONFIG.size, startX + viewportSize.value)
  const endY = Math.min(MAP_CONFIG.size, startY + viewportSize.value)

  return props.tiles.filter(tile => {
    return tile.position.x >= startX && 
           tile.position.x < endX &&
           tile.position.y >= startY && 
           tile.position.y < endY
  })
})

// Computed - Centre du viewport
const viewportCenter = computed(() => {
  const halfView = Math.floor(viewportSize.value / 2)
  return {
    x: viewportOffset.value.x + halfView,
    y: viewportOffset.value.y + halfView
  }
})

// Styles
const getGridStyle = () => {
  // Adapter la taille des tuiles en fonction du zoom pour maximiser la visibilité
  const containerSize = 600 - 40 // height - padding
  const tileSizeAdaptive = Math.floor((containerSize - (viewportSize.value * 2)) / viewportSize.value)
  
  return {
    display: 'grid',
    gridTemplateColumns: `repeat(${viewportSize.value}, ${tileSizeAdaptive}px)`,
    gridTemplateRows: `repeat(${viewportSize.value}, ${tileSizeAdaptive}px)`,
    gap: '2px',
  }
}

const getTileStyle = (tile: MapTile) => {
  const relativeX = tile.position.x - viewportOffset.value.x
  const relativeY = tile.position.y - viewportOffset.value.y
  
  return {
    gridColumn: relativeX + 1,
    gridRow: relativeY + 1,
  }
}

const getTileClasses = (tile: MapTile) => {
  return [
    `terrain-${tile.type}`,
    {
      'tile-explored': tile.explored,
      'tile-current': tile.current,
      'tile-selected': props.selectedTileId === tile.id,
      'tile-unexplored': !tile.explored
    }
  ]
}

// Methods
const selectTile = (tileId: string) => {
  emit('selectTile', tileId)
}

const getTileIcon = (type: MapTile['type']) => {
  return mapStore.getTileIcon(type)
}

// Zoom
onMounted(() => {
  mapStore.setZoomLevel(11)
  viewportOffset.value = { ...mapStore.mapState.viewportOffset }
  window.addEventListener('keydown', handleKeyboard)
  centerOnPlayer()
})

// Panning (déplacement à la souris)
const startPan = (event: MouseEvent) => {
  isPanning.value = true
  panStart.value = { x: event.clientX, y: event.clientY }
  panOffset.value = { x: 0, y: 0 }
}

const handlePan = (event: MouseEvent) => {
  if (!isPanning.value) return
  
  const deltaX = event.clientX - panStart.value.x
  const deltaY = event.clientY - panStart.value.y
  
  // Convertir les pixels en tuiles
  const tileSize = MAP_CONFIG.tileSize
  const tileDeltaX = -Math.floor(deltaX / tileSize)
  const tileDeltaY = -Math.floor(deltaY / tileSize)
  
  if (tileDeltaX !== panOffset.value.x || tileDeltaY !== panOffset.value.y) {
    const dx = tileDeltaX - panOffset.value.x
    const dy = tileDeltaY - panOffset.value.y
    moveViewport(dx, dy)
    panOffset.value = { x: tileDeltaX, y: tileDeltaY }
  }
}

const endPan = () => {
  isPanning.value = false
}

// Déplacement du viewport
const moveViewport = (deltaX: number, deltaY: number) => {
  const newX = Math.max(0, Math.min(
    MAP_CONFIG.size - viewportSize.value,
    viewportOffset.value.x + deltaX
  ))
  const newY = Math.max(0, Math.min(
    MAP_CONFIG.size - viewportSize.value,
    viewportOffset.value.y + deltaY
  ))
  
  viewportOffset.value = { x: newX, y: newY }
  mapStore.mapState.viewportOffset = viewportOffset.value
  mapStore.saveMapState()
}

// Centrer sur le joueur
const centerOnPlayer = () => {
  const halfView = Math.floor(viewportSize.value / 2)
  viewportOffset.value = {
    x: Math.max(0, Math.min(
      MAP_CONFIG.size - viewportSize.value,
      mapStore.currentPosition.value.x - halfView
    )),
    y: Math.max(0, Math.min(
      MAP_CONFIG.size - viewportSize.value,
      mapStore.currentPosition.value.y - halfView
    ))
  }
  mapStore.mapState.viewportOffset = viewportOffset.value
  mapStore.saveMapState()
}

// Minimap supprimée

// Déplacement au clavier
const handleKeyboard = (event: KeyboardEvent) => {
  const speed = event.shiftKey ? 5 : 1
  
  switch (event.key) {
    case 'ArrowUp':
    case 'w':
      event.preventDefault()
      moveViewport(0, -speed)
      break
    case 'ArrowDown':
    case 's':
      event.preventDefault()
      moveViewport(0, speed)
      break
    case 'ArrowLeft':
    case 'a':
      event.preventDefault()
      moveViewport(-speed, 0)
      break
    case 'ArrowRight':
    case 'd':
      event.preventDefault()
      moveViewport(speed, 0)
      break
    case ' ':
      event.preventDefault()
      centerOnPlayer()
      break
  }
}

// Lifecycle
onMounted(() => {
  window.addEventListener('keydown', handleKeyboard)
  centerOnPlayer()
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyboard)
})

// Watch pour synchroniser avec le store
watch(() => mapStore.currentPosition.value, () => {
  // Optionnel: centrer automatiquement quand le joueur se déplace
  // centerOnPlayer()
})
</script>

<style scoped>
.large-map-container {
  position: relative;
  width: 100%;
  height: 600px;
  background: #1a1a1a;
  border-radius: 12px;
  overflow: hidden;
}

.map-viewport {
  width: 100%;
  height: 100%;
  overflow: hidden;
  position: relative;
  user-select: none;
}

.map-grid-large {
  padding: 20px;
}

.map-tile {
  position: relative;
  border: 1px solid #555;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s ease;
  background: #333;
}

.map-tile:hover {
  border-color: #888;
  transform: scale(1.05);
  z-index: 10;
}

.tile-explored {
  border-color: #4a9eff;
}

.tile-current {
  border-color: #ffeb3b;
  box-shadow: 0 0 10px rgba(255, 235, 59, 0.5);
}

.tile-selected {
  border-color: #ff6b35;
  box-shadow: 0 0 15px rgba(255, 107, 53, 0.7);
  z-index: 11;
}

.tile-unexplored {
  background: #1a1a1a;
  opacity: 0.6;
}

/* Terrains */
.terrain-plains { background: linear-gradient(135deg, #8bc34a, #689f38); }
.terrain-forest { background: linear-gradient(135deg, #4caf50, #2e7d32); }
.terrain-mountain { background: linear-gradient(135deg, #78909c, #455a64); }
.terrain-water { background: linear-gradient(135deg, #2196f3, #1565c0); }
.terrain-village_player { background: linear-gradient(135deg, #ff9800, #f57c00); }
.terrain-village_enemy { background: linear-gradient(135deg, #f44336, #c62828); }
.terrain-ruins { background: linear-gradient(135deg, #9e9e9e, #424242); }
.terrain-stronghold { background: linear-gradient(135deg, #673ab7, #4527a0); }

.tile-icon {
  font-size: clamp(12px, 2vw, 24px);
  z-index: 2;
}

.tile-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: clamp(12px, 2vw, 20px);
  font-weight: bold;
  border-radius: 3px;
  z-index: 3;
}

.current-marker {
  position: absolute;
  top: -3px;
  right: -3px;
  font-size: clamp(10px, 1.5vw, 14px);
  z-index: 4;
}

/* Minimap supprimée */

/* Contrôles */
.map-controls {
  position: absolute;
  top: 10px;
  left: 10px;
  display: flex;
  gap: 8px;
  align-items: center;
  background: rgba(0, 0, 0, 0.8);
  padding: 8px 12px;
  border-radius: 8px;
  z-index: 100;
}

.control-btn {
  background: rgba(74, 158, 255, 0.3);
  color: white;
  border: 1px solid #4a9eff;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.85em;
  transition: all 0.2s ease;
}

.control-btn:hover:not(:disabled) {
  background: rgba(74, 158, 255, 0.5);
  transform: translateY(-1px);
}

.control-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.zoom-level {
  color: #4a9eff;
  font-size: 0.9em;
  font-weight: 600;
  min-width: 50px;
  text-align: center;
}

/* Coordonnées */
.coordinates-display {
  position: absolute;
  bottom: 10px;
  left: 10px;
  background: rgba(0, 0, 0, 0.8);
  color: #4a9eff;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 0.85em;
  z-index: 100;
}

/* Indicateur de chargement */
.loading-indicator {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(0, 0, 0, 0.9);
  color: white;
  padding: 20px 30px;
  border-radius: 12px;
  font-size: 1.1em;
  z-index: 200;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

/* Responsive */
@media (max-width: 768px) {
  .large-map-container {
    height: 400px;
  }
  
  .minimap {
    width: 120px;
    height: 120px;
  }
  
  .minimap-content {
    width: 100px;
    height: 100px;
  }
  
  .map-controls {
    flex-wrap: wrap;
    gap: 4px;
  }
  
  .control-btn {
    padding: 4px 8px;
    font-size: 0.75em;
  }
}
</style>