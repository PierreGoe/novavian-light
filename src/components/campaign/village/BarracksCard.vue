<!--
  Carte Bento de la Caserne — plus grande que les autres bâtiments car elle
  concentre le plus d'actions possibles (recrutement de 4 types d'unités +
  file d'attente), affichées directement inline plutôt que dans un panneau
  séparé. Composant dédié (pas une variante de BuildingCard.vue) : le contenu
  est structurellement trop différent pour rester un simple slot.
-->
<template>
  <div
    class="building-card"
    :class="[`state-${state}`, { selected }]"
    style="--tc: var(--building-barracks-rgb)"
    v-clickable
    @click="$emit('select')"
  >
    <div class="card-art" aria-hidden="true"><span class="card-art-glyph">{{ icon }}</span></div>

    <div class="card-content">
      <div class="card-top">
        <span
          class="card-icon"
          :class="{ 'card-icon--locked': state === 'locked' }"
          :title="description"
        >{{ icon }}</span>
        <div class="header-meta">
          <div class="card-name">{{ name }}</div>
          <div v-if="state === 'constructing'" class="card-timer-row">
            <TimerClock :size="24" :progress="constructionProgress / 100" />
            <span class="card-status">{{ statusText }}</span>
          </div>
          <div v-else class="card-status">{{ statusText }}</div>
        </div>
        <div class="card-spacer" />
        <span
          v-if="level > 0"
          class="level-badge"
          :class="{ 'level-badge--maxed': state === 'maxed' }"
        >
          {{ level }}
        </span>
        <button
          v-if="state === 'upgradable' || state === 'available' || state === 'waiting'"
          class="quick-btn"
          :class="{ 'quick-btn--build': state === 'available' }"
          :disabled="!actionAffordable"
          :title="!actionAffordable ? 'Ressources insuffisantes' : 'Améliorer les Casernes'"
          @click.stop="$emit('quickAction')"
        >
          {{ state === 'available' ? '+' : '▲' }}
        </button>
      </div>

      <template v-if="showRecruitment">
        <div v-if="garrison.length > 0" class="garrison-row">
          <Badge
            v-for="unit in garrison"
            :key="unit.id"
            tone="neutral"
            :title="`${UNIT_DEFINITIONS[unit.type].name} — ⚔️ ${unit.attack} 🛡️ ${unit.defense} ❤️ ${unit.health}`"
          >
            {{ UNIT_DEFINITIONS[unit.type].icon }} {{ unit.count }}
          </Badge>
        </div>

        <div class="recruit-list">
          <div
            v-for="def in UNIT_DEFINITIONS"
            :key="def.type"
            class="recruit-row"
            :class="{ 'recruit-row--locked': barrackLevel < def.barrackLevelRequired }"
          >
            <div class="recruit-info">
              <span class="u-icon">{{ def.icon }}</span>
              <span v-if="barrackLevel < def.barrackLevelRequired" class="u-lock"
                >🔒 niv. {{ def.barrackLevelRequired }}</span
              >
              <span v-else class="u-cost"
                >{{ def.cost.wood }}/{{ def.cost.clay }}/{{ def.cost.iron }}/{{ def.cost.crop }}</span
              >
            </div>
            <div v-if="barrackLevel >= def.barrackLevelRequired" class="qty-group">
              <button
                v-for="qty in [1, 5, 10]"
                :key="qty"
                class="qty-btn"
                :disabled="!canAffordBatch(def.type, qty)"
                @click="handleRecruit(def.type, qty)"
              >
                +{{ qty }}
              </button>
            </div>
          </div>
        </div>

        <div v-if="trainingQueue.length > 0" class="queue-row">
          <TimerClock
            :size="36"
            :progress="getEntryProgress(trainingQueue[0]) / 100"
            :icon="UNIT_DEFINITIONS[trainingQueue[0].type].icon"
          />
          <div class="queue-label">
            <span class="queue-name">{{ UNIT_DEFINITIONS[trainingQueue[0].type].name }}</span>
            <span class="queue-eta">
              {{ getRemainingTime(trainingQueue[0]) }}
              <template v-if="waitingCount > 0"> · +{{ waitingCount }} en attente</template>
            </span>
          </div>
          <button
            class="queue-cancel"
            title="Annuler 1 unité et récupérer les ressources"
            @click="handleCancel(trainingQueue[0])"
          >
            ✕
          </button>
        </div>
        <div v-else class="queue-empty">Aucune unité en construction</div>
      </template>
      <div v-else class="card-spacer" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { UNIT_DEFINITIONS } from '@/stores/missionStore'
import TimerClock from '@/components/ui/TimerClock.vue'
import Badge from '@/components/ui/Badge.vue'
import { useUnitTraining } from '@/composables/useUnitTraining'

type BuildingState = 'locked' | 'available' | 'constructing' | 'upgradable' | 'waiting' | 'maxed'

const props = withDefaults(
  defineProps<{
    icon: string
    name: string
    level: number
    state: BuildingState
    statusText: string
    description: string
    constructionProgress?: number
    actionAffordable?: boolean
    selected?: boolean
  }>(),
  {
    constructionProgress: 0,
    actionAffordable: true,
    selected: false,
  },
)

defineEmits<{ select: []; quickAction: [] }>()

const {
  barrackLevel,
  trainingQueue,
  garrison,
  groupedWaiting,
  canAffordBatch,
  handleRecruit,
  handleCancel,
  getRemainingTime,
  getEntryProgress,
} = useUnitTraining()

// Le recrutement n'a de sens que si la Caserne est construite et pas en chantier —
// corrige un bug de l'ancien UnitsTrainingSection.vue, qui ne vérifiait que le
// niveau sans tenir compte d'un chantier en cours (voir getBuildingState()).
const showRecruitment = computed(
  () => props.state === 'upgradable' || props.state === 'waiting' || props.state === 'maxed',
)

const waitingCount = computed(() => groupedWaiting.value.reduce((sum, g) => sum + g.count, 0))
</script>

<style scoped>
.building-card {
  position: relative;
  height: 100%;
  border-radius: 16px;
  border: 1.5px solid rgba(var(--overlay-rgb), 0.12);
  background: var(--color-bg-surface);
  overflow: hidden;
  cursor: pointer;
  box-shadow:
    0 1px 2px rgba(var(--overlay-rgb), 0.05),
    0 4px 12px -6px rgba(var(--overlay-rgb), 0.15);
  transition:
    transform 0.15s ease,
    box-shadow 0.15s ease,
    border-color 0.15s ease;
}

.building-card:hover {
  transform: translateY(-2px);
  box-shadow:
    0 2px 4px rgba(var(--overlay-rgb), 0.08),
    0 10px 20px -10px rgba(var(--overlay-rgb), 0.25);
}

.building-card.selected {
  outline: 2px solid rgba(var(--tc), 0.85);
  outline-offset: 2px;
}

.building-card::before {
  content: '';
  position: absolute;
  inset: 0 auto 0 0;
  width: 4px;
  background: rgba(var(--tc), 0.85);
  z-index: 2;
}

.card-art {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  background:
    radial-gradient(130% 100% at 12% -10%, rgba(var(--tc), 0.28), transparent 62%),
    linear-gradient(165deg, rgba(var(--tc), 0.1), transparent 75%);
}

.card-art::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, transparent 30%, var(--color-bg-surface) 92%);
}

.card-art-glyph {
  position: absolute;
  right: -0.3em;
  bottom: -0.25em;
  font-size: 4.8rem;
  line-height: 1;
  opacity: 0.14;
  transform: rotate(-6deg);
}

.card-content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 0.65rem 0.7rem 0.6rem;
  gap: 0.5rem;
}

.card-top {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.card-icon {
  flex-shrink: 0;
  font-size: 2.1rem;
  line-height: 1;
  filter: drop-shadow(0 1px 3px rgba(var(--overlay-rgb), 0.25));
}

.card-icon--locked {
  filter: grayscale(1) opacity(0.5);
}

.header-meta {
  min-width: 0;
}

.card-name {
  font-size: 0.94rem;
  font-weight: 700;
  color: var(--color-text);
  line-height: 1.2;
}

.card-status {
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-faint);
}

.card-timer-row {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.card-spacer {
  flex: 1;
}

.level-badge {
  font-size: 0.62rem;
  font-weight: 800;
  color: #fff;
  background: rgba(var(--tc), 0.92);
  border-radius: 999px;
  padding: 0.05rem 0.4rem;
  line-height: 1.4;
  flex-shrink: 0;
}

.level-badge--maxed {
  background: var(--rarity-epic);
}

.quick-btn {
  flex-shrink: 0;
  font-weight: 800;
  font-size: 0.72rem;
  color: #fff;
  background: var(--color-success-strong);
  border: none;
  border-radius: 8px;
  width: 26px;
  height: 26px;
  cursor: pointer;
  box-shadow: 0 2px 6px -2px rgba(var(--color-success-strong-rgb), 0.6);
  transition:
    transform 0.1s,
    filter 0.15s;
}

.quick-btn:hover:not(:disabled) {
  filter: brightness(1.1);
  transform: translateY(-1px);
}

.quick-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  box-shadow: none;
}

.quick-btn--build {
  background: var(--color-info);
  box-shadow: 0 2px 6px -2px rgba(var(--color-info-rgb), 0.6);
}

/* ---- États (bâtiment pas encore construit / en chantier) ---- */
.state-available {
  border-style: dashed;
  border-color: rgba(var(--color-info-rgb), 0.4);
}
.state-available .card-icon {
  opacity: 0.7;
}
.state-available .card-status {
  color: var(--color-info);
}

.state-constructing {
  border-color: rgba(var(--color-accent-rgb), 0.4);
}
.state-constructing .card-status {
  color: var(--color-accent-ink);
}

.state-locked {
  opacity: 0.55;
  filter: grayscale(0.6);
}
.state-locked .card-status {
  color: var(--rarity-common);
}

.state-maxed .card-status {
  color: var(--rarity-epic);
}

/* ---- Garnison (unités déjà recrutées) ---- */
.garrison-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

/* ---- Recrutement inline ---- */
.recruit-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.4rem;
  overflow-y: auto;
}

.recruit-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.4rem;
  min-width: 0;
  background: var(--color-bg-canvas);
  border: 1px solid rgba(var(--overlay-rgb), 0.06);
  border-radius: 10px;
  padding: 0.35rem 0.5rem;
}

.recruit-row--locked {
  opacity: 0.6;
}

.recruit-info {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  min-width: 0;
}

.u-icon {
  font-size: 0.95rem;
  flex-shrink: 0;
}

.u-cost,
.u-lock {
  font-variant-numeric: tabular-nums;
  font-size: 0.62rem;
  color: var(--color-text-faint);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.qty-group {
  display: flex;
  gap: 0.2rem;
  flex-shrink: 0;
}

.qty-btn {
  font-size: 0.62rem;
  font-weight: 700;
  color: var(--building-barracks);
  background: rgba(var(--building-barracks-rgb), 0.1);
  border: 1px solid rgba(var(--building-barracks-rgb), 0.25);
  border-radius: 6px;
  padding: 0.1rem 0.3rem;
  cursor: pointer;
  transition: background 0.15s;
}

.qty-btn:hover:not(:disabled) {
  background: rgba(var(--building-barracks-rgb), 0.18);
}

.qty-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

@media (max-width: 480px) {
  .recruit-list {
    grid-template-columns: 1fr;
  }
}

/* ---- File de construction ---- */
.queue-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: auto;
  padding-top: 0.4rem;
  border-top: 1px dashed rgba(var(--overlay-rgb), 0.1);
}

.queue-label {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  flex: 1;
  min-width: 0;
}

.queue-name {
  font-size: 0.74rem;
  font-weight: 600;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.queue-eta {
  font-size: 0.66rem;
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
}

.queue-cancel {
  flex-shrink: 0;
  background: rgba(var(--overlay-rgb), 0.06);
  border: 1px solid rgba(var(--overlay-rgb), 0.15);
  color: var(--color-text-faint);
  cursor: pointer;
  font-size: 0.62rem;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition:
    color 0.15s,
    background 0.15s,
    border-color 0.15s;
}

.queue-cancel:hover {
  color: #fff;
  border-color: var(--color-danger);
  background: var(--color-danger);
}

.queue-empty {
  margin-top: auto;
  padding-top: 0.4rem;
  border-top: 1px dashed rgba(var(--overlay-rgb), 0.1);
  font-size: 0.68rem;
  color: var(--color-text-faint);
  text-align: center;
}
</style>
