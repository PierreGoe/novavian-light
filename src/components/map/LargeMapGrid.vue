<template>
  <div class="large-map-container">
    <!-- Contrôles de zoom — en dehors du viewport -->
    <div class="map-controls">
      <span class="controls-label">Vue :</span>
      <button
        v-for="preset in ZOOM_PRESETS"
        :key="preset.value"
        @click="setZoomPreset(preset.value)"
        :class="['control-btn', { 'control-btn--active': viewportSize === preset.value }]"
      >
        {{ preset.icon }} {{ preset.label }}
      </button>
      <div class="controls-divider" />
      <button @click="centerOnPlayer" class="control-btn">🎯 Centrer</button>
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
              :style="{ fontSize: tileIconFontSize }"
              v-if="(gameSettings.disableFogOfWar || tile.explored) && tile.type !== 'plains'"
            >
              {{ getTileIcon(tile.type) }}
            </div>

            <div class="current-marker" :style="{ fontSize: tileIconFontSize }" v-if="tile.current">
              📍
            </div>
            <!-- Indicateur : troupes en route vers cette tuile -->
            <div
              class="troops-en-route"
              :style="{ fontSize: tileIconFontSize }"
              v-if="hasTroopsEnRoute(tile.id)"
            >
              🪖
            </div>
            <!-- Indicateur : garnison en reconstitution -->
            <div
              class="garrison-regen-badge"
              v-if="isGarrisonRegenerating(tile) && (gameSettings.disableFogOfWar || tile.explored)"
            >
              ↺
            </div>
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

        <!-- Overlay zones d’influence des forteresses -->
        <div
          v-if="visibleInfluenceOverlay.length > 0"
          class="map-grid-large map-influence-overlay"
          :key="`influence-${gridRenderKey}`"
          :style="gridStyle"
        >
          <div
            v-for="cell in visibleInfluenceOverlay"
            :key="cell.tileId"
            class="influence-cell"
            :class="`influence-cell--${cell.hostilityState}`"
            :style="{ gridColumn: cell.col, gridRow: cell.row }"
          />
        </div>
      </div>
    </div>

    <!-- Panneau debug forteresses -->
    <div
      class="debug-fortress-panel"
      v-if="Object.keys(mapStore.mapState.fortressZones).length > 0"
    >
      <div class="debug-title">🔍 Debug forteresses</div>
      <div
        v-for="zone in mapStore.mapState.fortressZones"
        :key="zone.fortressTileId"
        class="debug-zone"
        :class="`debug-zone--${zone.hostilityState}`"
      >
        <span class="debug-id">{{ zone.fortressTileId }}</span>
        <span class="debug-power">⚔️ {{ zone.power }}</span>
        <span class="debug-level">📊 {{ zone.hostilityLevel }}%</span>
        <span class="debug-state">{{ zone.hostilityState }}</span>
      </div>
    </div>

    <!-- Indicateur de chargement -->
    <div v-if="isLoading" class="loading-indicator">⏳ Chargement de la carte...</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useMapStore, type MapTile, MAP_CONFIG, type HostilityState } from '../../stores/mapStore'
import { useMapViewport, ZOOM_PRESETS } from '../../composables/useMapViewport'
import { gameSettings } from '../../stores/gameSettingsStore'
import { GARRISON_REGEN_DURATION_MS } from '../../config'

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
  setZoomPreset,
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
const tileSizeAdaptive = computed(() => {
  const { cols } = viewportDimensions.value
  const containerSize = 600 - 40
  return Math.floor((containerSize - cols * 2) / cols)
})

const gridStyle = computed(() => {
  const size = tileSizeAdaptive.value
  const { cols } = viewportDimensions.value
  return {
    display: 'grid',
    gridTemplateColumns: `repeat(${cols}, ${size}px)`,
    gridAutoRows: `${size}px`,
    gap: '2px',
  }
})

/** Taille des emojis adaptée à la taille des tuiles */
const tileIconFontSize = computed(() => {
  const size = tileSizeAdaptive.value
  // ~40% de la tuile, clampé entre 10 et 22px
  return `${Math.max(10, Math.min(22, Math.floor(size * 0.4)))}px`
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

/** Vrai si la garnison est en cours de reconstitution (< 100%) */
const isGarrisonRegenerating = (tile: MapTile): boolean => {
  if (!tile.garrison?.regenStartedAt) return false
  const elapsed = Date.now() - tile.garrison.regenStartedAt
  return elapsed < GARRISON_REGEN_DURATION_MS
}

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

/**
 * Computed — cellules de l'overlay zone d'influence visible dans le viewport.
 * Affiche TOUTES les zones de forteresses (neutral inclus).
 */
const visibleInfluenceOverlay = computed(() => {
  const { startX, startY, endX, endY } = viewportDimensions.value
  const zones = Object.values(mapStore.mapState.fortressZones)
  if (zones.length === 0) return []

  const result: { tileId: string; col: string; row: string; hostilityState: HostilityState }[] = []

  for (const zone of zones) {
    const allIds = mapStore.getInfluenceZoneTileIds(zone.fortressTileId)
    for (const tileId of allIds) {
      const tile = mapStore.getTileById(tileId)
      if (!tile) continue
      const { x, y } = tile.position
      if (x < startX || x >= endX || y < startY || y >= endY) continue
      result.push({
        tileId,
        col: `${x - startX + 1}`,
        row: `${y - startY + 1}`,
        hostilityState: zone.hostilityState,
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
  background: #1a1a1a;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
}

.map-viewport {
  height: 600px;
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
  z-index: 2;
  line-height: 1;
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

/* Badge "en reconstitution" — garnison vaincue en train de régénérer */
.garrison-regen-badge {
  position: absolute;
  top: 2px;
  right: 2px;
  font-size: clamp(8px, 1.2vw, 11px);
  color: #fbbf24;
  background: rgba(0, 0, 0, 0.6);
  border-radius: 3px;
  padding: 0 2px;
  z-index: 5;
  animation: regen-spin 2s linear infinite;
  line-height: 1;
}

@keyframes regen-spin {
  0% {
    opacity: 1;
    transform: rotate(0deg);
  }
  50% {
    opacity: 0.5;
  }
  100% {
    opacity: 1;
    transform: rotate(360deg);
  }
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

/* Overlay zones d'influence des forteresses */
.map-influence-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.influence-cell {
  position: relative;
}

/* Zone neutre — contour rouge très subtil */
.influence-cell--neutral {
  background: rgba(239, 68, 68, 0.06);
  border: 1px solid rgba(239, 68, 68, 0.2);
  box-sizing: border-box;
}

/* Zone avertie — teinte orange légère */
.influence-cell--warned {
  background: rgba(251, 146, 60, 0.18);
  border: 1px solid rgba(251, 146, 60, 0.35);
  box-sizing: border-box;
}

/* Zone hostile — teinte rouge intense */
.influence-cell--hostile {
  background: rgba(239, 68, 68, 0.22);
  border: 1px solid rgba(239, 68, 68, 0.45);
  box-sizing: border-box;
  animation: hostile-pulse 2s ease-in-out infinite;
}

@keyframes hostile-pulse {
  0%,
  100% {
    background: rgba(239, 68, 68, 0.18);
  }
  50% {
    background: rgba(239, 68, 68, 0.34);
  }
}

/* ── Panneau debug forteresses ── */
.debug-fortress-panel {
  position: absolute;
  bottom: 8px;
  left: 8px;
  z-index: 200;
  background: rgba(5, 5, 20, 0.9);
  border: 1px solid #333;
  border-radius: 8px;
  padding: 8px 10px;
  font-family: monospace;
  font-size: 11px;
  color: #ccc;
  backdrop-filter: blur(4px);
  max-height: 180px;
  overflow-y: auto;
  min-width: 220px;
}

.debug-title {
  font-weight: bold;
  color: #fff;
  margin-bottom: 6px;
  border-bottom: 1px solid #333;
  padding-bottom: 4px;
}

.debug-zone {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 2px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.debug-id {
  color: #888;
  min-width: 50px;
}
.debug-power {
  color: #f87171;
}
.debug-level {
  color: #94a3b8;
}

.debug-zone--neutral .debug-state {
  color: #4ade80;
}
.debug-zone--warned .debug-state {
  color: #fb923c;
}
.debug-zone--hostile .debug-state {
  color: #f87171;
  font-weight: bold;
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
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 10px 14px;
  background: rgba(0, 0, 0, 0.5);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px 12px 0 0;
  flex-shrink: 0;
}

.controls-label {
  color: #7a9abf;
  font-size: 0.8em;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-right: 4px;
}

.controls-divider {
  width: 1px;
  height: 20px;
  background: rgba(255, 255, 255, 0.15);
  margin: 0 4px;
}

.control-btn {
  background: rgba(74, 158, 255, 0.15);
  color: #b0c8e8;
  border: 1px solid rgba(74, 158, 255, 0.3);
  padding: 5px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.82em;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.control-btn:hover {
  background: rgba(74, 158, 255, 0.4);
  color: #fff;
  border-color: #4a9eff;
  transform: translateY(-1px);
}

.control-btn--active {
  background: rgba(74, 158, 255, 0.55);
  color: #fff;
  border-color: #4a9eff;
  box-shadow: 0 0 8px rgba(74, 158, 255, 0.4);
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
  .map-viewport {
    height: 400px;
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
