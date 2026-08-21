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
      <!-- Réglage fin du zoom : nombre de tuiles visibles, entre les bornes des
           presets (gauche = proche, droite = loin, même sens que le segmenté) -->
      <label
        class="zoom-slider"
        :title="`Réglage fin du zoom — ${viewportSize}×${viewportSize} tuiles visibles`"
      >
        🔍
        <input
          type="range"
          :min="MAP_CONFIG.minViewportSize"
          :max="MAP_CONFIG.maxViewportSize"
          :value="viewportSize"
          @input="setZoomPreset(Number(($event.target as HTMLInputElement).value))"
        />
        <span class="zoom-slider-value">{{ viewportSize }}</span>
      </label>
      <div class="controls-divider" />
      <Button variant="secondary" size="sm" @click="centerOnPlayer">🎯 Centrer</Button>
      <Button
        v-if="selectedTileForCenter"
        variant="secondary"
        size="sm"
        :title="`Centrer sur la case sélectionnée (${selectedTileForCenter.position.x}, ${selectedTileForCenter.position.y})`"
        @click="centerOnTile(selectedTileForCenter.position.x, selectedTileForCenter.position.y)"
      >
        🎯 Sélection
      </Button>
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
      :class="{
        'map-viewport--iso': gameSettings.mapIsoView,
        'map-viewport--panning': isPanning,
      }"
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
          <!-- :key sur le zoom SEUL : inclure l'offset forçait un démontage/remontage
               complet des ~440 tuiles à chaque pas de pan (listeners v-clickable,
               animations CSS redémarrées, layout+paint entiers). Sans lui, Vue diffe
               le v-for keyé par tile.id : un pas = quelques insertions/retraits. -->
          <div class="map-grid-large" :key="`grid-${viewportSize}`" :style="gridStyle">
            <!-- Rendu des tuiles visibles + une marge tampon hors écran.
                 v-memo : sans lui, getTileClasses/tileTitle (+ les v-if des badges) sont
                 ré-exécutés pour CHAQUE tuile rendue à chaque re-render du composant —
                 or celui-ci se déclenche 1×/s (tickerNow, tooltips de mouvement) et à
                 chaque mousemove pendant un pan, sans rapport avec l'état des tuiles.
                 Profilé en lag notable sur un plateau bien dézoomé (trace DevTools :
                 setAttribute/setStyle/getTileClasses dominent le thread principal). -->
            <div
              v-for="tile in renderedTiles"
              :key="tile.id"
              v-memo="[
                tile.type,
                tile.explored,
                tile.current,
                tile.hasTreasure,
                lootStockTotal(tile),
                isChunkLocked(tile),
                props.selectedTileId === tile.id,
                influenceZoneMap.get(tile.id),
                isGarrisonRegenerating(tile),
                gameSettings.disableFogOfWar,
                tileIconFontSize,
              ]"
              class="map-tile"
              :class="getTileClasses(tile)"
              :title="tileTitle(tile)"
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
              <!-- Indicateur : trésor de ruines encore fouillable -->
              <div
                class="treasure-badge"
                v-if="
                  tile.type === 'ruins' &&
                  tile.hasTreasure &&
                  (gameSettings.disableFogOfWar || (tile.explored && !isChunkLocked(tile)))
                "
              >
                💎
              </div>
              <!-- Indicateur : village/forteresse ennemi encore pillable -->
              <div
                class="loot-badge"
                v-if="
                  lootStockTotal(tile) > 0 &&
                  (gameSettings.disableFogOfWar || (tile.explored && !isChunkLocked(tile)))
                "
              >
                💰
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
            :key="`overlay-${viewportSize}`"
          >
            <div
              v-for="chunk in visibleLockedChunks"
              :key="chunk.id"
              class="chunk-locked-bubble"
              :class="{
                'chunk-locked-bubble--nofragment': mapFragments === 0,
                'chunk-locked-bubble--holding': holdingChunkId === chunk.id,
              }"
              :style="chunk.style"
              v-clickable
              @pointerdown.stop="startHold(chunk.id)"
              @pointerup.stop="cancelHold"
              @pointerleave.stop="cancelHold"
              @pointercancel.stop="cancelHold"
              @contextmenu.prevent
              @click.stop="onBubbleClick(chunk.id, $event)"
            >
              <!-- Pendant l'appui maintenu : anneau de progression (5s) à la place
                   du contenu habituel de la bulle -->
              <TimerClock
                v-if="holdingChunkId === chunk.id"
                :size="52"
                :progress="holdProgress"
                :remaining-ms="holdRemainingMs"
                icon="🗺️"
                progress-color="var(--color-accent)"
              />
              <div v-else class="chunk-bubble-inner">
                <span class="chunk-bubble-lock">🔒</span>
                <span class="chunk-bubble-label">Zone {{ chunk.id }}</span>
                <!-- Coût et stock affichés AVANT l'appui — le joueur ne découvre
                     plus le manque de fragments via un toast d'erreur après coup -->
                <span class="chunk-bubble-hint">
                  {{
                    mapFragments > 0
                      ? `Maintenir 3s pour révéler — 1 🗺️ (vous en avez ${mapFragments})`
                      : 'Aucun fragment de carte 🗺️'
                  }}
                </span>
              </div>
              <!-- Connecteurs en losange au milieu de chaque bord visible -->
              <span v-if="chunk.diamondTop" class="chunk-diamond chunk-diamond--top" />
              <span v-if="chunk.diamondRight" class="chunk-diamond chunk-diamond--right" />
              <span v-if="chunk.diamondBottom" class="chunk-diamond chunk-diamond--bottom" />
              <span v-if="chunk.diamondLeft" class="chunk-diamond chunk-diamond--left" />
            </div>
          </div>

          <!-- Overlay des mouvements — marqueurs STATIQUES : les anciens arcs SVG +
               badges interpolés (repositionnés 5×/s avec transition left/top) coûtaient
               trop cher en layout/paint. Un symbole posé sur la case d'intérêt suffit,
               les comptes à rebours détaillés restent dans MovementsPanel. -->
          <div class="map-movement-overlay">
            <!-- Troupes du joueur : ⚔️ sur la destination à l'aller, ↩️ sur la case
                 quittée au retour — cliquable : ouvre la fiche de cette case -->
            <div
              v-for="marker in movementMarkers"
              :key="marker.id"
              class="march-marker march-marker--clickable"
              :class="{ 'march-marker--returning': marker.isReturning }"
              :style="markerStyle(marker)"
              :title="marker.title"
              @click="selectTile(marker.focusTileId)"
            >
              <span class="march-marker-badge">{{ marker.isReturning ? '↩️' : '⚔️' }}</span>
            </div>

            <!-- Menace ennemie en approche : simple flèche orientée forteresse → village,
                 posée juste devant le village — cliquable : ouvre la forteresse -->
            <div
              v-for="threat in enemyThreats"
              :key="`threat-${threat.id}`"
              class="march-marker march-marker--enemy march-marker--clickable"
              :style="markerStyle(threat)"
              :title="threat.title"
              @click="selectTile(threat.id)"
            >
              <span class="threat-arrow" :style="{ transform: `rotate(${threat.angleDeg}deg)` }"
                >➤</span
              >
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
import { useMapStore, type MapTile, MAP_CONFIG, type HostilityState } from '../../stores/mapStore'
import { useMapViewport, ZOOM_PRESETS } from '../../composables/useMapViewport'
import { useExplorationTicker } from '../../composables/useExplorationTicker'
import { useGameStore } from '../../stores/gameStore'
import { gameSettings } from '../../stores/gameSettingsStore'
import { GARRISON_REGEN_DURATION_MS } from '../../config'
import { formatDuration } from '../../utils/formatDuration'
import SectionLabel from '@/components/ui/SectionLabel.vue'
import SegmentedControl from '@/components/ui/SegmentedControl.vue'
import Button from '@/components/ui/Button.vue'
import TimerClock from '@/components/ui/TimerClock.vue'

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
const gameStore = useGameStore()

// Horloge 1 Hz du ticker de campagne (lecture seule — start/stop restent dans
// CampaignLayout) : sert uniquement aux comptes à rebours des tooltips de mouvement.
// Remplace l'ancienne horloge locale 200 ms qui re-rendait tout le composant 5×/s.
const { now: tickerNow } = useExplorationTicker()

// Composables
const {
  viewportOffset,
  viewportSize,
  viewportCenter,
  isPanning,
  panFraction,
  setZoomPreset,
  centerOnPlayer,
  centerOnTile,
  startPan,
  handlePan,
  endPan,
  // Le pas réel (tuile adaptative + gap) sert à convertir les pixels du drag en tuiles :
  // avec MAP_CONFIG.tileSize (40px fixe), le plateau ne suivait pas exactement le curseur.
} = useMapViewport({ tileStepPx: () => tileSizeAdaptive.value + GRID_GAP_PX })

/** Stock de fragments de carte du joueur — affiché dans les bulles de cadran verrouillé */
const mapFragments = computed(() => gameStore.gameState.inventory.mapFragments)

/** Tuile actuellement sélectionnée (si fournie par le parent) — pour le bouton de recentrage */
const selectedTileForCenter = computed(() =>
  props.selectedTileId ? (mapStore.getTileById(props.selectedTileId) ?? null) : null,
)

const isLoading = ref(false)

// Taille réelle du viewport (suit .map-viewport, y compris son breakpoint mobile height: 400px)
const mapViewportRef = ref<HTMLElement | null>(null)
const viewportPixelHeight = ref(600)
const viewportPixelWidth = ref(600)
let viewportResizeObserver: ResizeObserver | null = null

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

onUnmounted(() => {
  viewportResizeObserver?.disconnect()
  cancelHold()
})

// ── Révélation d'un cadran par appui maintenu (5s) ──────────────────────────
// Remplace l'ancien clic instantané : le joueur doit rester appuyé sur la
// bulle du cadran verrouillé pendant HOLD_DURATION_MS pour le révéler.
const HOLD_DURATION_MS = 3000

/** Cadran actuellement maintenu (null si aucun) — pilote l'affichage du TimerClock */
const holdingChunkId = ref<string | null>(null)
/** Progression du hold, 0 → 1 */
const holdProgress = ref(0)
const holdRemainingMs = computed(() =>
  Math.max(0, Math.round(HOLD_DURATION_MS * (1 - holdProgress.value))),
)

let holdRafId: number | null = null
let holdStartedAt = 0

const tickHold = () => {
  if (holdingChunkId.value === null) return
  const elapsed = Date.now() - holdStartedAt
  holdProgress.value = Math.min(1, elapsed / HOLD_DURATION_MS)
  if (elapsed >= HOLD_DURATION_MS) {
    const chunkId = holdingChunkId.value
    cancelHold()
    emit('unlock-chunk', chunkId)
    return
  }
  holdRafId = requestAnimationFrame(tickHold)
}

const startHold = (chunkId: string) => {
  // Pas de fragment : échec certain, on garde le retour immédiat existant
  // (toast d'avertissement du parent) plutôt que de faire attendre 5s pour rien.
  if (mapFragments.value <= 0) {
    emit('unlock-chunk', chunkId)
    return
  }
  holdingChunkId.value = chunkId
  holdStartedAt = Date.now()
  holdProgress.value = 0
  holdRafId = requestAnimationFrame(tickHold)
}

const cancelHold = () => {
  if (holdRafId !== null) {
    cancelAnimationFrame(holdRafId)
    holdRafId = null
  }
  holdingChunkId.value = null
  holdProgress.value = 0
}

/** Un clic natif souris (detail >= 1) ne révèle plus rien — seul l'appui maintenu
    le fait. Un clic synthétique clavier (v-clickable, Entrée/Espace, detail === 0)
    garde l'ancien comportement instantané : reproduire un hold via le clavier
    serait un aller-retour d'accessibilité disproportionné pour ce jeu. */
const onBubbleClick = (chunkId: string, event: MouseEvent) => {
  if (event.detail !== 0) return
  emit('unlock-chunk', chunkId)
}

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
  const heightPx = rows * step - GRID_GAP_PX + 2 * GRID_PADDING_PX
  return {
    width: `${cols * step - GRID_GAP_PX + 2 * GRID_PADDING_PX}px`,
    height: `${heightPx}px`,
    // Perspective de la bascule 3D proportionnelle au plateau (ratio 2.14 =
    // 1200px pour l'ancien plateau de ~560px) : avec une perspective fixe, un
    // grand plateau (viewport plein écran) était beaucoup plus déformé — les
    // tuiles du bas nettement plus grosses que celles du haut.
    '--map-tilt-perspective': `${Math.round(heightPx * 2.14)}px`,
  }
})

// ── Vue isométrique ────────────────────────────────────────────────────────
// Architecture reprise du pen « Pure CSS Isometric Fake 3D — Stack Sprite »
// (codepen.io/FlokiTV/pen/WNRedMd) : perspective portée par le conteneur,
// plateau incliné rotateX/rotateZ réglables par curseurs (les sliders du pen),
// icônes contre-pivotées et redressées pour rester lisibles — sprites debout.
// Le choix du joueur (mode + angles) est persisté via gameSettings.

// Ratio perspective/plateau du réglage historique (1600px pour ~560px de plateau).
// La perspective est désormais proportionnelle au plateau et injectée en CSS via
// --iso-perspective : une valeur fixe déformait beaucoup plus les grands plateaux.
const ISO_PERSPECTIVE_RATIO = 2.86

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
  const P = Math.round(Math.max(boardW, boardH) * ISO_PERSPECTIVE_RATIO)
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
    '--iso-perspective': `${P}px`,
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

interface MovementMarker {
  id: string
  x: number
  y: number
  isReturning: boolean
  /** Case d'intérêt du mouvement : cible en aller, case quittée en retour (clic sur le badge) */
  focusTileId: string
  /** Tooltip : destination + temps restant */
  title: string
}

/** Marqueur statique par mouvement actif, posé sur la case d'intérêt (cible en aller,
    case quittée en retour). Seul le tooltip dépend de l'horloge 1 Hz du ticker partagé :
    la position ne bouge plus, aucun re-layout continu. */
const movementMarkers = computed<MovementMarker[]>(() => {
  const result: MovementMarker[] = []
  for (const movement of mapStore.mapState.activeMovements) {
    const source = mapStore.getTileById(movement.sourceTileId)
    const target = mapStore.getTileById(movement.targetTileId)
    if (!source || !target) continue

    const remaining = formatDuration(Math.max(0, movement.arrivalTime - tickerNow.value))
    const isReturning = !!movement.isReturning
    const anchor = isReturning ? source : target
    result.push({
      id: movement.id,
      x: anchor.position.x,
      y: anchor.position.y,
      isReturning,
      focusTileId: anchor.id,
      title: isReturning
        ? `Retour vers le village — arrivée dans ${remaining}`
        : `Troupes en marche vers ${mapStore.getTileName(target.type)} (${target.position.x}, ${target.position.y}) — arrivée dans ${remaining}`,
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

interface EnemyThreat {
  id: string
  x: number
  y: number
  /** Orientation de la flèche : direction forteresse → village, en degrés CSS */
  angleDeg: number
  /** Tooltip : forteresse d'origine + compte à rebours + affordance de clic */
  title: string
}

/**
 * Attaques ennemies imminentes : une forteresse hostile avec un `nextAttackAt` planifié.
 * Représentation volontairement statique (perf) : une flèche posée juste devant le village
 * du joueur, orientée dans la direction d'où vient le raid. Seul le compte à rebours du
 * tooltip suit l'horloge 1 Hz du ticker partagé.
 */
const enemyThreats = computed<EnemyThreat[]>(() => {
  const home = mapStore.mapState.currentPosition
  const result: EnemyThreat[] = []
  for (const zone of Object.values(mapStore.mapState.fortressZones)) {
    if (zone.hostilityState !== 'hostile' || !zone.nextAttackAt) continue
    const fortress = mapStore.getTileById(zone.fortressTileId)
    if (!fortress) continue

    const dx = home.x - fortress.position.x
    const dy = home.y - fortress.position.y
    const dist = Math.hypot(dx, dy) || 1

    const msRemaining = Math.max(0, zone.nextAttackAt - tickerNow.value)
    result.push({
      id: zone.fortressTileId,
      // Une case en retrait du village, côté forteresse : ne masque pas l'icône du
      // village et deux raids simultanés venant d'axes différents ne se superposent pas
      x: home.x - (dx / dist),
      y: home.y - (dy / dist),
      angleDeg: Math.round((Math.atan2(dy, dx) * 180) / Math.PI),
      title: `Raid ennemi depuis la forteresse (${fortress.position.x}, ${fortress.position.y}) — impact dans ${Math.ceil(msRemaining / 1000)}s — cliquer pour voir la forteresse`,
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

/** Libellés français des états d'hostilité — pour les tooltips de tuile */
const HOSTILITY_TITLE_LABELS: Record<HostilityState, string> = {
  neutral: 'zone d’influence neutre',
  warned: 'zone d’influence avertie',
  hostile: 'zone d’influence HOSTILE',
}

/** Tooltip d'une tuile : nom du terrain + coordonnées + état d'influence connu.
    Rien sur les cadrans verrouillés (le brouillard ne doit pas fuiter d'info). */
const tileTitle = (tile: MapTile): string => {
  if (isChunkLocked(tile) && !gameSettings.disableFogOfWar) return ''
  if (!tile.explored && !gameSettings.disableFogOfWar)
    return `(${tile.position.x}, ${tile.position.y}) — inexploré`
  let title = `${mapStore.getTileName(tile.type)} (${tile.position.x}, ${tile.position.y})`
  if (tile.hasTreasure) title += ' — 💎 trésor à fouiller'
  const influence = influenceZoneMap.value.get(tile.id)
  if (influence) title += ` — ${HOSTILITY_TITLE_LABELS[influence]}`
  return title
}

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

/**
 * Somme du stock pillable d'un village ennemi/forteresse — valeur primitive plutôt
 * que l'objet lootStock lui-même : ce dernier est muté en place (tickLootRegen), donc
 * sa référence ne change jamais et casserait la comparaison shallow-equal du v-memo.
 */
const lootStockTotal = (tile: MapTile): number => {
  const stock = tile.lootStock
  if (!stock || (tile.type !== 'village_enemy' && tile.type !== 'stronghold')) return 0
  return stock.gold + stock.wood + stock.iron + stock.crop
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
  /* Occupe toute la hauteur restante de l'écran (~340px de chrome au-dessus :
     header campagne, paddings, barre de contrôles) au lieu d'un 600px fixe —
     le ResizeObserver adapte la taille des tuiles automatiquement.
     Plancher à 600px pour ne pas rétrécir sur les écrans bas. */
  height: max(600px, calc(100vh - 340px));
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
  /* Perspective injectée via wrapperStyle : proportionnelle à la taille du
     plateau pour garder une déformation constante à toutes les tailles d'écran. */
  transform: perspective(var(--map-tilt-perspective, 1200px)) rotateX(16deg);
  /* Plateau flottant : ombre portée sous la carte, sur la base claire.
     Le radius arrondit l'ombre et le rognage de la grille tampon. */
  border-radius: 24px;
  box-shadow:
    0 45px 45px -20px rgba(var(--overlay-rgb), 0.35),
    0 18px 20px -14px rgba(var(--overlay-rgb), 0.22);
  /* Confine layout et paint au plateau : un repaint de tuile ne force plus la
     re-rasterisation de la page à travers la transform 3D ci-dessus. */
  contain: layout paint;
}

/* ── Vue isométrique expérimentale (architecture du pen « Stack Sprite ») ──
   Comme dans le pen : la perspective est portée par le conteneur, le plateau
   est incliné rotateX + rotateZ (variables réglées par les curseurs). Le
   wrapper garde son overflow hidden (rognage de la grille tampon), ce qui
   aplatit ses enfants sur le plan du plateau — pas de translateZ possible ici.
   Le relief est donc simulé (« fake 3D ») : les icônes sont contre-pivotées
   de -rotateZ puis redressées de 1/cos(X) pour sembler debout sur le plateau. */
.map-viewport--iso {
  /* Valeur injectée via isoStyleVars (proportionnelle au plateau) — le script
     utilise la même valeur P dans ses calculs d'échelle, rester synchronisés. */
  perspective: var(--iso-perspective, 1600px);
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
.map-viewport--iso .treasure-badge,
.map-viewport--iso .loot-badge,
.map-viewport--iso .march-marker-badge,
.map-viewport--iso .chunk-bubble-inner {
  transform: rotateZ(calc(-1 * var(--iso-z, 45deg))) scaleY(var(--iso-unsquash, 1.74));
}

/* Curseurs de la barre de contrôles : angles du mode iso + réglage fin du zoom */
.iso-slider,
.zoom-slider {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  user-select: none;
}

.iso-slider input[type='range'],
.zoom-slider input[type='range'] {
  width: 90px;
  accent-color: rgb(var(--color-accent-rgb));
}

/* Valeur courante du zoom (nombre de tuiles) — chasse fixe pour éviter que la
   barre de contrôles ne bouge quand la valeur passe de 9 à 10+ */
.zoom-slider-value {
  min-width: 2ch;
  text-align: center;
  font-variant-numeric: tabular-nums;
  color: var(--color-text-muted);
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
  /* Propriétés ciblées (pas `all`) : pendant un pan, les tuiles défilent sous le
     curseur et `all` lançait des transitions background/border en rafale. */
  transition:
    border-color 0.15s ease,
    transform 0.15s ease;
  /* Brouillard sur cadran révélé : liseré sombre discret, lisible sur base claire */
  background: rgba(var(--overlay-rgb), 0.08);
}

.map-tile:hover {
  border-color: rgba(var(--color-accent-rgb), 0.55);
  transform: scale(1.05);
  z-index: 10;
}

/* Pendant le drag : plus de hover ni de transitions sur les tuiles — le pointeur
   défile sur des dizaines de cases par geste, chaque hover repeignait la grille
   à l'intérieur du contexte 3D clippé du wrapper. */
.map-viewport--panning .map-tile {
  pointer-events: none;
  transition: none;
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

/* Trésor de ruines encore fouillable — même gabarit que le badge de régénération */
.treasure-badge {
  position: absolute;
  top: 2px;
  right: 2px;
  font-size: clamp(8px, 1.2vw, 11px);
  background: rgba(0, 0, 0, 0.6);
  border-radius: 3px;
  padding: 0 2px;
  z-index: 5;
  line-height: 1;
  animation: treasure-pulse 2.4s ease-in-out infinite;
}

@keyframes treasure-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.45;
  }
}

/* Stock pillable d'un village/forteresse ennemi — ancré en bas à gauche pour ne pas
   se superposer au badge de garnison en reconstitution (haut à droite, même tuile possible) */
.loot-badge {
  position: absolute;
  bottom: 2px;
  left: 2px;
  font-size: clamp(8px, 1.2vw, 11px);
  background: rgba(0, 0, 0, 0.6);
  border-radius: 3px;
  padding: 0 2px;
  z-index: 5;
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
  z-index: 2;
}

/* Marqueur cliquable : ré-active les événements que l'overlay parent désactive
   (pointer-events: none) pour laisser passer les clics vers les tuiles ailleurs */
.march-marker--clickable {
  pointer-events: auto;
  cursor: pointer;
}

/* Badge circulaire autour de l'icône — la rend lisible sur n'importe quel fond de tuile.
   Le fond sombre reste fixe (HUD, cf. note plus haut) ; seul l'anneau reprend les tokens
   sémantiques déjà utilisés pour l'envoi d'attaque dans AttackPanel.vue.
   Réduit et ancré en haut à droite : posé en STATIQUE sur la case de destination,
   il ne doit pas masquer l'icône de la tuile en dessous. */
.march-marker-badge {
  position: absolute;
  top: -6%;
  right: -6%;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 62%;
  height: 62%;
  font-size: 0.75em;
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

/* Menace ennemie en approche — simple flèche orientée vers le village, pulsation
   d'alerte sur le conteneur (transform seul : composité, pas de repaint). La rotation
   est portée par le span interne pour ne pas entrer en conflit avec le scale. */
.march-marker--enemy {
  animation: enemy-pulse 1s ease-in-out infinite;
}

.threat-arrow {
  color: var(--color-warning);
  font-size: 1.3em;
  line-height: 1;
  /* Liseré sombre : la flèche reste lisible quel que soit le terrain dessous */
  text-shadow:
    0 0 3px rgba(0, 0, 0, 0.9),
    0 1px 2px rgba(0, 0, 0, 0.7);
}

@keyframes enemy-pulse {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.18);
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
  /* Empêche le scroll/zoom tactile de voler le geste pendant l'appui maintenu */
  touch-action: none;
}

/* Appui maintenu en cours — halo doré, cohérent avec l'anneau de progression */
.chunk-locked-bubble--holding {
  border-color: rgba(var(--color-accent-rgb), 0.9);
  box-shadow:
    0 8px 22px rgba(var(--color-black-rgb), 0.45),
    0 0 18px rgba(var(--color-accent-rgb), 0.45);
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

/* Aucun fragment en stock : la bulle reste visible mais signale l'impossibilité */
.chunk-locked-bubble--nofragment {
  cursor: not-allowed;
  filter: grayscale(0.6);
  opacity: 0.75;
}

.chunk-locked-bubble--nofragment .chunk-bubble-hint {
  color: var(--color-warning);
  font-style: normal;
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
