<template>
  <section class="movements-panel">
    <!-- En-tête compact -->
    <div class="panel-header">
      <span class="header-label">Mouvements</span>
    </div>

    <!-- Rangée de chronomètres circulaires (un par mouvement) -->
    <div v-if="allItems.length > 0" class="movements-clocks">
      <div
        v-for="item in allItems"
        :key="item.id"
        class="clock-item"
        :class="item.kind === 'done' ? 'clock-item--done' : 'clock-item--active'"
      >
        <!-- Anneau SVG -->
        <div class="clock-ring">
          <svg viewBox="0 0 60 60" class="clock-svg">
            <circle class="clock-track" cx="30" cy="30" r="26" />
            <circle
              v-if="item.kind !== 'done'"
              class="clock-progress"
              cx="30"
              cy="30"
              r="26"
              :stroke-dasharray="163.36"
              :stroke-dashoffset="163.36 * (1 - item.progress / 100)"
            />
          </svg>
          <div class="clock-inner">
            <span class="clock-icon">{{ item.icon }}</span>
            <span class="clock-time">{{ item.eta }}</span>
          </div>
        </div>
        <!-- Destination -->
        <div class="clock-label">{{ item.label }}</div>
        <!-- Badges unités -->
        <div v-if="item.units" class="clock-units">
          <span v-for="(u, i) in item.units" :key="i" class="unit-badge">{{ u }}</span>
        </div>
      </div>
    </div>

    <div v-else class="empty-hint">Aucun mouvement en cours</div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useMissionStore } from '../../stores/missionStore'
import { useMapStore, type TroopMovement } from '../../stores/mapStore'
import { formatDuration } from '../../utils/formatDuration'

const missionStore = useMissionStore()
const mapStore = useMapStore()

// Horloge commune
const now = ref(Date.now())
let timer: number | null = null

/** Durée d'affichage du statut "arrivé" avant disparition définitive de la carte */
const DONE_DISPLAY_MS = 3000

interface DoneEntry {
  id: string
  icon: string
  label: string
  expiresAt: number
}

/** Mouvements retirés de activeMovements depuis le dernier tick, affichés brièvement en "arrivé" */
const justArrived = ref<DoneEntry[]>([])
let previousMovements = new Map<string, TroopMovement>()

const describeMovement = (mov: TroopMovement) => {
  const tile = mapStore.getTileById(mov.isReturning ? mov.sourceTileId : mov.targetTileId)
  const name = tile ? mapStore.getTileName(tile.type) : '?'
  const coords = tile ? `${tile.position.x}, ${tile.position.y}` : '?'
  return {
    icon: mov.isReturning ? '↩️' : '🪖',
    label: mov.isReturning ? `Retour (${coords})` : `${name} (${coords})`,
  }
}

onMounted(() => {
  previousMovements = new Map(mapStore.mapState.activeMovements.map((m) => [m.id, m]))

  timer = window.setInterval(() => {
    now.value = Date.now()

    const currentMovements = new Map(mapStore.mapState.activeMovements.map((m) => [m.id, m]))
    for (const [id, mov] of previousMovements) {
      if (!currentMovements.has(id)) {
        justArrived.value.push({ id, ...describeMovement(mov), expiresAt: now.value + DONE_DISPLAY_MS })
      }
    }
    justArrived.value = justArrived.value.filter((entry) => entry.expiresAt > now.value)

    previousMovements = currentMovements
  }, 1000)
})
onUnmounted(() => {
  if (timer !== null) clearInterval(timer)
})

// Helpers progression / ETA
const getProgress = (startedAt: number, endsAt: number): number => {
  const total = endsAt - startedAt
  const elapsed = now.value - startedAt
  return Math.min(100, Math.max(0, (elapsed / total) * 100))
}

const formatEta = (endsAt: number): string => {
  const remaining = endsAt - now.value
  if (remaining <= 0) return 'Arrivée...'
  return formatDuration(remaining)
}

const UNIT_ICONS: Record<string, string> = {
  infantry: '⚔️',
  archer: '🏹',
  cavalry: '🐴',
  siege: '⚙️',
}

// Type d'un item unifié dans la liste
interface MovementItem {
  id: string
  kind: 'troop' | 'done'
  icon: string
  label: string
  eta: string
  progress: number
  units?: string[]
}

// Construction de la liste, triée : en-cours d'abord, terminés en bas
const allItems = computed((): MovementItem[] => {
  const items: MovementItem[] = []

  // Troupes en transit
  for (const mov of mapStore.mapState.activeMovements) {
    const tile = mapStore.getTileById(mov.isReturning ? mov.sourceTileId : mov.targetTileId)
    const name = tile ? mapStore.getTileName(tile.type) : '?'
    const coords = tile ? `${tile.position.x}, ${tile.position.y}` : '?'
    items.push({
      id: mov.id,
      kind: 'troop',
      icon: mov.isReturning ? '↩️' : '🪖',
      label: mov.isReturning ? `Retour (${coords})` : `${name} (${coords})`,
      eta: formatEta(mov.arrivalTime),
      progress: getProgress(mov.departureTime, mov.arrivalTime),
      units: mov.units.map((u) => `${UNIT_ICONS[u.type] ?? '🗡️'} ×${u.count}`),
    })
  }

  // Mouvements tout juste arrivés — état transitoire avant disparition
  for (const entry of justArrived.value) {
    items.push({
      id: entry.id,
      kind: 'done',
      icon: entry.icon,
      label: entry.label,
      eta: 'Arrivé !',
      progress: 100,
    })
  }

  // Tri : en-cours par ETA, terminés en bas
  return items.sort((a, b) => {
    if (a.kind === 'done' && b.kind !== 'done') return 1
    if (a.kind !== 'done' && b.kind === 'done') return -1
    return 0
  })
})
</script>

<style scoped>
.movements-panel {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: rgba(15, 25, 50, 0.7);
  border: 1px solid rgba(100, 149, 237, 0.3);
  border-radius: 10px;
  padding: 10px 12px;
}

/* En-tête */
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-label {
  font-size: 0.78rem;
  font-weight: 600;
  color: #93c5fd;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

/* Rangée de chronomètres */
.movements-clocks {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 0.75rem;
}

/* Conteneur d'un chronomètre */
.clock-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
  position: relative;
}

/* Anneau SVG + contenu superposé */
.clock-ring {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.clock-svg {
  display: block;
  width: 64px;
  height: 64px;
}

/* Piste de fond */
.clock-track {
  fill: none;
  stroke: rgba(255, 255, 255, 0.08);
  stroke-width: 3;
}

/* Arc de progression */
.clock-progress {
  fill: none;
  stroke: #ef4444;
  stroke-width: 3;
  stroke-linecap: round;
  transform: rotate(-90deg);
  transform-origin: center;
  transition: stroke-dashoffset 1s linear;
}

/* Mouvement terminé : piste en pointillés, opacité réduite */
.clock-item--done {
  opacity: 0.55;
}

.clock-item--done .clock-track {
  stroke: rgba(34, 197, 94, 0.25);
  stroke-dasharray: 4 4;
}

/* Contenu au centre du cercle */
.clock-inner {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.1rem;
  pointer-events: none;
}

.clock-icon {
  font-size: 1.4rem;
  line-height: 1;
}

.clock-time {
  font-size: 0.6rem;
  color: #fca5a5;
  font-weight: bold;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.clock-item--done .clock-time {
  color: #86efac;
}

/* Label destination */
.clock-label {
  font-size: 0.66rem;
  color: #93c5fd;
  text-align: center;
  max-width: 100px;
  white-space: normal;
  overflow-wrap: break-word;
  line-height: 1.2;
}

/* Badges unités */
.clock-units {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 3px;
  max-width: 80px;
}

.unit-badge {
  font-size: 0.62rem;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 999px;
  padding: 1px 5px;
  color: #94a3b8;
}

/* Vide */
.empty-hint {
  font-size: 0.75rem;
  color: #3f4f6a;
  text-align: center;
  padding: 4px 0;
  font-style: italic;
}
</style>
