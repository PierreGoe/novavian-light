<template>
  <div class="large-map-container">
    <!-- Contrôles de zoom -->
    <div class="map-controls">
      <button
        @click="zoomOut"
        :disabled="viewportSize >= MAP_CONFIG.maxViewportSize"
        class="control-btn"
      >
        -
      </button>
      <span class="zoom-level">{{ viewportSize }}x{{ viewportSize }}</span>
      <button
        @click="zoomIn"
        :disabled="viewportSize <= MAP_CONFIG.minViewportSize"
        class="control-btn"
      >
        +
      </button>
      <button @click="centerOnPlayer" class="control-btn">🎯 Centre</button>
    </div>

    <!-- Coordonnées actuelles -->
    <div class="coordinates-display">
      Position: ({{ viewportCenter.x }}, {{ viewportCenter.y }})
    </div>

    <!-- Viewport principal avec défilement -->
    <div
      class="map-viewport"
      @mousedown="startPan"
      @mousemove="handlePan"
      @mouseup="endPan"
      @mouseleave="endPan"
      :style="{ cursor: isPanning ? 'grabbing' : 'grab' }"
    >
      <!-- Wrapper pour superposer la grille principale et l'overlay cadrans -->
      <div class="map-grid-wrapper">
        <div class="map-grid-large" :key="`grid-${gridRenderKey}`" :style="gridStyle">
          <!-- Rendu uniquement des tuiles visibles -->
          <div
            v-for="tile in visibleTiles"
            :key="tile.id"
            class="map-tile"
            :class="getTileClasses(tile)"
            @click="tile.type !== 'plains' && !isChunkLocked(tile) && selectTile(tile.id)"
          >
            <!-- Icône du terrain visible uniquement si exploré (pas affiché pour les plaines) -->
            <div
              class="tile-icon"
              v-if="(gameSettings.disableFogOfWar || tile.explored) && tile.type !== 'plains'"
            >
              {{ getTileIcon(tile.type) }}
            </div>

            <div class="current-marker" v-if="tile.current">📍</div>
            <!-- Indicateur : troupes en route vers cette tuile -->
            <div class="troops-en-route" v-if="hasTroopsEnRoute(tile.id)">🪖</div>
          </div>
        </div>

        <!-- Overlay bulle par cadran verrouillé (remplace les overlays par tuile) -->
        <div
          v-if="!gameSettings.disableFogOfWar && visibleLockedChunks.length > 0"
          class="map-grid-large map-chunk-overlay"
          :key="`overlay-${gridRenderKey}`"
          :style="gridStyle"
        >
          <div
            v-for="chunk in visibleLockedChunks"
            :key="chunk.id"
            class="chunk-locked-bubble"
            :style="getChunkBubbleStyle(chunk)"
            @click.stop="emit('unlock-chunk', chunk.id)"
          >
            <div class="chunk-bubble-inner">
              <span class="chunk-bubble-lock">🔒</span>
              <span class="chunk-bubble-label">Zone {{ chunk.id }}</span>
              <span class="chunk-bubble-hint">Cliquer pour révéler</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Indicateur de chargement -->
    <div v-if="isLoading" class="loading-indicator">⏳ Chargement de la carte...</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useMapStore, type MapTile, MAP_CONFIG } from '../../stores/mapStore'
import { useMapViewport } from '../../composables/useMapViewport'
import { gameSettings } from '../../stores/gameSettingsStore'

// Props
interface Props {
  tiles: MapTile[]
  selectedTileId?: string | null
}

const props = defineProps<Props>()

// Emits
const emit = defineEmits<{
  selectTile: [tileId: string]
  'unlock-chunk': [chunkId: string]
}>()

// Store
const mapStore = useMapStore()

// Composables
const {
  viewportOffset,
  viewportSize,
  viewportCenter,
  isPanning,
  zoomIn,
  zoomOut,
  centerOnPlayer,
  startPan,
  handlePan,
  endPan,
} = useMapViewport()

const isLoading = ref(false)

// Dimensions réelles du viewport après clamping aux bords de la carte
const viewportDimensions = computed(() => {
  const startX = Math.max(0, viewportOffset.value.x)
  const startY = Math.max(0, viewportOffset.value.y)
  const endX = Math.min(MAP_CONFIG.size, startX + viewportSize.value)
  const endY = Math.min(MAP_CONFIG.size, startY + viewportSize.value)
  return { startX, startY, endX, endY, cols: endX - startX, rows: endY - startY }
})

// Computed — tuiles visibles triées en ordre ligne-par-ligne (y croissant, x croissant).
// Le tri est requis pour que le placement automatique CSS Grid soit correct
// sans avoir à spécifier gridColumn/gridRow explicitement sur chaque tuile.
const visibleTiles = computed(() => {
  const { startX, startY, endX, endY } = viewportDimensions.value

  return props.tiles
    .filter(
      (tile) =>
        tile.position.x >= startX &&
        tile.position.x < endX &&
        tile.position.y >= startY &&
        tile.position.y < endY,
    )
    .sort((a, b) =>
      a.position.y !== b.position.y ? a.position.y - b.position.y : a.position.x - b.position.x,
    )
})

// Style CSS Grid — computed pour garantir la synchronisation avec viewportDimensions
const gridStyle = computed(() => {
  const { cols } = viewportDimensions.value
  const containerSize = 600 - 40
  const tileSizeAdaptive = Math.floor((containerSize - cols * 2) / cols)
  const style = {
    display: 'grid',
    gridTemplateColumns: `repeat(${cols}, ${tileSizeAdaptive}px)`,
    gridAutoRows: `${tileSizeAdaptive}px`,
    gap: '2px',
  }
  return style
})

// Clé de re-render : change quand le viewport (taille OU offset) change
const gridRenderKey = computed(
  () => `${viewportSize.value}-${viewportOffset.value.x}-${viewportOffset.value.y}`,
)

const getTileClasses = (tile: MapTile) => {
  const chunkLocked = isChunkLocked(tile)
  // Une tuile dans un cadran débloqué est toujours visible (explored)
  const explored = gameSettings.disableFogOfWar || tile.explored || !chunkLocked
  return [
    `terrain-${tile.type}`,
    {
      'tile-explored': explored && !chunkLocked,
      'tile-current': tile.current,
      'tile-selected': props.selectedTileId === tile.id,
      'tile-chunk-locked': chunkLocked,
      'tile-neutral': tile.type === 'plains',
    },
  ]
}

const selectTile = (tileId: string) => emit('selectTile', tileId)
const getTileIcon = (type: MapTile['type']) => mapStore.getTileIcon(type)

/** Retourne l'identifiant du cadran de la tuile */
const getChunkIdForTile = (tile: MapTile): string =>
  mapStore.getChunkIdForTile(tile.position.x, tile.position.y)

/** Retourne true si la tuile appartient à un cadran encore verrouillé */
const isChunkLocked = (tile: MapTile): boolean => !mapStore.isChunkUnlocked(getChunkIdForTile(tile))

/** Retourne true si des troupes du joueur sont en route vers cette tuile */
/** Retourne true si des troupes du joueur sont en route vers cette tuile */
const hasTroopsEnRoute = (tileId: string): boolean => mapStore.getMovementsToTile(tileId).length > 0

/** Calcule le style de bordure et border-radius d'une bulle selon ses bords visibles */
const getChunkBubbleStyle = (chunk: {
  id: string
  gridColumn: string
  gridRow: string
  borderTop: boolean
  borderRight: boolean
  borderBottom: boolean
  borderLeft: boolean
}) => {
  const B = '2px solid rgba(100, 70, 180, 0.55)'
  const N = 'none'
  const R = '12px'
  const r = '0px'
  return {
    gridColumn: chunk.gridColumn,
    gridRow: chunk.gridRow,
    borderTop: chunk.borderTop ? B : N,
    borderRight: chunk.borderRight ? B : N,
    borderBottom: chunk.borderBottom ? B : N,
    borderLeft: chunk.borderLeft ? B : N,
    // border-radius : arrondi seulement sur les coins dont les deux bords adjacents sont visibles
    borderTopLeftRadius: chunk.borderTop && chunk.borderLeft ? R : r,
    borderTopRightRadius: chunk.borderTop && chunk.borderRight ? R : r,
    borderBottomRightRadius: chunk.borderBottom && chunk.borderRight ? R : r,
    borderBottomLeftRadius: chunk.borderBottom && chunk.borderLeft ? R : r,
    // Pas de margin sur les côtés coupés (pour coller au bord du viewport)
    marginTop: chunk.borderTop ? '3px' : '0',
    marginRight: chunk.borderRight ? '3px' : '0',
    marginBottom: chunk.borderBottom ? '3px' : '0',
    marginLeft: chunk.borderLeft ? '3px' : '0',
  }
}

/**
 * Calcule la liste des cadrans verrouillés visibles dans le viewport,
 * avec leurs coordonnées CSS grid pour l'overlay bulle.
 */
const visibleLockedChunks = computed(() => {
  if (gameSettings.disableFogOfWar) return []

  const { startX, startY, endX, endY } = viewportDimensions.value
  const totalChunks = MAP_CONFIG.size / MAP_CONFIG.chunkSize

  const result: {
    id: string
    gridColumn: string
    gridRow: string
    borderTop: boolean
    borderRight: boolean
    borderBottom: boolean
    borderLeft: boolean
  }[] = []

  for (let cy = 0; cy < totalChunks; cy++) {
    for (let cx = 0; cx < totalChunks; cx++) {
      const chunkId = `${cx}-${cy}`
      if (mapStore.isChunkUnlocked(chunkId)) continue

      const chunkStartX = cx * MAP_CONFIG.chunkSize
      const chunkStartY = cy * MAP_CONFIG.chunkSize
      const chunkEndX = chunkStartX + MAP_CONFIG.chunkSize
      const chunkEndY = chunkStartY + MAP_CONFIG.chunkSize

      // Ignorer si le cadran n'est pas dans le viewport
      if (chunkEndX <= startX || chunkStartX >= endX || chunkEndY <= startY || chunkStartY >= endY)
        continue

      // Coordonnées CSS grid relatives au viewport (1-indexed)
      const colStart = Math.max(chunkStartX, startX) - startX + 1
      const colEnd = Math.min(chunkEndX, endX) - startX + 1
      const rowStart = Math.max(chunkStartY, startY) - startY + 1
      const rowEnd = Math.min(chunkEndY, endY) - startY + 1

      // Déterminer quels bords sont visibles (le bord correspond au bord réel du cadran dans le viewport)
      const borderLeft = chunkStartX >= startX
      const borderRight = chunkEndX <= endX
      const borderTop = chunkStartY >= startY
      const borderBottom = chunkEndY <= endY

      result.push({
        id: chunkId,
        gridColumn: `${colStart} / ${colEnd}`,
        gridRow: `${rowStart} / ${rowEnd}`,
        borderTop,
        borderRight,
        borderBottom,
        borderLeft,
      })
    }
  }

  return result
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
  display: flex;
  justify-content: space-evenly;
}

/* Wrapper pour superposer la grille principale et l'overlay cadrans */
.map-grid-wrapper {
  position: relative;
  flex-shrink: 0;
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

.tile-neutral {
  cursor: default;
}

.tile-neutral:hover {
  transform: none;
  border-color: #555;
}

.tile-being-explored {
  background: #2a2a2a !important;
}

/* Terrains (visibles uniquement si exploré) */
.tile-explored.terrain-plains {
  background: linear-gradient(135deg, #8bc34a, #689f38);
}
.tile-explored.terrain-forest {
  background: linear-gradient(135deg, #4caf50, #2e7d32);
}
.tile-explored.terrain-mountain {
  background: linear-gradient(135deg, #78909c, #455a64);
}
.tile-explored.terrain-water {
  background: linear-gradient(135deg, #2196f3, #1565c0);
}
.tile-explored.terrain-village_player {
  background: linear-gradient(135deg, #ff9800, #f57c00);
}
.tile-explored.terrain-village_enemy {
  background: linear-gradient(135deg, #f44336, #c62828);
}
.tile-explored.terrain-ruins {
  background: linear-gradient(135deg, #9e9e9e, #424242);
}
.tile-explored.terrain-stronghold {
  background: linear-gradient(135deg, #673ab7, #4527a0);
}

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

.tile-exploring {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 3px;
  z-index: 3;
  overflow: hidden;
}

.progress-circle {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.circle-bg {
  fill: none;
  stroke: rgba(74, 158, 255, 0.2);
  stroke-width: 2;
}

.circle-progress {
  fill: none;
  stroke: #4a9eff;
  stroke-width: 2.5;
  stroke-linecap: round;
  transition: stroke-dasharray 0.3s ease;
}

.exploring-content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  background: rgba(0, 0, 0, 0.4);
  border-radius: 50%;
  width: 70%;
  height: 70%;
}

.exploring-icon {
  font-size: clamp(14px, 2.5vw, 24px);
}

.exploring-timer {
  font-size: clamp(8px, 1.2vw, 12px);
  color: #4a9eff;
  font-weight: bold;
  font-family: monospace;
}

.current-marker {
  position: absolute;
  top: -3px;
  right: -3px;
  font-size: clamp(10px, 1.5vw, 14px);
  z-index: 4;
}

.troops-en-route {
  position: absolute;
  bottom: 2px;
  right: 2px;
  font-size: clamp(9px, 1.3vw, 13px);
  z-index: 4;
  animation: pulse-troop 1s ease-in-out infinite;
}

@keyframes pulse-troop {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.3;
  }
}

/* Overlay cadrans : même grille CSS, superposée au-dessus */
.map-chunk-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none; /* laisse passer les clics vers les tuiles */
}

/* Bulle d'un cadran verrouillé */
.chunk-locked-bubble {
  pointer-events: auto;
  position: relative;
  background: rgba(5, 5, 25, 0.82);
  /* border et border-radius injectés dynamiquement via :style */
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  backdrop-filter: blur(3px);
  transition:
    background 0.2s ease,
    border-color 0.2s ease,
    box-shadow 0.2s ease;
  overflow: hidden;
}

.chunk-locked-bubble::before {
  content: '';
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    45deg,
    transparent,
    transparent 6px,
    rgba(100, 70, 180, 0.06) 6px,
    rgba(100, 70, 180, 0.06) 12px
  );
  border-radius: 10px;
  pointer-events: none;
}

.chunk-locked-bubble:hover {
  background: rgba(60, 30, 120, 0.88);
  border-color: rgba(170, 130, 255, 0.8);
  box-shadow:
    0 0 18px rgba(140, 90, 255, 0.45),
    inset 0 0 12px rgba(140, 90, 255, 0.12);
}

.chunk-bubble-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  z-index: 1;
  text-align: center;
  padding: 4px;
}

.chunk-bubble-lock {
  font-size: clamp(16px, 3vw, 30px);
  line-height: 1;
  filter: drop-shadow(0 0 6px rgba(150, 100, 255, 0.7));
}

.chunk-bubble-label {
  font-size: clamp(9px, 1.2vw, 13px);
  font-weight: 700;
  color: #c0b0ff;
  text-shadow: 0 0 6px rgba(150, 100, 255, 0.8);
  letter-spacing: 0.04em;
}

.chunk-bubble-hint {
  font-size: clamp(8px, 1vw, 11px);
  color: #7060a0;
  font-style: italic;
}

.chunk-locked-bubble:hover .chunk-bubble-hint {
  color: #b0a0e8;
}

.tile-chunk-locked {
  background: #0d0d1a !important;
  cursor: default;
  pointer-events: none;
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
  z-index: 4;
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
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
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
