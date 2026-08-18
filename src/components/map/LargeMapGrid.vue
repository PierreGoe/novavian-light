<template>
  <div class="large-map-container">
    <!-- Contrôles de zoom — en dehors du viewport, sur la base claire. -->
    <div class="map-controls">
      <SectionLabel>Vue</SectionLabel>
      <SegmentedControl
        :options="zoomOptions"
        :model-value="String(viewportSize)"
        @update:model-value="(v) => setZoomPreset(Number(v))"
      />
      <div class="controls-divider" />
      <Button variant="secondary" size="sm" @click="centerOnPlayer">🎯 Centrer</Button>
    </div>

    <!-- Coordonnées actuelles -->
    <div class="coordinates-display">
      Position: ({{ viewportCenter.x }}, {{ viewportCenter.y }})
    </div>

    <!-- Viewport principal avec défilement -->
    <div
      ref="mapViewportRef"
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
            v-clickable="tile.type !== 'plains' && !isChunkLocked(tile)"
            @click="tile.type !== 'plains' && !isChunkLocked(tile) && selectTile(tile.id)"
          >
            <!-- Icône du terrain visible uniquement si exploré et dans un cadran déverrouillé -->
            <div
              class="tile-icon"
              :style="{ fontSize: tileIconFontSize }"
              v-if="
                tile.type !== 'plains' &&
                (gameSettings.disableFogOfWar || (tile.explored && !isChunkLocked(tile)))
              "
            >
              {{ getTileIcon(tile.type) }}
            </div>

            <div class="current-marker" :style="{ fontSize: tileIconFontSize }" v-if="tile.current">
              📍
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
            v-clickable
            @click.stop="emit('unlock-chunk', chunk.id)"
          >
            <div class="chunk-bubble-inner">
              <span class="chunk-bubble-lock">🔒</span>
              <span class="chunk-bubble-label">Zone {{ chunk.id }}</span>
              <span class="chunk-bubble-hint">Cliquer pour révéler</span>
            </div>
          </div>
        </div>

        <!-- Overlay des troupes en marche — icône interpolée entre case source et cible -->
        <div class="map-movement-overlay">
          <!-- Trajets (départ → arrivée) : troupes du joueur + menaces ennemies -->
          <svg class="map-path-svg">
            <defs>
              <marker
                id="map-arrow-outgoing"
                markerWidth="8"
                markerHeight="8"
                refX="6"
                refY="4"
                orient="auto-start-reverse"
              >
                <path d="M0,0 L8,4 L0,8 z" class="map-arrow-fill map-arrow-fill--outgoing" />
              </marker>
              <marker
                id="map-arrow-returning"
                markerWidth="8"
                markerHeight="8"
                refX="6"
                refY="4"
                orient="auto-start-reverse"
              >
                <path d="M0,0 L8,4 L0,8 z" class="map-arrow-fill map-arrow-fill--returning" />
              </marker>
              <marker
                id="map-arrow-enemy"
                markerWidth="8"
                markerHeight="8"
                refX="6"
                refY="4"
                orient="auto-start-reverse"
              >
                <path d="M0,0 L8,4 L0,8 z" class="map-arrow-fill map-arrow-fill--enemy" />
              </marker>
            </defs>
            <path
              v-for="path in attackPaths"
              :key="`path-${path.id}`"
              :d="path.d"
              class="path-line"
              :class="`path-line--${path.variant}`"
              :marker-end="`url(#map-arrow-${path.variant})`"
            >
              <title>
                {{ path.variant === 'returning' ? 'Retour vers le village' : 'Attaque en cours' }}
              </title>
            </path>
            <path
              v-for="threat in enemyThreats"
              :key="`threat-${threat.id}`"
              :d="threat.d"
              class="path-line path-line--enemy"
              marker-end="url(#map-arrow-enemy)"
            >
              <title>Attaque ennemie dans {{ Math.ceil(threat.msRemaining / 1000) }}s</title>
            </path>
          </svg>

          <!-- Badge des troupes du joueur en marche -->
          <div
            v-for="marker in marchingMarkers"
            :key="marker.id"
            class="march-marker"
            :class="{ 'march-marker--returning': marker.isReturning }"
            :style="markerStyle(marker)"
            :title="marker.isReturning ? 'Retour vers le village' : 'Troupes en marche'"
          >
            <span class="march-marker-badge">{{ marker.isReturning ? '↩️' : '🪖' }}</span>
          </div>

          <!-- Badge des menaces ennemies en approche -->
          <div
            v-for="threat in enemyThreats"
            :key="`threat-badge-${threat.id}`"
            class="march-marker march-marker--enemy"
            :style="markerStyle(threat)"
            :title="`Attaque ennemie dans ${Math.ceil(threat.msRemaining / 1000)}s`"
          >
            <span class="march-marker-badge">💀</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Indicateur de chargement -->
    <div v-if="isLoading" class="loading-indicator">⏳ Chargement de la carte...</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  useMapStore,
  type MapTile,
  MAP_CONFIG,
  type HostilityState,
  HOSTILE_ATTACK_INTERVAL_MS,
} from '../../stores/mapStore'
import { useMapViewport, ZOOM_PRESETS } from '../../composables/useMapViewport'
import { gameSettings } from '../../stores/gameSettingsStore'
import { GARRISON_REGEN_DURATION_MS } from '../../config'
import SectionLabel from '@/components/ui/SectionLabel.vue'
import SegmentedControl from '@/components/ui/SegmentedControl.vue'
import Button from '@/components/ui/Button.vue'

const zoomOptions = computed(() =>
  ZOOM_PRESETS.map((preset) => ({
    label: preset.label,
    value: String(preset.value),
    icon: preset.icon,
  })),
)

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

// Taille réelle du viewport (suit .map-viewport, y compris son breakpoint mobile height: 400px)
const mapViewportRef = ref<HTMLElement | null>(null)
const viewportPixelHeight = ref(600)
let viewportResizeObserver: ResizeObserver | null = null

// Horloge dédiée à l'animation de marche — découplée du tick de résolution de combat (1s)
const marchNow = ref(Date.now())
let marchInterval: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  if (!mapViewportRef.value) return
  viewportResizeObserver = new ResizeObserver((entries) => {
    const entry = entries[0]
    if (entry) viewportPixelHeight.value = entry.contentRect.height
  })
  viewportResizeObserver.observe(mapViewportRef.value)
})

onMounted(() => {
  marchInterval = setInterval(() => {
    marchNow.value = Date.now()
  }, 200)
})

onUnmounted(() => {
  viewportResizeObserver?.disconnect()
  if (marchInterval) clearInterval(marchInterval)
})

// Dimensions réelles du viewport après clamping aux bords de la carte
const viewportDimensions = computed(() => {
  const startX = Math.max(0, viewportOffset.value.x)
  const startY = Math.max(0, viewportOffset.value.y)
  const endX = Math.min(MAP_CONFIG.size, startX + viewportSize.value)
  const endY = Math.min(MAP_CONFIG.size, startY + viewportSize.value)
  return { startX, startY, endX, endY, cols: endX - startX, rows: endY - startY }
})

// Index spatial des tuiles — Map<"x,y", MapTile> pour un accès O(1)
// Recalculé uniquement quand le tableau de tuiles change de référence (pas à chaque mutation).
const tileIndex = computed(() => {
  const map = new Map<string, MapTile>()
  for (const tile of props.tiles) {
    map.set(`${tile.position.x},${tile.position.y}`, tile)
  }
  return map
})

// Computed — tuiles visibles en ordre ligne-par-ligne (y croissant, x croissant).
// Accès direct par coordonnées : pas de filter ni de sort sur 2500 éléments.
const visibleTiles = computed(() => {
  const { startX, startY, endX, endY } = viewportDimensions.value
  const index = tileIndex.value
  const result: MapTile[] = []

  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      const tile = index.get(`${x},${y}`)
      if (tile) result.push(tile)
    }
  }
  return result
})

// Style CSS Grid — computed pour garantir la synchronisation avec viewportDimensions
const tileSizeAdaptive = computed(() => {
  const { cols } = viewportDimensions.value
  const containerSize = viewportPixelHeight.value - 40
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

// Doit refléter le CSS : .map-grid-large { padding: 20px } et gridStyle.gap ('2px')
const GRID_PADDING_PX = 20
const GRID_GAP_PX = 2

interface MarchingMarker {
  id: string
  x: number
  y: number
  isReturning: boolean
}

/** Position interpolée de chaque mouvement de troupes actif, entre sa case source et sa case cible */
const marchingMarkers = computed<MarchingMarker[]>(() => {
  const now = marchNow.value
  const result: MarchingMarker[] = []
  for (const movement of mapStore.mapState.activeMovements) {
    const source = mapStore.getTileById(movement.sourceTileId)
    const target = mapStore.getTileById(movement.targetTileId)
    if (!source || !target) continue

    const duration = movement.arrivalTime - movement.departureTime
    const progress =
      duration <= 0 ? 1 : Math.min(1, Math.max(0, (now - movement.departureTime) / duration))

    result.push({
      id: movement.id,
      x: source.position.x + (target.position.x - source.position.x) * progress,
      y: source.position.y + (target.position.y - source.position.y) * progress,
      isReturning: !!movement.isReturning,
    })
  }
  return result
})

/** Style pixel d'un marqueur de marche, aligné sur la même grille que les tuiles */
const markerStyle = (marker: { x: number; y: number }) => {
  const { startX, startY } = viewportDimensions.value
  const step = tileSizeAdaptive.value + GRID_GAP_PX
  const size = tileSizeAdaptive.value
  return {
    left: `${GRID_PADDING_PX + (marker.x - startX) * step}px`,
    top: `${GRID_PADDING_PX + (marker.y - startY) * step}px`,
    width: `${size}px`,
    height: `${size}px`,
    fontSize: tileIconFontSize.value,
  }
}

/** Centre en pixels d'une case (coordonnée carte), pour tracer les traits de trajet */
const tileCenterPx = (x: number, y: number) => {
  const { startX, startY } = viewportDimensions.value
  const step = tileSizeAdaptive.value + GRID_GAP_PX
  const half = tileSizeAdaptive.value / 2
  return {
    cx: GRID_PADDING_PX + (x - startX) * step + half,
    cy: GRID_PADDING_PX + (y - startY) * step + half,
  }
}

/** Chemin SVG en léger arc entre deux cases (aspect "flèche de carte" plutôt qu'un trait droit) */
const curvedPathD = (x1: number, y1: number, x2: number, y2: number): string => {
  const { cx: cx1, cy: cy1 } = tileCenterPx(x1, y1)
  const { cx: cx2, cy: cy2 } = tileCenterPx(x2, y2)
  const dx = cx2 - cx1
  const dy = cy2 - cy1
  const dist = Math.hypot(dx, dy)
  if (dist === 0) return `M ${cx1} ${cy1} L ${cx2} ${cy2}`
  const bulge = Math.min(dist * 0.15, 40)
  const midX = (cx1 + cx2) / 2 - (dy / dist) * bulge
  const midY = (cy1 + cy2) / 2 + (dx / dist) * bulge
  return `M ${cx1} ${cy1} Q ${midX} ${midY} ${cx2} ${cy2}`
}

interface AttackPath {
  id: string
  d: string
  variant: 'outgoing' | 'returning'
}

/** Un trait départ → arrivée par mouvement de troupes actif du joueur */
const attackPaths = computed<AttackPath[]>(() => {
  const result: AttackPath[] = []
  for (const movement of mapStore.mapState.activeMovements) {
    const source = mapStore.getTileById(movement.sourceTileId)
    const target = mapStore.getTileById(movement.targetTileId)
    if (!source || !target) continue
    result.push({
      id: movement.id,
      d: curvedPathD(source.position.x, source.position.y, target.position.x, target.position.y),
      variant: movement.isReturning ? 'returning' : 'outgoing',
    })
  }
  return result
})

interface EnemyThreat {
  id: string
  x: number
  y: number
  isReturning: boolean
  d: string
  msRemaining: number
}

/**
 * Attaques ennemies imminentes : une forteresse hostile avec un `nextAttackAt` planifié.
 * Le trajet (forteresse → village du joueur) et la progression sont reconstitués à partir
 * de la fenêtre de temps HOSTILE_ATTACK_INTERVAL_MS, pour donner au joueur un avertissement
 * visuel avant que le raid ne se résolve (résolution abstraite, sans déplacement réel côté jeu).
 */
const enemyThreats = computed<EnemyThreat[]>(() => {
  const now = marchNow.value
  const home = mapStore.mapState.currentPosition
  const result: EnemyThreat[] = []
  for (const zone of Object.values(mapStore.mapState.fortressZones)) {
    if (zone.hostilityState !== 'hostile' || !zone.nextAttackAt) continue
    const fortress = mapStore.getTileById(zone.fortressTileId)
    if (!fortress) continue

    const departureTime = zone.nextAttackAt - HOSTILE_ATTACK_INTERVAL_MS
    const progress = Math.min(1, Math.max(0, (now - departureTime) / HOSTILE_ATTACK_INTERVAL_MS))

    result.push({
      id: zone.fortressTileId,
      x: fortress.position.x + (home.x - fortress.position.x) * progress,
      y: fortress.position.y + (home.y - fortress.position.y) * progress,
      isReturning: false,
      d: curvedPathD(fortress.position.x, fortress.position.y, home.x, home.y),
      msRemaining: Math.max(0, zone.nextAttackAt - now),
    })
  }
  return result
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
  const influenceState = influenceZoneMap.value.get(tile.id)
  return [
    `terrain-${tile.type}`,
    {
      'tile-explored': explored && !chunkLocked,
      'tile-current': tile.current,
      'tile-selected': props.selectedTileId === tile.id,
      'tile-chunk-locked': chunkLocked,
      'tile-neutral': tile.type === 'plains',
      [`tile-influence--${influenceState}`]: !!influenceState,
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
 * Computed — map tileId → hostilityState pour toutes les tuiles situées
 * dans le carré Chebyshev d'une forteresse. Utilisé dans getTileClasses.
 */
const influenceZoneMap = computed(() => {
  const zones = Object.values(mapStore.mapState.fortressZones)
  const map = new Map<string, HostilityState>()
  if (zones.length === 0 || !gameSettings.showInfluenceZones) return map

  const index = tileIndex.value

  for (const zone of zones) {
    const fortress = mapStore.getTileById(zone.fortressTileId)
    if (!fortress) continue
    const { x: fx, y: fy } = fortress.position
    const r = zone.influenceRadius

    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        // Distance de Manhattan : losange (4 cases en cardinal, 2 en diagonal)
        if (Math.abs(dx) + Math.abs(dy) > r) continue
        const x = fx + dx
        const y = fy + dy
        if (x < 0 || x >= MAP_CONFIG.size || y < 0 || y >= MAP_CONFIG.size) continue
        const tile = index.get(`${x},${y}`)
        if (!tile || map.has(tile.id)) continue
        map.set(tile.id, zone.hostilityState)
      }
    }
  }

  return map
})
</script>

<style scoped>
.large-map-container {
  position: relative;
  width: 100%;
  background: var(--color-bg-surface);
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
  border: 1px solid rgba(var(--overlay-rgb), 0.18);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s ease;
  background: rgba(var(--overlay-rgb), 0.85);
}

.map-tile:hover {
  border-color: rgba(var(--color-accent-rgb), 0.55);
  transform: scale(1.05);
  z-index: 10;
}

.tile-explored {
  border-color: rgba(var(--color-accent-rgb), 0.3);
}

.tile-current {
  border-color: var(--color-accent);
  box-shadow: 0 0 10px rgba(var(--color-accent-rgb), 0.5);
}

.tile-selected {
  border-color: var(--color-accent-dark);
  box-shadow: 0 0 15px rgba(var(--color-accent-dark-rgb), 0.6);
  z-index: 11;
}

.tile-neutral {
  cursor: default;
}

.tile-neutral:hover {
  transform: none;
  border-color: rgba(var(--overlay-rgb), 0.18);
}

.tile-being-explored {
  background: rgba(var(--overlay-rgb), 0.7) !important;
}

/* Terrains (visibles uniquement si exploré) — un seul jeu de teintes,
   partagé avec TileDetails.vue via les tokens --terrain-* de tokens.css. */
.tile-explored.terrain-plains {
  background: linear-gradient(145deg, rgba(var(--terrain-plains-rgb), 0.92), rgba(var(--terrain-plains-rgb), 0.68));
}
.tile-explored.terrain-forest {
  background: linear-gradient(145deg, rgba(var(--terrain-forest-rgb), 0.92), rgba(var(--terrain-forest-rgb), 0.68));
}
.tile-explored.terrain-mountain {
  background: linear-gradient(145deg, rgba(var(--terrain-mountain-rgb), 0.92), rgba(var(--terrain-mountain-rgb), 0.68));
}
.tile-explored.terrain-water {
  background: linear-gradient(145deg, rgba(var(--terrain-water-rgb), 0.92), rgba(var(--terrain-water-rgb), 0.68));
}
.tile-explored.terrain-village_player {
  background: linear-gradient(145deg, rgba(var(--terrain-village-player-rgb), 0.92), rgba(var(--terrain-village-player-rgb), 0.68));
}
.tile-explored.terrain-village_enemy {
  background: linear-gradient(145deg, rgba(var(--terrain-village-enemy-rgb), 0.92), rgba(var(--terrain-village-enemy-rgb), 0.68));
}
.tile-explored.terrain-ruins {
  background: linear-gradient(145deg, rgba(var(--terrain-ruins-rgb), 0.92), rgba(var(--terrain-ruins-rgb), 0.68));
}
.tile-explored.terrain-stronghold {
  background: linear-gradient(145deg, rgba(var(--terrain-stronghold-rgb), 0.92), rgba(var(--terrain-stronghold-rgb), 0.68));
}

.tile-icon {
  z-index: 2;
  line-height: 1;
}

/* Overlay HUD posé sur une tuile de la carte — volontairement scrim noir/texte
   blanc fixe (pas de tokens) : doit rester lisible par-dessus n'importe quel
   terrain, indépendamment du thème clair de l'app. Même logique pour les
   autres overlays HUD de ce fichier (badge de garnison, coordonnées, chargement,
   panneau debug). */
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

/* Overlay cadrans : même grille CSS, superposée au-dessus */
.map-chunk-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none; /* laisse passer les clics vers les tuiles */
}

/* Overlay des troupes en marche — positionnement pixel libre, superposé à tout le reste */
.map-movement-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.march-marker {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    left 0.2s linear,
    top 0.2s linear;
  z-index: 2;
}

/* Badge circulaire autour de l'icône — la rend lisible sur n'importe quel fond de tuile.
   Le fond sombre reste fixe (HUD, cf. note plus haut) ; seul l'anneau reprend les tokens
   sémantiques déjà utilisés pour l'envoi d'attaque dans AttackPanel.vue. */
.march-marker-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 78%;
  height: 78%;
  border-radius: 50%;
  background: radial-gradient(circle at 30% 30%, #4a3420, #1a0f08 85%);
  border: 2px solid var(--color-danger);
  box-shadow:
    0 2px 5px rgba(0, 0, 0, 0.6),
    0 0 8px rgba(var(--color-danger-rgb), 0.55);
}

.march-marker--returning .march-marker-badge {
  border-color: var(--color-success-strong);
  box-shadow:
    0 2px 5px rgba(0, 0, 0, 0.6),
    0 0 8px rgba(var(--color-success-strong-rgb), 0.55);
}

/* Menace ennemie en approche — distincte des troupes du joueur, pulsation d'alerte */
.march-marker--enemy .march-marker-badge {
  border-color: var(--color-warning);
  box-shadow:
    0 2px 5px rgba(0, 0, 0, 0.6),
    0 0 10px rgba(var(--color-warning-rgb), 0.65);
  animation: enemy-pulse 1s ease-in-out infinite;
}

@keyframes enemy-pulse {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.12);
  }
}

/* Trajets départ → arrivée, en arc, façon flèche de carte */
.map-path-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  overflow: visible;
  z-index: 1;
}

.path-line {
  fill: none;
  stroke-width: 2.5;
}

.path-line--outgoing {
  stroke: var(--color-danger);
  stroke-dasharray: none;
}

.path-line--returning {
  stroke: var(--color-success-strong);
  stroke-dasharray: 5 4;
  opacity: 0.85;
}

.path-line--enemy {
  stroke: var(--color-warning);
  stroke-dasharray: 4 5;
  animation: enemy-path-pulse 1s ease-in-out infinite;
}

.map-arrow-fill--outgoing {
  fill: var(--color-danger);
}
.map-arrow-fill--returning {
  fill: var(--color-success-strong);
}
.map-arrow-fill--enemy {
  fill: var(--color-warning);
}

@keyframes enemy-path-pulse {
  0%,
  100% {
    opacity: 0.6;
  }
  50% {
    opacity: 1;
  }
}

/* Couche rouge transparente sur les tuiles en zone d'influence */
.map-tile.tile-influence--neutral::after,
.map-tile.tile-influence--warned::after,
.map-tile.tile-influence--hostile::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  border-radius: 3px;
  box-sizing: border-box;
}

/* Zone neutre */
.map-tile.tile-influence--neutral::after {
  background: rgba(var(--color-danger-rgb), 0.25);
  border: 1px solid rgba(var(--color-danger-rgb), 0.5);
}

/* Zone avertie */
.map-tile.tile-influence--warned::after {
  background: rgba(var(--color-warning-rgb), 0.38);
  border: 1px solid rgba(var(--color-warning-rgb), 0.65);
}

/* Zone hostile — intense, avec pulse */
.map-tile.tile-influence--hostile::after {
  background: rgba(var(--color-danger-rgb), 0.5);
  border: 1px solid rgba(var(--color-danger-rgb), 0.8);
  animation: hostile-pulse 2s ease-in-out infinite;
}

@keyframes hostile-pulse {
  0%,
  100% {
    opacity: 0.7;
  }
  50% {
    opacity: 1;
  }
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
  overflow: hidden;
}

/* Filet de sécurité cross-browser : masque tout contenu enfant des tuiles verrouillées */
.tile-chunk-locked > * {
  visibility: hidden;
}

/* Minimap supprimée */

/* Contrôles */
.map-controls {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 10px 14px;
  background: rgba(var(--overlay-rgb), 0.03);
  border-bottom: 1px solid rgba(var(--overlay-rgb), 0.1);
  border-radius: 12px 12px 0 0;
  flex-shrink: 0;
}

.controls-divider {
  width: 1px;
  height: 20px;
  background: rgba(var(--overlay-rgb), 0.15);
  margin: 0 4px;
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
}
</style>
