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
        <TimerClock
          :size="64"
          :progress="item.kind !== 'done' ? item.progress / 100 : undefined"
          :icon="item.icon"
          :done="item.kind === 'done'"
          progress-color="var(--color-danger)"
        >
          <span class="clock-time">{{ item.eta }}</span>
        </TimerClock>
        <!-- Destination -->
        <div class="clock-label">{{ item.label }}</div>
        <!-- Badges unités -->
        <div v-if="item.units" class="clock-units">
          <Badge v-for="(u, i) in item.units" :key="i" tone="neutral">{{ u }}</Badge>
        </div>
      </div>
    </div>

    <EmptyState v-else message="Aucun mouvement en cours" />
  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useMissionStore } from '../../stores/missionStore'
import { useMapStore, type TroopMovement } from '../../stores/mapStore'
import { formatDuration } from '../../utils/formatDuration'
import TimerClock from '@/components/ui/TimerClock.vue'
import Badge from '@/components/ui/Badge.vue'
import EmptyState from '@/components/ui/EmptyState.vue'

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
        justArrived.value.push({
          id,
          ...describeMovement(mov),
          expiresAt: now.value + DONE_DISPLAY_MS,
        })
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
  background: rgba(var(--color-white-rgb), 0.85);
  border: 1px solid rgba(var(--overlay-rgb), 0.15);
  border-radius: 10px;
  padding: 10px 12px;
  box-shadow: 0 4px 16px rgba(var(--color-black-rgb), 0.08);
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
  color: var(--color-text-muted);
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

/* Mouvement terminé : opacité réduite (le style de piste "arrivé" est géré par TimerClock) */
.clock-item--done {
  opacity: 0.55;
}

.clock-time {
  font-size: 0.6rem;
  color: var(--color-danger);
  font-weight: bold;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.clock-item--done .clock-time {
  color: var(--color-success);
}

/* Label destination */
.clock-label {
  font-size: 0.66rem;
  color: var(--color-text-muted);
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
</style>
