<template>
  <aside class="timers-panel" :class="{ 'timers-panel--collapsed': effectiveCollapsed }">
    <!-- Toggle masqué sur desktop étroit : le repli y est forcé (voir effectiveCollapsed) -->
    <NavToggleButton
      v-if="!isNarrowDesktop"
      :collapsed="isCollapsed"
      side="right"
      expand-title="Déployer les timers"
      collapse-title="Réduire les timers"
      @toggle="toggleCollapsed"
    />

    <!-- Replié : liste compacte d'horloges (icône + anneau), sans libellé — au survol, le
         titre natif du bouton affiche le détail. Toujours visible, pas besoin de déplier. -->
    <div v-if="effectiveCollapsed" class="timers-compact">
      <button
        v-for="item in allTimers"
        :key="item.id"
        class="timers-compact-item"
        :title="`${item.label} — ${formatDuration(item.remainingMs)}`"
        @click="toggleCollapsed"
      >
        <TimerClock
          :size="36"
          :progress="item.progress"
          :icon="item.icon"
          :progress-color="item.color"
        />
      </button>
      <div v-if="totalCount === 0" class="timers-compact-empty" title="Aucun timer en cours">
        ⏱️
      </div>
    </div>

    <div v-else class="timers-body">
      <h2 class="timers-title">⏱️ Timers</h2>

      <!--
        timer-row volontairement custom, pas de IconRow : sa "colonne icône" est un
        TimerClock complet (anneau de progression), pas une simple icône statique —
        IconRow n'a pas d'emplacement pour ça.
      -->
      <section v-if="constructions.length > 0" class="timers-section">
        <SectionLabel>🏗️ Constructions</SectionLabel>
        <div class="timers-list">
          <div v-for="item in constructions" :key="item.id" class="timer-row">
            <TimerClock :size="40" :progress="item.progress" :icon="item.icon" />
            <div class="timer-row-info">
              <span class="timer-row-label">{{ item.label }}</span>
              <span class="timer-row-eta">{{ formatDuration(item.remainingMs) }}</span>
            </div>
          </div>
        </div>
      </section>

      <section v-if="training.length > 0" class="timers-section">
        <SectionLabel>⚔️ Entraînement</SectionLabel>
        <div class="timers-list">
          <div v-for="item in training" :key="item.id" class="timer-row">
            <TimerClock :size="40" :progress="item.progress" :icon="item.icon" />
            <div class="timer-row-info">
              <span class="timer-row-label">{{ item.label }}</span>
              <span class="timer-row-eta">{{ formatDuration(item.remainingMs) }}</span>
            </div>
          </div>
        </div>
      </section>

      <section v-if="movements.length > 0" class="timers-section">
        <SectionLabel>🪖 Exploration</SectionLabel>
        <div class="timers-list">
          <div v-for="item in movements" :key="item.id" class="timer-row">
            <TimerClock :size="40" :progress="item.progress" :icon="item.icon" />
            <div class="timer-row-info">
              <span class="timer-row-label">{{ item.label }}</span>
              <span class="timer-row-eta">{{ formatDuration(item.remainingMs) }}</span>
            </div>
          </div>
        </div>
      </section>

      <section v-if="raids.length > 0" class="timers-section">
        <SectionLabel>🔴 Raids ennemis</SectionLabel>
        <div class="timers-list">
          <div v-for="item in raids" :key="item.id" class="timer-row">
            <TimerClock
              :size="40"
              :progress="item.progress"
              :icon="item.icon"
              progress-color="var(--color-danger)"
            />
            <div class="timer-row-info">
              <span class="timer-row-label">{{ item.label }}</span>
              <span class="timer-row-eta">{{ formatDuration(item.remainingMs) }}</span>
            </div>
          </div>
        </div>
      </section>

      <EmptyState v-if="totalCount === 0" message="Aucun timer en cours" />
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useMissionStore } from '@/stores/missionStore'
import { useMapStore, HOSTILE_ATTACK_INTERVAL_MS } from '@/stores/mapStore'
import { useExplorationTicker } from '@/composables/useExplorationTicker'
import { BUILDING_DEFINITIONS, getBuildingUpgrade } from '@/data/buildings'
import { UNIT_DEFINITIONS } from '@/stores/missionStore'
import { formatDuration } from '@/utils/formatDuration'
import { useMediaQuery, NARROW_DESKTOP_QUERY } from '@/composables/useMediaQuery'
import TimerClock from '@/components/ui/TimerClock.vue'
import NavToggleButton from '@/components/ui/NavToggleButton.vue'
import SectionLabel from '@/components/ui/SectionLabel.vue'
import EmptyState from '@/components/ui/EmptyState.vue'

const missionStore = useMissionStore()
const mapStore = useMapStore()
// Ne démarre rien ici : lit uniquement l'horloge partagée démarrée par CampaignLayout.vue.
const { now } = useExplorationTicker()

interface TimerItem {
  id: string
  icon: string
  label: string
  progress: number
  remainingMs: number
  color?: string
}

// --- Panneau collapsible — même mécanisme que SideNavBar.vue, côté droit ---
const STORAGE_KEY = 'timers-panel-collapsed'
const isCollapsed = ref<boolean>(localStorage.getItem(STORAGE_KEY) === 'true')
const toggleCollapsed = () => {
  isCollapsed.value = !isCollapsed.value
  localStorage.setItem(STORAGE_KEY, String(isCollapsed.value))
  window.dispatchEvent(new CustomEvent('timers-panel-toggle', { detail: isCollapsed.value }))
}

// Desktop étroit (769px–1200px) : panneau forcé en mode replié, comme SideNavBar.
// Le choix utilisateur (isCollapsed) est conservé et reprend effet au-delà de 1200px.
// L'offset du contenu est plafonné en CSS dans CampaignLayout.vue.
const isNarrowDesktop = useMediaQuery(NARROW_DESKTOP_QUERY)
const effectiveCollapsed = computed(() => isNarrowDesktop.value || isCollapsed.value)

// --- Constructions en cours (même calcul que VillagePlanView.vue) ---
const constructions = computed<TimerItem[]>(() => {
  const buildings = missionStore.town.value?.buildings ?? []
  return buildings
    .filter((b) => b.isUnderConstruction && b.constructionEndTime)
    .map((b) => {
      const def = BUILDING_DEFINITIONS[b.type]
      const duration = getBuildingUpgrade(b.type, b.level).buildTime * 1000
      const startedAt = b.constructionEndTime! - duration
      const progress =
        duration > 0 ? Math.min(1, Math.max(0, (now.value - startedAt) / duration)) : 1
      return {
        id: b.id,
        icon: def.icon,
        label: `${def.name} → niv. ${b.level + 1}`,
        progress,
        remainingMs: Math.max(0, b.constructionEndTime! - now.value),
      }
    })
})

// --- File d'entraînement (même calcul que UnitsTrainingSection.vue) ---
const training = computed<TimerItem[]>(() => {
  return missionStore.trainingQueue.value.map((entry) => {
    const def = UNIT_DEFINITIONS[entry.type]
    const duration = entry.endsAt - entry.startedAt
    const progress =
      duration > 0 ? Math.min(1, Math.max(0, (now.value - entry.startedAt) / duration)) : 1
    return {
      id: entry.id,
      icon: def.icon,
      label: def.name,
      progress,
      remainingMs: Math.max(0, entry.endsAt - now.value),
    }
  })
})

// --- Mouvements de troupes / exploration (même calcul que MovementsPanel.vue) ---
const movements = computed<TimerItem[]>(() => {
  return mapStore.mapState.activeMovements.map((mov) => {
    const tile = mapStore.getTileById(mov.isReturning ? mov.sourceTileId : mov.targetTileId)
    const name = tile ? mapStore.getTileName(tile.type) : '?'
    const coords = tile ? `${tile.position.x}, ${tile.position.y}` : '?'
    const duration = mov.arrivalTime - mov.departureTime
    const progress =
      duration > 0 ? Math.min(1, Math.max(0, (now.value - mov.departureTime) / duration)) : 1
    return {
      id: mov.id,
      icon: mov.isReturning ? '↩️' : '🪖',
      label: mov.isReturning ? `Retour (${coords})` : `${name} (${coords})`,
      progress,
      remainingMs: Math.max(0, mov.arrivalTime - now.value),
    }
  })
})

// --- Raids ennemis à venir — toutes les zones hostiles, pas seulement la plus imminente ---
const raids = computed<TimerItem[]>(() => {
  return Object.values(mapStore.mapState.fortressZones)
    .filter((z) => z.hostilityState === 'hostile' && z.nextAttackAt)
    .map((z) => {
      const tile = mapStore.getTileById(z.fortressTileId)
      const label = tile
        ? `Forteresse (${tile.position.x}, ${tile.position.y})`
        : 'Forteresse hostile'
      const remainingMs = Math.max(0, z.nextAttackAt! - now.value)
      const progress = 1 - remainingMs / HOSTILE_ATTACK_INTERVAL_MS
      return {
        id: z.fortressTileId,
        icon: '⚔️',
        label,
        progress: Math.min(1, Math.max(0, progress)),
        remainingMs,
        color: 'var(--color-danger)',
      }
    })
})

// --- Vue à plat, pour la liste compacte affichée quand le panneau est replié ---
const allTimers = computed<TimerItem[]>(() => [
  ...constructions.value,
  ...training.value,
  ...movements.value,
  ...raids.value,
])

const totalCount = computed(
  () =>
    constructions.value.length +
    training.value.length +
    movements.value.length +
    raids.value.length,
)
</script>

<style scoped>
/* Mirroir de .side-nav (SideNavBar.vue) : sidebar fixe côté droit, même fond, bordure,
   ombre et logique de largeur collapse/expand — pour une cohérence visuelle complète
   entre le menu de navigation (gauche) et le panneau de timers (droite). */
.timers-panel {
  position: fixed;
  top: 0;
  right: 0;
  height: 100vh;
  width: 260px;
  background: var(--color-bg-surface);
  border-left: 1px solid rgba(var(--overlay-rgb), 0.12);
  box-shadow: -3px 0 15px rgba(var(--color-black-rgb), 0.06);
  display: flex;
  flex-direction: column;
  align-items: stretch;
  z-index: 200;
  overflow: hidden;
  transition: width 0.25s ease;
}

.timers-panel--collapsed {
  width: 64px;
}

@media (max-width: 768px) {
  .timers-panel {
    display: none;
  }
}

.timers-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 1rem 1rem;
}

/* Liste compacte affichée quand le panneau est replié — une horloge par timer, sans
   libellé (visible au survol via l'attribut title), pour garder les timers visibles
   sans avoir à déplier le panneau. */
.timers-compact {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
  padding: 0.25rem 0 1rem;
}

.timers-compact-item {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  line-height: 0;
}

.timers-compact-empty {
  font-size: 1.2rem;
  opacity: 0.35;
  cursor: default;
}

.timers-title {
  margin: 0 0 0.75rem;
  font-size: 1rem;
  color: var(--color-accent-ink);
}

.timers-section {
  margin-bottom: 1.1rem;
}

.timers-section :deep(.section-label) {
  display: block;
  margin: 0 0 0.5rem;
}

.timers-list {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.timer-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.timer-row-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 0.1rem;
}

.timer-row-label {
  font-size: 0.78rem;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.timer-row-eta {
  font-size: 0.7rem;
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
}

.timers-empty {
  font-size: 0.8rem;
  color: #6b7280;
  font-style: italic;
  text-align: center;
  padding: 1rem 0;
}
</style>
