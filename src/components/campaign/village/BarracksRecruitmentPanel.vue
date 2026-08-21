<!--
  Recrutement des Casernes : extrait de l'ancienne BarracksCard.vue. La carte
  Caserne est une tuile générique comme les autres (BuildingCard.vue) — ce
  contenu, trop riche pour tenir sur une petite carte, s'affiche dans le
  panneau de détails sous la grille (VillagePlanView.vue), quand la Caserne
  est sélectionnée et déjà construite.
-->
<template>
  <div class="recruitment-panel">
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
        v-for="def in unitDefinitionsForRace"
        :key="def.type"
        class="recruit-row"
        :class="{ 'recruit-row--locked': barrackLevel < def.barrackLevelRequired }"
        :title="unitTooltip(def)"
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
            :title="
              canAffordBatch(def.type, qty)
                ? `Recruter ${qty} × ${def.name}`
                : missingForBatch(def.type, qty)
            "
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
          <span v-if="waitingCount > 0" :title="waitingDetail">
            · +{{ waitingCount }} en attente</span
          >
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
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { UNIT_DEFINITIONS } from '@/stores/missionStore'
import type { MilitaryUnit } from '@/stores/missionStore'
import { useMissionStore } from '@/stores/missionStore'
import TimerClock from '@/components/ui/TimerClock.vue'
import Badge from '@/components/ui/Badge.vue'
import { useUnitTraining } from '@/composables/useUnitTraining'

const {
  barrackLevel,
  trainingQueue,
  garrison,
  unitDefinitionsForRace,
  groupedWaiting,
  canAffordBatch,
  handleRecruit,
  handleCancel,
  getRemainingTime,
  getEntryProgress,
} = useUnitTraining()

const waitingCount = computed(() => groupedWaiting.value.reduce((sum, g) => sum + g.count, 0))

/** Détail groupé de la file en attente (« 2× Légionnaire · 1× Cavalier ») pour le title */
const waitingDetail = computed(() =>
  groupedWaiting.value.map((g) => `${g.count}× ${UNIT_DEFINITIONS[g.type].name}`).join(' · '),
)

type UnitDef = (typeof UNIT_DEFINITIONS)[string]

/** Tooltip d'une ligne d'unité : nom, coût libellé par ressource, temps d'entraînement */
const unitTooltip = (def: UnitDef): string =>
  `${def.name} — 🪵 ${def.cost.wood} · 🧱 ${def.cost.clay} · ⚒️ ${def.cost.iron} · 🌾 ${def.cost.crop} — ⏱️ ${def.baseTrainingTime}s / unité`

const missionStore = useMissionStore()

/** Détaille les ressources manquantes pour un lot (title des boutons +N désactivés) */
const missingForBatch = (type: MilitaryUnit['type'], qty: number): string => {
  const res = missionStore.displayResources.value
  const cost = UNIT_DEFINITIONS[type].cost
  const parts: string[] = []
  const check = (icon: string, current: number, needed: number) => {
    if (current < needed) parts.push(`${Math.ceil(needed - current)} ${icon}`)
  }
  check('🪵', res.wood, cost.wood * qty)
  check('🧱', res.clay, cost.clay * qty)
  check('⚒️', res.iron, cost.iron * qty)
  check('🌾', res.crop, cost.crop * qty)
  if (parts.length === 0) return 'Ressources insuffisantes'
  return `Il manque ${parts.join(', ')} pour ${qty} unité${qty > 1 ? 's' : ''}`
}
</script>

<style scoped>
.recruitment-panel {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding-top: 0.6rem;
  border-top: 1px dashed rgba(var(--overlay-rgb), 0.12);
}

.garrison-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.recruit-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.4rem;
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

.queue-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
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
  padding-top: 0.4rem;
  border-top: 1px dashed rgba(var(--overlay-rgb), 0.1);
  font-size: 0.68rem;
  color: var(--color-text-faint);
  text-align: center;
}
</style>
