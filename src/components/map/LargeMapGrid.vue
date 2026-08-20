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
      <div class="controls-divider" />
      <!-- Vue isométrique — architecture du pen « Stack Sprite », choix persisté -->
      <Button
        :variant="gameSettings.mapIsoView ? 'primary' : 'secondary'"
        size="sm"
        @click="gameSettings.mapIsoView = !gameSettings.mapIsoView"
      >
        🧊 Iso
      </Button>
      <template v-if="gameSettings.mapIsoView">
        <label class="iso-slider" title="Rotation du plateau">
          ↻
          <input type="range" min="0" max="90" v-model.number="gameSettings.mapIsoAngles.z" />
        </label>
        <label class="iso-slider" title="Inclinaison du plateau">
          ⤓
          <input type="range" min="15" max="70" v-model.number="gameSettings.mapIsoAngles.x" />
        </label>
      </template>
    </div>

    <!-- Coordonnées actuelles -->
    <div class="coordinates-display">
      Position: ({{ viewportCenter.x }}, {{ viewportCenter.y }})
    </div>

    <!-- Viewport principal avec défilement -->
    <div
      ref="mapViewportRef"
      class="map-viewport"
      :class="{ 'map-viewport--iso': gameSettings.mapIsoView }"
      @mousedown="startPan"
      @mousemove="handlePan"
      @mouseup="endPan"
      @mouseleave="endPan"
      :style="{ cursor: isPanning ? 'grabbing' : 'grab', ...isoStyleVars }"
    >
      <!-- Wrapper pour superposer la grille principale et l'overlay cadrans.
           Dimensionné sur la zone visible et en overflow hidden : la grille rendue
           est plus grande (marge de tuiles tampon) et glisse dessous pendant le pan. -->
      <div class="map-grid-wrapper" :style="wrapperStyle">
        <div class="map-pan-layer" :style="panLayerStyle">
          <div class="map-grid-large" :key="`grid-${gridRenderKey}`" :style="gridStyle">
            <!-- Rendu des tuiles visibles + une marge tampon hors écran -->
            <div
              v-for="tile in renderedTiles"
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

              <div
                class="current-marker"
                :style="{ fontSize: tileIconFontSize }"
                v-if="tile.current"
              >
                📍
              </div>
              <!-- Indicateur : garnison en reconstitution -->
              <div
                class="garrison-regen-badge"
                v-if="
                  isGarrisonRegenerating(tile) && (gameSettings.disableFogOfWar || tile.explored)
                "
              >
                ↺
              </div>
            </div>
          </div>

          <!-- Overlay bulle par cadran verrouillé (remplace les overlays par tuile).
             Chaque bulle couvre l'étendue COMPLÈTE de son cadran, même hors écran :
             le libellé est déjà rendu avant d'entrer dans la vue et glisse avec la
             carte pendant le pan, le wrapper (overflow hidden) rogne ce qui dépasse. -->
          <div
            v-if="!gameSettings.disableFogOfWar && visibleLockedChunks.length > 0"
            class="map-chunk-overlay"
            :key="`overlay-${gridRenderKey}`"
          >
            <div
              v-for="chunk in visibleLockedChunks"
              :key="chunk.id"
              class="chunk-locked-bubble"
              :style="chunk.style"
              v-clickable
              @click.stop="emit('unlock-chunk', chunk.id)"
            >
              <div class="chunk-bubble-inner">
                <span class="chunk-bubble-lock">🔒</span>
                <span class="chunk-bubble-label">Zone {{ chunk.id }}</span>
                <span class="chunk-bubble-hint">Cliquer pour révéler</span>
              </div>
              <!-- Connecteurs en losange au milieu de chaque bord visible -->
              <span v-if="chunk.diamondTop" class="chunk-diamond chunk-diamond--top" />
              <span v-if="chunk.diamondRight" class="chunk-diamond chunk-diamond--right" />
              <span v-if="chunk.diamondBottom" class="chunk-diamond chunk-diamond--bottom" />
              <span v-if="chunk.diamondLeft" class="chunk-diamond chunk-diamond--left" />
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
  panFraction,
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
const viewportPixelWidth = ref(600)
let viewportResizeObserver: ResizeObserver | null = null

// Horloge dédiée à l'animation de marche — découplée du tick de résolution de combat (1s)
const marchNow = ref(Date.now())
let marchInterval: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  if (!mapViewportRef.value) return
  viewportResizeObserver = new ResizeObserver((entries) => {
    const entry = entries[0]
    if (entry) {
      viewportPixelHeight.value = entry.contentRect.height
      viewportPixelWidth.value = entry.contentRect.width
    }
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

// Doit refléter le CSS : .map-grid-large { padding: 20px }
const GRID_PADDING_PX = 20
const GRID_GAP_PX = 2

// Marge de tuiles rendues au-delà de la zone visible : les cases entrent et sortent
// de la vue en glissant sous l'overflow hidden du wrapper au lieu d'apparaître ou
// de disparaître brutalement au bord du plateau.
const RENDER_BUFFER_TILES = 3

// Étendue réellement rendue = zone visible + marge tampon, clampée aux bords de la carte
const renderDimensions = computed(() => {
  const { startX, startY, endX, endY } = viewportDimensions.value
  const rStartX = Math.max(0, startX - RENDER_BUFFER_TILES)
  const rStartY = Math.max(0, startY - RENDER_BUFFER_TILES)
  const rEndX = Math.min(MAP_CONFIG.size, endX + RENDER_BUFFER_TILES)
  const rEndY = Math.min(MAP_CONFIG.size, endY + RENDER_BUFFER_TILES)
  return {
    startX: rStartX,
    startY: rStartY,
    endX: rEndX,
    endY: rEndY,
    cols: rEndX - rStartX,
    rows: rEndY - rStartY,
  }
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

// Computed — tuiles rendues (visibles + tampon) en ordre ligne-par-ligne (y croissant, x croissant).
// Accès direct par coordonnées : pas de filter ni de sort sur 2500 éléments.
const renderedTiles = computed(() => {
  const { startX, startY, endX, endY } = renderDimensions.value
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
  // min(hauteur, largeur) : la grille ne doit jamais déborder de .map-viewport (overflow hidden),
  // sinon les bulles de brouillard sont coupées et leur libellé n'apparaît plus centré
  const containerSize = Math.min(viewportPixelHeight.value, viewportPixelWidth.value) - 40
  return Math.floor((containerSize - cols * 2) / cols)
})

// La grille couvre l'étendue rendue (tampon compris) ; elle est décalée en négatif
// pour que la première tuile VISIBLE reste à l'origine du wrapper — toutes les maths
// pixel des overlays (marqueurs, cadrans, trajets) restent basées sur startX/startY.
const gridStyle = computed(() => {
  const size = tileSizeAdaptive.value
  const step = size + GRID_GAP_PX
  const render = renderDimensions.value
  const { startX, startY } = viewportDimensions.value
  return {
    display: 'grid',
    gridTemplateColumns: `repeat(${render.cols}, ${size}px)`,
    gridAutoRows: `${size}px`,
    gap: `${GRID_GAP_PX}px`,
    left: `${-(startX - render.startX) * step}px`,
    top: `${-(startY - render.startY) * step}px`,
  }
})

// Le wrapper garde la taille du plateau visible : c'est lui qui clippe (overflow hidden)
// la grille tampon qui dépasse.
const wrapperStyle = computed(() => {
  const step = tileSizeAdaptive.value + GRID_GAP_PX
  const { cols, rows } = viewportDimensions.value
  return {
    width: `${cols * step - GRID_GAP_PX + 2 * GRID_PADDING_PX}px`,
    height: `${rows * step - GRID_GAP_PX + 2 * GRID_PADDING_PX}px`,
  }
})

// ── Vue isométrique ────────────────────────────────────────────────────────
// Architecture reprise du pen « Pure CSS Isometric Fake 3D — Stack Sprite »
// (codepen.io/FlokiTV/pen/WNRedMd) : perspective portée par le conteneur,
// plateau incliné rotateX/rotateZ réglables par curseurs (les sliders du pen),
// icônes contre-pivotées et redressées pour rester lisibles — sprites debout.
// Le choix du joueur (mode + angles) est persisté via gameSettings.

// Doit refléter le CSS : .map-viewport--iso { perspective: 1600px }
const ISO_PERSPECTIVE_PX = 1600

const isoStyleVars = computed(() => {
  if (!gameSettings.mapIsoView) return {}
  const xRad = (gameSettings.mapIsoAngles.x * Math.PI) / 180
  const zRad = (gameSettings.mapIsoAngles.z * Math.PI) / 180
  // Compense l'écrasement vertical dû à l'inclinaison : 1 / cos(X)
  const unsquash = 1 / Math.max(0.25, Math.cos(xRad))

  // Échelle auto : le plateau pivoté laisse de grands vides autour du losange
  // si on garde l'échelle 1. On calcule la boîte englobante projetée du plateau
  // (rectangle tourné de Z, écrasé verticalement de cos(X)) et on l'ajuste à
  // l'espace disponible du viewport, en intégrant le grossissement du bord
  // proche dû à la perspective : m = P / (P - lift), résolu en échelle fermée.
  const step = tileSizeAdaptive.value + GRID_GAP_PX
  const { cols, rows } = viewportDimensions.value
  const boardW = cols * step - GRID_GAP_PX + 2 * GRID_PADDING_PX
  const boardH = rows * step - GRID_GAP_PX + 2 * GRID_PADDING_PX
  const cosZ = Math.abs(Math.cos(zRad))
  const sinZ = Math.abs(Math.sin(zRad))
  const projW = boardW * cosZ + boardH * sinZ
  const projH = (boardW * sinZ + boardH * cosZ) * Math.cos(xRad)
  // Élévation du coin proche vers la caméra, par unité d'échelle
  const lift = ((boardW * sinZ + boardH * cosZ) / 2) * Math.sin(xRad)
  const P = ISO_PERSPECTIVE_PX
  const availW = viewportPixelWidth.value - 16
  const availH = viewportPixelHeight.value - 16

  // Largeur : le grossissement de perspective ne compte que si les points les
  // plus larges du plateau sont proches de la caméra. À 45° ce sont les coins
  // à mi-hauteur (élévation nulle) ; à 0°/90° c'est le bord bas tout entier.
  // Pondération continue entre les deux : |cos(2Z)|.
  const widthLiftShare = Math.abs(Math.cos(2 * zRad))
  const scaleW = (availW * P) / (projW * P + availW * lift * widthLiftShare)

  // Hauteur projetée avec perspective : le demi-plateau proche est grossi
  // (m⁺ = P / (P - lift·s)), le lointain rétréci (m⁻ = P / (P + lift·s)).
  // L'échelle verticale est résolue par point fixe (3 itérations suffisent).
  const halfH = projH / 2
  let scaleH = availH / projH
  for (let i = 0; i < 3; i++) {
    const l = Math.min(lift * scaleH, P * 0.8)
    scaleH = availH / (halfH * (P / (P - l) + P / (P + l)))
  }
  const scale = Math.min(scaleW, scaleH) * 0.97

  // Recentrage vertical : la perspective grossit le demi-plateau proche,
  // ce qui pousse le centre visuel vers le bas — on remonte d'autant.
  // Facteur 0.7 empirique : la perspective-origin haute (25 %) atténue déjà
  // une partie de l'asymétrie.
  const l = lift * scale
  const shiftY = (0.7 * (halfH * scale * (P / (P - l) - P / (P + l)))) / 2

  return {
    '--iso-x': `${gameSettings.mapIsoAngles.x}deg`,
    '--iso-z': `${gameSettings.mapIsoAngles.z}deg`,
    '--iso-unsquash': String(Math.round(unsquash * 100) / 100),
    '--iso-scale': String(Math.round(scale * 1000) / 1000),
    '--iso-shift': `${-Math.round(shiftY)}px`,
  }
})

// Translation du plateau pendant le drag : la fraction de tuile pas encore appliquée
// à l'offset devient un glissement pixel, borné à la marge tampon réellement rendue
// de chaque côté (nulle aux bords de la carte). Au relâchement, snap adouci.
const panLayerStyle = computed(() => {
  const step = tileSizeAdaptive.value + GRID_GAP_PX
  const { startX, startY, endX, endY } = viewportDimensions.value
  const render = renderDimensions.value
  const maxTowardRight = (startX - render.startX) * step
  const maxTowardLeft = (render.endX - endX) * step
  const maxTowardBottom = (startY - render.startY) * step
  const maxTowardTop = (render.endY - endY) * step
  const tx = Math.max(-maxTowardLeft, Math.min(maxTowardRight, -panFraction.value.x * step))
  const ty = Math.max(-maxTowardTop, Math.min(maxTowardBottom, -panFraction.value.y * step))
  return {
    transform: `translate(${tx}px, ${ty}px)`,
    transition: isPanning.value ? 'none' : 'transform 0.15s ease-out',
  }
})

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
/** Marge intérieure d'une bulle de cadran par rapport aux bords du cadran */
const CHUNK_BUBBLE_INSET_PX = 3

/**
 * Cadrans verrouillés dont l'étendue intersecte le viewport, positionnés en pixels
 * sur leur étendue COMPLÈTE — y compris la partie hors écran. La bulle et son
 * libellé (centré sur le vrai centre du cadran) existent donc avant d'entrer dans
 * la vue et glissent avec la carte pendant le pan, au lieu d'apparaître d'un coup ;
 * le wrapper (overflow hidden) rogne ce qui dépasse du plateau.
 */
const visibleLockedChunks = computed(() => {
  if (gameSettings.disableFogOfWar) return []

  const { startX, startY, endX, endY } = viewportDimensions.value
  const totalChunks = MAP_CONFIG.size / MAP_CONFIG.chunkSize
  const step = tileSizeAdaptive.value + GRID_GAP_PX
  const chunkSpanPx = MAP_CONFIG.chunkSize * step - GRID_GAP_PX

  const result: {
    id: string
    style: Record<string, string>
    diamondTop: boolean
    diamondRight: boolean
    diamondBottom: boolean
    diamondLeft: boolean
  }[] = []

  for (let cy = 0; cy < totalChunks; cy++) {
    for (let cx = 0; cx < totalChunks; cx++) {
      const chunkId = `${cx}-${cy}`
      if (mapStore.isChunkUnlocked(chunkId)) continue

      const chunkStartX = cx * MAP_CONFIG.chunkSize
      const chunkStartY = cy * MAP_CONFIG.chunkSize

      // Ignorer si le cadran n'est pas dans le viewport
      if (
        chunkStartX + MAP_CONFIG.chunkSize <= startX ||
        chunkStartX >= endX ||
        chunkStartY + MAP_CONFIG.chunkSize <= startY ||
        chunkStartY >= endY
      )
        continue

      // Un seul losange par bord partagé : les côtés haut/gauche dessinent toujours
      // le connecteur vers leur voisin ; droite/bas seulement vers un cadran révélé
      // (sinon le cadran verrouillé voisin le dessine déjà de son côté).
      const diamondTop = cy > 0
      const diamondLeft = cx > 0
      const diamondRight = cx < totalChunks - 1 && mapStore.isChunkUnlocked(`${cx + 1}-${cy}`)
      const diamondBottom = cy < totalChunks - 1 && mapStore.isChunkUnlocked(`${cx}-${cy + 1}`)

      result.push({
        id: chunkId,
        style: {
          left: `${GRID_PADDING_PX + (chunkStartX - startX) * step + CHUNK_BUBBLE_INSET_PX}px`,
          top: `${GRID_PADDING_PX + (chunkStartY - startY) * step + CHUNK_BUBBLE_INSET_PX}px`,
          width: `${chunkSpanPx - 2 * CHUNK_BUBBLE_INSET_PX}px`,
          height: `${chunkSpanPx - 2 * CHUNK_BUBBLE_INSET_PX}px`,
        },
        diamondTop,
        diamondRight,
        diamondBottom,
        diamondLeft,
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
  background: var(--color-bg-surface);
  border-radius: 0 0 12px 12px;
  padding-bottom: 2rem;
}

/* Wrapper pour superposer la grille principale et l'overlay cadrans.
   Taille = plateau visible (width/height injectés via :style) ; la grille rendue
   est plus grande (marge tampon) et l'overflow hidden la rogne au bord du plateau :
   les cases glissent sous le bord au lieu de disparaître d'un coup. */
.map-grid-wrapper {
  position: relative;
  flex-shrink: 0;
  overflow: hidden;
  /* Légère bascule 3D du plateau, façon carte de campagne isométrique.
     Les overlays (cadrans, trajets, marqueurs) étant enfants du wrapper,
     ils suivent la même transformation — les maths pixel restent valides. */
  transform: perspective(1200px) rotateX(16deg);
  /* Plateau flottant : ombre portée sous la carte, sur la base claire.
     Le radius arrondit l'ombre et le rognage de la grille tampon. */
  border-radius: 24px;
  box-shadow:
    0 45px 45px -20px rgba(var(--overlay-rgb), 0.35),
    0 18px 20px -14px rgba(var(--overlay-rgb), 0.22);
}

/* ── Vue isométrique expérimentale (architecture du pen « Stack Sprite ») ──
   Comme dans le pen : la perspective est portée par le conteneur, le plateau
   est incliné rotateX + rotateZ (variables réglées par les curseurs). Le
   wrapper garde son overflow hidden (rognage de la grille tampon), ce qui
   aplatit ses enfants sur le plan du plateau — pas de translateZ possible ici.
   Le relief est donc simulé (« fake 3D ») : les icônes sont contre-pivotées
   de -rotateZ puis redressées de 1/cos(X) pour sembler debout sur le plateau. */
.map-viewport--iso {
  perspective: 1600px;
  perspective-origin: 50% 25%;
}

.map-viewport--iso .map-grid-wrapper {
  /* Échelle calculée côté script (--iso-scale) : le plateau pivoté est agrandi
     jusqu'à occuper l'espace disponible du viewport au lieu de laisser du vide
     autour du losange. */
  transform: translateY(var(--iso-shift, 0px)) rotateX(var(--iso-x, 55deg))
    rotateZ(var(--iso-z, 45deg)) scale(var(--iso-scale, 0.72));
}

/* Icônes et badges « debout » sur le plan incliné */
.map-viewport--iso .tile-icon,
.map-viewport--iso .current-marker,
.map-viewport--iso .garrison-regen-badge,
.map-viewport--iso .march-marker-badge,
.map-viewport--iso .chunk-bubble-inner {
  transform: rotateZ(calc(-1 * var(--iso-z, 45deg))) scaleY(var(--iso-unsquash, 1.74));
}

/* Curseurs d'angle du mode iso (équivalents des sliders du pen) */
.iso-slider {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  user-select: none;
}

.iso-slider input[type='range'] {
  width: 90px;
  accent-color: rgb(var(--color-accent-rgb));
}

/* Couche translatée pendant le drag (fraction de tuile) : grille + tous les overlays
   glissent ensemble, les maths pixel restent alignées. */
.map-pan-layer {
  position: absolute;
  inset: 0;
  will-change: transform;
}

.map-grid-large {
  /* left/top injectés via :style : décalage négatif de la marge tampon */
  position: absolute;
  padding: 20px;
}

.map-tile {
  position: relative;
  border: 1px solid transparent;
  border-radius: 18%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s ease;
  /* Brouillard sur cadran révélé : liseré sombre discret, lisible sur base claire */
  background: rgba(var(--overlay-rgb), 0.08);
}

.map-tile:hover {
  border-color: rgba(var(--color-accent-rgb), 0.55);
  transform: scale(1.05);
  z-index: 10;
}

/* Léger biseau 3D : lumière en haut, ombre en bas — façon tuile de plateau.
   En dégradé plutôt qu'en box-shadow inset : le pan remonte toute la grille
   (:key), et ~150 ombres floutées re-rasterisées par pas faisaient chuter
   le framerate de 60 à ~25 FPS. Un dégradé se peint quasi gratuitement. */
.tile-explored::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(
    180deg,
    rgba(var(--color-white-rgb), 0.28),
    rgba(var(--color-white-rgb), 0) 32%,
    rgba(var(--color-black-rgb), 0) 60%,
    rgba(var(--color-black-rgb), 0.32)
  );
  pointer-events: none;
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
  border-color: transparent;
}

.tile-being-explored {
  background: rgba(var(--overlay-rgb), 0.7) !important;
}

/* Terrains (visibles uniquement si exploré) — un seul jeu de teintes,
   partagé avec TileDetails.vue via les tokens --terrain-* de tokens.css. */
.tile-explored.terrain-plains {
  background: linear-gradient(
    145deg,
    rgba(var(--terrain-plains-rgb), 0.92),
    rgba(var(--terrain-plains-rgb), 0.68)
  );
}
.tile-explored.terrain-forest {
  background: linear-gradient(
    145deg,
    rgba(var(--terrain-forest-rgb), 0.92),
    rgba(var(--terrain-forest-rgb), 0.68)
  );
}
.tile-explored.terrain-mountain {
  background: linear-gradient(
    145deg,
    rgba(var(--terrain-mountain-rgb), 0.92),
    rgba(var(--terrain-mountain-rgb), 0.68)
  );
}
.tile-explored.terrain-water {
  background: linear-gradient(
    145deg,
    rgba(var(--terrain-water-rgb), 0.92),
    rgba(var(--terrain-water-rgb), 0.68)
  );
}
.tile-explored.terrain-village_player {
  background: linear-gradient(
    145deg,
    rgba(var(--terrain-village-player-rgb), 0.92),
    rgba(var(--terrain-village-player-rgb), 0.68)
  );
}
.tile-explored.terrain-village_enemy {
  background: linear-gradient(
    145deg,
    rgba(var(--terrain-village-enemy-rgb), 0.92),
    rgba(var(--terrain-village-enemy-rgb), 0.68)
  );
}
.tile-explored.terrain-ruins {
  background: linear-gradient(
    145deg,
    rgba(var(--terrain-ruins-rgb), 0.92),
    rgba(var(--terrain-ruins-rgb), 0.68)
  );
}
.tile-explored.terrain-stronghold {
  background: linear-gradient(
    145deg,
    rgba(var(--terrain-stronghold-rgb), 0.92),
    rgba(var(--terrain-stronghold-rgb), 0.68)
  );
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

/* Overlay cadrans : superposé au plateau, positionnement pixel des bulles.
   Les bulles couvrent l'étendue complète de leur cadran, y compris hors écran ;
   c'est l'overflow hidden du wrapper qui les rogne au bord du plateau (un clip
   local bougerait avec la translation de pan et rognerait au mauvais endroit). */
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
  border-radius: inherit;
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

/* Bulle d'un cadran verrouillé — panneau navy façon plateau de jeu */
.chunk-locked-bubble {
  pointer-events: auto;
  position: absolute; /* left/top/width/height injectés via :style (étendue du cadran) */
  background: linear-gradient(160deg, var(--map-night-raised), var(--map-night) 70%);
  border: 2px solid rgba(var(--map-line-rgb), 0.7);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 8px 22px rgba(var(--color-black-rgb), 0.45);
  transition:
    background 0.2s ease,
    border-color 0.2s ease,
    box-shadow 0.2s ease;
  /* overflow visible : les losanges connecteurs chevauchent la bordure */
}

/* Motif croisillon diagonal subtil (grille en losanges) */
.chunk-locked-bubble::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    repeating-linear-gradient(
      45deg,
      transparent,
      transparent 11px,
      rgba(var(--map-crosshatch-rgb), 0.055) 11px,
      rgba(var(--map-crosshatch-rgb), 0.055) 12px
    ),
    repeating-linear-gradient(
      -45deg,
      transparent,
      transparent 11px,
      rgba(var(--map-crosshatch-rgb), 0.055) 11px,
      rgba(var(--map-crosshatch-rgb), 0.055) 12px
    );
  border-radius: inherit;
  pointer-events: none;
}

.chunk-locked-bubble:hover {
  background: linear-gradient(160deg, var(--map-night-hover-raised), var(--map-night-hover) 70%);
  border-color: rgba(var(--color-white-rgb), 0.9);
  box-shadow:
    0 8px 22px rgba(var(--color-black-rgb), 0.45),
    0 0 18px rgba(var(--map-gold-rgb), 0.3),
    inset 0 0 12px rgba(var(--map-gold-rgb), 0.08);
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

/* Cadenas doré lumineux — un seul drop-shadow : chaque drop-shadow supplémentaire
   re-rasterise le glyphe à chaque remontage de la grille (pan) */
.chunk-bubble-lock {
  font-size: clamp(16px, 3vw, 30px);
  line-height: 1;
  filter: drop-shadow(0 0 6px rgba(var(--map-gold-rgb), 0.6));
}

.chunk-bubble-label {
  font-size: clamp(9px, 1.2vw, 13px);
  font-weight: 700;
  color: var(--map-zone-title);
  text-shadow: 0 1px 2px rgba(var(--color-black-rgb), 0.6);
  letter-spacing: 0.04em;
}

.chunk-bubble-hint {
  font-size: clamp(8px, 1vw, 11px);
  color: var(--map-zone-hint);
  font-style: italic;
}

.chunk-locked-bubble:hover .chunk-bubble-hint {
  color: var(--map-zone-hint-bright);
}

/* Connecteur en losange — petit carré blanc pivoté, à cheval sur la bordure */
.chunk-diamond {
  position: absolute;
  width: 9px;
  height: 9px;
  background: var(--map-line);
  border-radius: 2px;
  box-shadow: 0 1px 4px rgba(var(--color-black-rgb), 0.55);
  z-index: 2;
  pointer-events: none;
}

.chunk-diamond--top {
  top: -6px;
  left: 50%;
  transform: translateX(-50%) rotate(45deg);
}

.chunk-diamond--bottom {
  bottom: -6px;
  left: 50%;
  transform: translateX(-50%) rotate(45deg);
}

.chunk-diamond--left {
  left: -6px;
  top: 50%;
  transform: translateY(-50%) rotate(45deg);
}

.chunk-diamond--right {
  right: -6px;
  top: 50%;
  transform: translateY(-50%) rotate(45deg);
}

.tile-chunk-locked {
  background: transparent !important;
  cursor: default;
  pointer-events: none;
  overflow: hidden;
}

/* Filet de sécurité cross-browser : masque tout contenu enfant des tuiles verrouillées */
.tile-chunk-locked > * {
  visibility: hidden;
}

/* Une tuile verrouillée ne doit pas non plus laisser transparaître sa zone d'influence
   (le ::after n'est pas un enfant, il échappe au filet ci-dessus) */
.map-tile.tile-chunk-locked::after {
  content: none;
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
  background: rgba(var(--map-night-deep-rgb), 0.85);
  color: var(--map-line);
  border: 1px solid rgba(var(--map-line-rgb), 0.25);
  padding: 6px 12px;
  border-radius: 8px;
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
