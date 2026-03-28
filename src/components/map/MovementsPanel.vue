<template>
  <section class="movements-panel">

    <!-- En-tête compact -->
    <div class="panel-header">
      <span class="header-label">Mouvements</span>
      <span class="scouts-badge">
        <span v-for="i in 4" :key="i" class="dot" :class="{ active: i <= scoutsAvailable }"></span>
        {{ scoutsAvailable }}/4
      </span>
    </div>

    <!-- Liste unifiée (éclaireurs + troupes mélangés) -->
    <div v-if="allItems.length > 0" class="movements-list">
      <div
        v-for="item in allItems"
        :key="item.id"
        class="movement-row"
        :class="item.kind"
      >
        <span class="row-icon">{{ item.icon }}</span>
        <div class="row-body">
          <div class="row-top">
            <span class="row-label">{{ item.label }}</span>
            <span class="row-eta">{{ item.eta }}</span>
          </div>
          <template v-if="item.kind !== 'done'">
            <div class="progress-bar">
              <div
                class="progress-fill"
                :class="item.kind + '-fill'"
                :style="{ width: item.progress + '%' }"
              ></div>
            </div>
          </template>
          <div v-if="item.units" class="unit-row">
            <span v-for="(u, i) in item.units" :key="i" class="unit-badge">{{ u }}</span>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="empty-hint">
      Aucun mouvement en cours
    </div>

  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useMissionStore } from '../../stores/missionStore'
import { useMapStore } from '../../stores/mapStore'

const missionStore = useMissionStore()
const mapStore = useMapStore()

// Horloge commune
const now = ref(Date.now())
let timer: number | null = null
onMounted(() => { timer = window.setInterval(() => { now.value = Date.now() }, 1000) })
onUnmounted(() => { if (timer !== null) clearInterval(timer) })

// Scouts disponibles
const scoutsAvailable = computed(() => missionStore.scoutsAvailable.value)

// Helpers progression / ETA
const getProgress = (startedAt: number, endsAt: number): number => {
  const total = endsAt - startedAt
  const elapsed = now.value - startedAt
  return Math.min(100, Math.max(0, (elapsed / total) * 100))
}

const formatEta = (endsAt: number): string => {
  const remaining = Math.max(0, endsAt - now.value)
  const s = Math.ceil(remaining / 1000)
  if (s <= 0) return 'Arrivée...'
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m${s % 60}s`
}

const UNIT_ICONS: Record<string, string> = {
  infantry: '⚔️',
  archer:   '🏹',
  cavalry:  '🐴',
  siege:    '⚙️',
}

// Type d'un item unifié dans la liste
interface MovementItem {
  id: string
  kind: 'scout' | 'troop' | 'done'
  icon: string
  label: string
  eta: string
  progress: number
  units?: string[]
}

// Construction de la liste mélangée, triée : en-cours d'abord, terminés en bas
const allItems = computed((): MovementItem[] => {
  const items: MovementItem[] = []

  // Missions éclaireurs
  for (const m of missionStore.getScoutMissions.value) {
    if (m.status === 'pending') {
      items.push({
        id: m.id,
        kind: 'scout',
        icon: '🔭',
        label: `Éclaireur (${m.target.x}, ${m.target.y})`,
        eta: formatEta(m.endsAt),
        progress: getProgress(m.startedAt, m.endsAt),
      })
    } else {
      items.push({
        id: m.id,
        kind: 'done',
        icon: '✅',
        label: `(${m.target.x}, ${m.target.y}) — Zone découverte`,
        eta: '',
        progress: 100,
      })
    }
  }

  // Troupes en transit
  for (const mov of mapStore.mapState.activeMovements) {
    const tile = mapStore.getTileById(mov.targetTileId)
    const name = tile ? mapStore.getTileName(tile.type) : '?'
    const coords = tile ? `${tile.position.x}, ${tile.position.y}` : '?'
    items.push({
      id: mov.id,
      kind: 'troop',
      icon: '🪖',
      label: `${name} (${coords})`,
      eta: formatEta(mov.arrivalTime),
      progress: getProgress(mov.departureTime, mov.arrivalTime),
      units: mov.units.map((u) => `${UNIT_ICONS[u.type] ?? '🗡️'} ×${u.count}`),
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

.scouts-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  color: #64748b;
}

.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.12);
  transition: background 0.3s;
}
.dot.active {
  background: #3b82f6;
}

/* Liste */
.movements-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

/* Ligne individuelle */
.movement-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  border: 1px solid transparent;
  background: rgba(255, 255, 255, 0.02);
}

.scout { border-color: rgba(100, 149, 237, 0.25); }
.troop { border-color: rgba(239, 68, 68, 0.25); background: rgba(239, 68, 68, 0.03); }
.done  { border-color: rgba(34, 197, 94, 0.2); background: rgba(34, 197, 94, 0.03); opacity: 0.7; }

.row-icon {
  font-size: 0.85rem;
  flex-shrink: 0;
  margin-top: 1px;
}

.row-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.row-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.row-label {
  font-size: 0.78rem;
  color: #cbd5e1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.row-eta {
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
  flex-shrink: 0;
}

.scout .row-eta { color: #93c5fd; }
.troop .row-eta { color: #fca5a5; }

/* Barre de progression */
.progress-bar {
  height: 3px;
  background: rgba(255, 255, 255, 0.07);
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.9s linear;
}

.scout-fill { background: linear-gradient(90deg, #3b82f6, #93c5fd); }
.troop-fill { background: linear-gradient(90deg, #ef4444, #f97316); }

/* Badges d'unités */
.unit-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.unit-badge {
  font-size: 0.68rem;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 999px;
  padding: 1px 6px;
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
