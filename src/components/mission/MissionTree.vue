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
          <ProgressBar class="progress-bar-el" :value="progressPercentage" />
          <span class="progress-text">{{ Math.round(progressPercentage) }}%</span>
        </div>

        <div class="player-status">
          <div class="status-item">
            <span class="status-label">Niveau:</span>
            <span class="status-value">{{ currentPlayerRow + 1 }}/{{ mapLayers.length }}</span>
          </div>
          <button
            v-if="nextAvailableNodes.length > 0"
            class="status-item status-item--link"
            title="Voir le premier nœud accessible"
            @click="scrollToNextNode"
          >
            <span class="status-label">Choix:</span>
            <span class="status-value"
              >{{ nextAvailableNodes.length }} option{{
                nextAvailableNodes.length > 1 ? 's' : ''
              }}</span
            >
          </button>
          <!-- Même destination que l'indicateur de PV en campagne (VictoryPointsDisplay) -->
          <button
            class="objective-link"
            title="Voir le détail des points de victoire"
            @click="router.push({ name: 'campaign-score' })"
          >
            <Badge :tone="totalCombatVP >= COMBAT_VP_GOAL ? 'success' : 'accent'">
              ⚔️ Objectif : {{ totalCombatVP }} / {{ COMBAT_VP_GOAL }} PV
            </Badge>
          </button>
        </div>
      </div>

      <Button variant="secondary" @click="resetMap" title="Nouvelle carte">
        🔄 Nouvelle carte
      </Button>
    </header>

    <!-- Carte verticale -->
    <main class="map-container">
      <div class="map-layers" v-if="mapGenerated" :style="{ width: `${MAP_WIDTH}px` }">
        <svg class="tree-connections" :width="MAP_WIDTH" :height="totalHeight">
          <circle
            v-for="dot in connectionDots"
            :key="dot.key"
            :cx="dot.x"
            :cy="dot.y"
            :r="DOT_RADIUS"
            class="connection-dot"
            :class="{
              'active-connection': dot.active,
              'accessible-connection': dot.accessible,
            }"
          />
        </svg>

        <MissionMapLayer
          v-for="layer in mapLayers"
          :key="layer.row"
          :layer="layer"
          :current-player-row="currentPlayerRow"
          :selected-node-id="selectedNodeId"
          :active-node-id="activeNodeId"
          :all-nodes="allNodes"
          @select-node="selectNode"
          @toggle-node="toggleNode"
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
      <button class="legend-toggle" :aria-expanded="showLegend" @click="showLegend = !showLegend">
        {{ showLegend ? 'Masquer la légende' : 'Afficher la légende' }}
      </button>

      <div v-if="showLegend" class="legends">
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

      <Button variant="secondary" @click="goHome">🏠 Retour à l'accueil</Button>
    </footer>

    <ConfirmDialog
      v-model:open="showResetMapConfirm"
      title="Générer une nouvelle carte ?"
      message="Cela effacera votre progression actuelle."
      confirm-label="Générer"
      danger
      @confirm="confirmResetMap"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore, COMBAT_VP_GOAL } from '@/stores/gameStore'
import { useToastStore } from '@/stores/toastStore'
import type { MapNode } from '@/utils'
import { nodeCenterX, nodeCenterY, MAP_WIDTH, ROW_HEIGHT } from '@/utils'
import MissionMapLayer from './MissionMapLayer.vue'
import Badge from '@/components/ui/Badge.vue'
import Button from '@/components/ui/Button.vue'
import ProgressBar from '@/components/ui/ProgressBar.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'

const router = useRouter()
const gameStore = useGameStore()
const toastStore = useToastStore()

// Utiliser l'état de la carte depuis le gameStore
const mapLayers = computed(() => gameStore.gameState.mapState.layers)
const currentPlayerRow = computed(() => gameStore.gameState.mapState.currentPlayerRow)
const selectedNodeId = computed(() => gameStore.gameState.mapState.selectedNodeId)
const mapGenerated = computed(() => gameStore.gameState.mapState.mapGenerated)

// Légende repliée par défaut pour alléger le footer ; état non persisté (info ponctuelle).
const showLegend = ref(false)

// Popover de détails d'un nœud : un seul ouvert à la fois, partagé entre toutes les rangées
// (chaque rangée est un composant distinct, donc cet état ne peut pas vivre dans l'enfant).
const activeNodeId = ref<string | null>(null)

const toggleNode = (node: MapNode) => {
  activeNodeId.value = activeNodeId.value === node.id ? null : node.id
}

const closeActiveNodeOnOutsideClick = (event: MouseEvent) => {
  const target = event.target as HTMLElement | null
  if (!target?.closest('.map-node')) {
    activeNodeId.value = null
  }
}

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

/** Scrolle en douceur jusqu'au premier nœud accessible (repéré par data-node-id) */
const scrollToNextNode = () => {
  const first = nextAvailableNodes.value[0]
  if (!first) return
  document
    .querySelector(`[data-node-id="${first.id}"]`)
    ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

// Computed
const allNodes = computed(() => {
  const nodes: MapNode[] = []
  mapLayers.value.forEach((layer) => {
    nodes.push(...layer.nodes)
  })
  return nodes
})

// Hauteur totale de la carte (toutes les rangées, boss inclus)
const totalHeight = computed(() => mapLayers.value.length * ROW_HEIGHT)

interface Point {
  x: number
  y: number
}

// Espacement et taille des points du chemin en pointillés (façon Slay the Spire : la ligne
// entre deux nœuds n'est pas un trait plein, mais une suite de petits points le long de la courbe)
const DOT_SPACING = 14
const DOT_RADIUS = 2.5
const CURVE_SEGMENTS = 60 // résolution de l'approximation de la courbe en polyligne

const cubicBezierPoint = (p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point => {
  const mt = 1 - t
  return {
    x: mt * mt * mt * p0.x + 3 * mt * mt * t * p1.x + 3 * mt * t * t * p2.x + t * t * t * p3.x,
    y: mt * mt * mt * p0.y + 3 * mt * mt * t * p1.y + 3 * mt * t * t * p2.y + t * t * t * p3.y,
  }
}

/** Ré-échantillonne une polyligne pour obtenir des points espacés d'une distance constante
 * (paramétrisation par longueur d'arc), plutôt que par pas de `t` uniforme qui donnerait des
 * points inégalement espacés sur une courbe. */
const resamplePolyline = (points: Point[], spacing: number): Point[] => {
  const result: Point[] = [points[0]]
  let carry = 0

  for (let i = 1; i < points.length; i++) {
    let a = points[i - 1]
    const b = points[i]
    let segLen = Math.hypot(b.x - a.x, b.y - a.y)

    while (carry + segLen >= spacing) {
      const t = (spacing - carry) / segLen
      const point = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
      result.push(point)
      segLen -= spacing - carry
      a = point
      carry = 0
    }
    carry += segLen
  }

  return result
}

const dotsAlongCurve = (p0: Point, p1: Point, p2: Point, p3: Point): Point[] => {
  const curvePoints: Point[] = []
  for (let i = 0; i <= CURVE_SEGMENTS; i++) {
    curvePoints.push(cubicBezierPoint(p0, p1, p2, p3, i / CURVE_SEGMENTS))
  }
  return resamplePolyline(curvePoints, DOT_SPACING)
}

/**
 * Tracé des connexions entre nœuds : un unique overlay SVG global (plutôt qu'un tracé par
 * rangée) pour que chaque point parte et arrive exactement au centre réel des deux nœuds
 * qu'elle relie, quelle que soit la rangée. Chaque connexion suit une courbe de Bézier douce
 * (contrôle horizontal aligné sur chaque extrémité, à mi-hauteur, pour un cheminement
 * légèrement sinueux plutôt qu'un trait droit rigide), mais au lieu d'un trait plein, elle est
 * matérialisée par une suite de petits points régulièrement espacés le long de cette courbe.
 */
const connectionDots = computed(() => {
  const byId = new Map(allNodes.value.map((n) => [n.id, n]))
  const dots: Array<{ key: string; x: number; y: number; active: boolean; accessible: boolean }> =
    []

  allNodes.value.forEach((node) => {
    const x1 = nodeCenterX(node)
    const y1 = nodeCenterY(node.row)

    node.connections.forEach((connectionId) => {
      const target = byId.get(connectionId)
      if (!target) return

      const x2 = nodeCenterX(target)
      const y2 = nodeCenterY(target.row)
      const midY = (y1 + y2) / 2

      const points = dotsAlongCurve(
        { x: x1, y: y1 },
        { x: x1, y: midY },
        { x: x2, y: midY },
        { x: x2, y: y2 },
      )

      points.forEach((point, index) => {
        dots.push({
          key: `${node.id}-${connectionId}-${index}`,
          x: point.x,
          y: point.y,
          active: node.completed,
          accessible: node.accessible,
        })
      })
    })
  })

  return dots
})

const selectNode = (node: MapNode) => {
  if (node.completed || (!node.accessible && !node.inProgress)) return

  activeNodeId.value = null
  gameStore.selectMapNode(node)
  gameStore.handleMapNodeAction(node, router, toastStore)
}

const showResetMapConfirm = ref(false)

const resetMap = () => {
  if (!gameStore.gameState.race) {
    toastStore.showError('Aucune race sélectionnée !', { duration: 2000 })
    router.push('/race-selection')
    return
  }
  if (progressPercentage.value > 0) {
    showResetMapConfirm.value = true
    return
  }
  confirmResetMap()
}

const confirmResetMap = () => {
  gameStore.resetMapOnly()
  gameStore.initializeMapIfNeeded()
  toastStore.showSuccess('Nouvelle carte générée !', { duration: 2000 })
}

const goHome = () => {
  router.push('/')
}

onMounted(() => {
  gameStore.loadGame()
  document.addEventListener('mousedown', closeActiveNodeOnOutsideClick)
  if (gameStore.gameState.currentStatus === 'game-over') {
    router.push('/game-over')
    return
  }
  gameStore.initializeMapIfNeeded()
})

onBeforeUnmount(() => document.removeEventListener('mousedown', closeActiveNodeOnOutsideClick))
</script>

<style scoped>
.mission-map {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--gradient-canvas);
  color: var(--color-text);
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
    radial-gradient(circle at 20% 30%, rgba(var(--color-accent-rgb), 0.05) 0%, transparent 50%),
    radial-gradient(circle at 80% 70%, rgba(var(--overlay-rgb), 0.04) 0%, transparent 50%);
  pointer-events: none;
}

.map-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  flex-wrap: wrap;
  padding: 1.5rem 2rem;
  background: rgba(var(--color-white-rgb), 0.7);
  border-bottom: 1px solid rgba(var(--color-accent-rgb), 0.3);
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
  color: var(--color-accent-ink);
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

.progress-bar-el {
  flex: 1;
  min-width: 80px;
}

.progress-text {
  font-size: 0.9rem;
  font-weight: bold;
  color: var(--color-accent-ink);
  min-width: 40px;
}

.player-status {
  display: flex;
  gap: 1rem;
  align-items: center;
  padding: 0.5rem 1rem;
  background: rgba(var(--overlay-rgb), 0.06);
  border-radius: 8px;
  border: 1px solid rgba(var(--color-accent-rgb), 0.3);
  white-space: nowrap;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.8rem;
}

/* Indicateurs cliquables de l'en-tête (choix accessibles, objectif PV) */
.status-item--link,
.objective-link {
  background: none;
  border: none;
  padding: 0;
  font: inherit;
  cursor: pointer;
}

.status-item--link:hover .status-value {
  text-decoration: underline;
  text-underline-offset: 3px;
}

.objective-link:hover {
  filter: brightness(1.08);
}

.status-label {
  color: var(--color-accent-ink);
  font-weight: bold;
}

.status-value {
  color: var(--color-text);
}

.map-container {
  flex: 1;
  overflow-y: auto;
  overflow-x: auto;
  padding: 1rem 2rem;
  position: relative;
  z-index: 1;
  background: var(--gradient-canvas);
}

.map-layers {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0;
  margin: 1.5rem auto 2.5rem;
  /* Plateau clair (base claire du thème) : les nœuds sombres s'y détachent seuls.
     Texture marbre procédurale (feTurbulence, tuile 420px raccordée via
     stitchTiles) : la table de transfert alpha ne garde que les iso-contours
     du bruit (pic étroit autour de 0.5), ce qui dessine des veines plutôt
     qu'un nuage. Veinage dans l'encre du thème (#2a1f14, cf. --color-text) —
     un data URI ne peut pas lire les variables CSS. */
  background:
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='420' height='420'%3E%3Cfilter id='marble' x='0' y='0' width='100%25' height='100%25'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.009 0.011' numOctaves='4' seed='11' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.16 0 0 0 0 0.12 0 0 0 0 0.08 1 0 0 0 0'/%3E%3CfeComponentTransfer%3E%3CfeFuncA type='table' tableValues='0 0 0 0 0.4 0 0 0 0'/%3E%3C/feComponentTransfer%3E%3C/filter%3E%3Crect width='420' height='420' filter='url(%23marble)'/%3E%3C/svg%3E")
      repeat,
    var(--color-bg-surface);
  border-radius: 24px;
  /* Même bascule 3D que le plateau de la carte de campagne (.map-grid-wrapper),
     angle adouci : ce plateau est bien plus haut que le viewport 600px de la
     carte, 16° y paraîtrait excessif. Le SVG de connexions et les rangées étant
     enfants du wrapper, ils suivent la même transformation — les maths pixel
     restent valides. */
  transform: perspective(1200px) rotateX(3deg);
  box-shadow:
    0 45px 45px -20px rgba(var(--overlay-rgb), 0.35),
    0 18px 20px -14px rgba(var(--overlay-rgb), 0.22);
}

.tree-connections {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
  z-index: 0;
}

.connection-dot {
  /* Liseré sombre discret sur base claire (cf. --overlay-rgb dans tokens.css). */
  fill: rgba(var(--overlay-rgb), 0.45);
  transition: fill 0.3s ease;
}
.connection-dot.active-connection {
  fill: var(--color-accent);
}
.connection-dot.accessible-connection {
  fill: rgba(var(--color-accent-rgb), 0.85);
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
  background: rgba(var(--color-white-rgb), 0.7);
  border-top: 1px solid rgba(var(--color-accent-rgb), 0.3);
  position: sticky;
  bottom: 0;
  z-index: 100;
  backdrop-filter: blur(10px);
}

.legend-toggle {
  align-self: center;
  background: none;
  border: 1px solid rgba(var(--color-accent-rgb), 0.4);
  border-radius: 8px;
  padding: 0.35rem 0.75rem;
  font-size: 0.8rem;
  color: var(--color-accent-ink);
  cursor: pointer;
  white-space: nowrap;
  transition:
    background 0.2s ease,
    border-color 0.2s ease;
}

.legend-toggle:hover {
  background: rgba(var(--color-accent-rgb), 0.12);
  border-color: rgba(var(--color-accent-rgb), 0.6);
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
  background: var(--color-success-strong);
  color: #fff;
}

.status-icon-accessible {
  background: var(--color-accent);
  color: var(--color-accent-contrast);
}

.status-icon-locked {
  background: rgba(var(--overlay-rgb), 0.15);
  color: var(--color-text-faint);
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
