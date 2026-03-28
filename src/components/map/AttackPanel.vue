<template>
  <div class="attack-panel">
    <!-- Onglets mode -->
    <div class="mode-tabs">
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'quick' }"
        @click="activeTab = 'quick'"
      >
        ⚡ Rapide
      </button>
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'custom' }"
        @click="activeTab = 'custom'"
      >
        ⚙️ Personnalisé
      </button>
    </div>

    <!-- ── Mode Rapide : clic = envoi immédiat ── -->
    <div v-if="activeTab === 'quick'" class="tab-content">
      <p class="mode-hint">Cliquez sur une stratégie pour envoyer immédiatement</p>
      <div class="quick-strategies">
        <button
          v-for="(strategy, mode) in QUICK_ATTACK_STRATEGIES"
          :key="mode"
          class="strategy-card"
          :class="{ disabled: !canUseMode(mode) }"
          :disabled="!canUseMode(mode)"
          @click="launchQuick(mode)"
        >
          <div class="strategy-top">
            <span class="strategy-icon">{{ strategy.icon }}</span>
            <span class="strategy-label">{{ strategy.label }}</span>
          </div>

          <!-- Vue icônes des unités envoyées -->
          <div class="strategy-unit-chips" v-if="canUseMode(mode) && quickPlanFor(mode)">
            <span
              v-for="u in quickPlanFor(mode)!.units"
              :key="u.type"
              class="unit-chip"
              :title="unitLabel(u.type)"
            >
              {{ unitIcon(u.type) }}<strong>×{{ u.count }}</strong>
            </span>
          </div>
          <span v-else-if="!canUseMode(mode)" class="strategy-reason">
            {{ disabledReason(mode) }}
          </span>

          <!-- Stats compactes : trajet + transport -->
          <div class="strategy-meta" v-if="canUseMode(mode) && quickPlanFor(mode)">
            <span>⏱️ {{ travelLabel(quickPlanFor(mode)!.units) }}</span>
            <span>🎒 {{ quickPlanFor(mode)!.carryCapacity }}</span>
          </div>
        </button>
      </div>
    </div>

    <!-- ── Mode Personnalisé ── -->
    <div v-if="activeTab === 'custom'" class="tab-content">
      <div class="custom-units">
        <div
          v-for="unit in availableUnits"
          :key="unit.type"
          class="unit-row"
          :class="{ exhausted: unit.count === 0 }"
        >
          <span class="unit-icon">{{ unitIcon(unit.type) }}</span>
          <span class="unit-type-label">{{ unitLabel(unit.type) }}</span>
          <div class="unit-controls">
            <button
              class="qty-btn"
              @click="decrement(unit.type)"
              :disabled="(composition[unit.type] ?? 0) <= 0"
            >
              −
            </button>
            <input
              class="qty-input"
              type="number"
              min="0"
              :max="unit.count"
              :value="composition[unit.type] ?? 0"
              @change="setCount(unit.type, +($event.target as HTMLInputElement).value)"
            />
            <button
              class="qty-btn"
              @click="increment(unit.type)"
              :disabled="(composition[unit.type] ?? 0) >= unit.count"
            >
              +
            </button>
            <button
              class="qty-all-btn"
              @click="setCount(unit.type, unit.count)"
              title="Tout envoyer"
            >
              max
            </button>
          </div>
          <span class="unit-max">/ {{ unit.count }}</span>
          <span
            class="unit-carry"
            :title="`${UNIT_CARRY_CAPACITY[unit.type] ?? 10} ressources par unité`"
          >
            🎒×{{ UNIT_CARRY_CAPACITY[unit.type] ?? 10 }}
          </span>
        </div>
      </div>

      <!-- Erreurs de validation -->
      <div v-if="validationErrors.length" class="validation-errors">
        <p v-for="e in validationErrors" :key="e.field" class="validation-error">{{ e.message }}</p>
      </div>

      <!-- Récapitulatif icônes + stats -->
      <div v-if="customPlan" class="custom-summary">
        <div class="summary-chips">
          <span
            v-for="u in customPlan.units"
            :key="u.type"
            class="unit-chip unit-chip--lg"
            :title="unitLabel(u.type)"
          >
            {{ unitIcon(u.type) }}<strong>×{{ u.count }}</strong>
          </span>
        </div>
        <div class="summary-meta">
          <span>⏱️ {{ travelLabel(customPlan.units) }}</span>
          <span>🎒 {{ customPlan.carryCapacity }}</span>
          <span v-if="customPlan.hasSiege" class="has-siege">🏰 Siège</span>
        </div>

        <!-- Bouton confirm uniquement en mode custom -->
        <button class="confirm-btn" @click="confirm">⚔️ Envoyer ces troupes</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { MovementUnit } from '../../stores/mapStore'
import {
  QUICK_ATTACK_STRATEGIES,
  buildQuickAttackPlan,
  buildCustomAttackPlan,
  validateCustomComposition,
  type AvailableUnit,
  type AttackComposition,
  type AttackPlan,
  type QuickAttackMode,
} from '../../combat/attackPlanner'
import { UNIT_CARRY_CAPACITY } from '../../combat/loot'

// ------------------------------------
// Props / Emits
// ------------------------------------

interface Props {
  availableUnits: AvailableUnit[]
  /** Durée de trajet en ms pour chaque composition (calculée par le parent) */
  computeTravelMs: (units: MovementUnit[]) => number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  /** Émis quand le joueur confirme l'attaque avec les unités choisies */
  confirm: [units: MovementUnit[]]
}>()

// ------------------------------------
// État local
// ------------------------------------

const activeTab = ref<'quick' | 'custom'>('quick')

/** Composition personnalisée : type → nombre envoyé */
const composition = ref<AttackComposition>({})

// Initialiser la composition à 0 pour chaque type
watch(
  () => props.availableUnits,
  (units) => {
    const next: AttackComposition = {}
    for (const u of units) next[u.type] = composition.value[u.type] ?? 0
    composition.value = next
  },
  { immediate: true },
)

// ------------------------------------
// Plans calculés
// ------------------------------------

/** Retourne le plan précalculé pour un mode rapide donné (mémoïsé par computed) */
const quickPlanFor = (mode: QuickAttackMode): AttackPlan | null =>
  buildQuickAttackPlan(props.availableUnits, mode)

const validationErrors = computed(() =>
  validateCustomComposition(composition.value, props.availableUnits),
)

const customPlan = computed<AttackPlan | null>(() => {
  if (validationErrors.value.length > 0) return null
  return buildCustomAttackPlan(composition.value, props.availableUnits)
})

// ------------------------------------
// Guards des modes rapides
// ------------------------------------

const hasSiegeUnits = computed(() =>
  props.availableUnits.some((u) => u.type === 'siege' && u.count > 0),
)
const hasNonSiegeUnits = computed(() =>
  props.availableUnits.some((u) => u.type !== 'siege' && u.count > 0),
)
const hasCavalry = computed(() =>
  props.availableUnits.some((u) => u.type === 'cavalry' && u.count > 0),
)

const canUseMode = (mode: QuickAttackMode): boolean => {
  switch (mode) {
    case 'siege':
      return hasSiegeUnits.value
    case 'raid':
      return hasCavalry.value || hasNonSiegeUnits.value
    case 'balanced':
      return hasNonSiegeUnits.value
    default:
      return props.availableUnits.some((u) => u.count > 0)
  }
}

const disabledReason = (mode: QuickAttackMode): string => {
  switch (mode) {
    case 'siege':
      return 'Aucune arme de siège'
    case 'raid':
      return 'Aucune unité mobile'
    case 'balanced':
      return 'Aucune unité disponible'
    default:
      return ''
  }
}

// ------------------------------------
// Actions composition custom
// ------------------------------------

const setCount = (type: string, value: number) => {
  const max = props.availableUnits.find((u) => u.type === type)?.count ?? 0
  composition.value = { ...composition.value, [type]: Math.min(Math.max(0, value), max) }
}

const increment = (type: string) => {
  setCount(type, (composition.value[type] ?? 0) + 1)
}

const decrement = (type: string) => {
  setCount(type, (composition.value[type] ?? 0) - 1)
}

// ------------------------------------
// Affichage
// ------------------------------------

const UNIT_ICONS: Record<string, string> = {
  infantry: '🗡️',
  archer: '🏹',
  cavalry: '🐴',
  siege: '⚙️',
}

const UNIT_LABELS: Record<string, string> = {
  infantry: 'Infanterie',
  archer: 'Archers',
  cavalry: 'Cavalerie',
  siege: 'Siège',
}

const unitIcon = (type: string) => UNIT_ICONS[type] ?? '🪖'
const unitLabel = (type: string) => UNIT_LABELS[type] ?? type

/** Formate le temps de trajet estimé pour un jeu d'unités */
const travelLabel = (units: MovementUnit[]): string => {
  const ms = props.computeTravelMs(units)
  const s = Math.ceil(ms / 1000)
  return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`
}

// ------------------------------------
// Confirmation
// ------------------------------------

/** Mode rapide : envoi immédiat au clic sur la carte */
const launchQuick = (mode: QuickAttackMode) => {
  const plan = quickPlanFor(mode)
  if (!plan) return
  emit('confirm', plan.units)
}

/** Mode custom : envoi via le bouton */
const confirm = () => {
  if (!customPlan.value) return
  emit('confirm', customPlan.value.units)
}
</script>

<style scoped>
.attack-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* ── Onglets ── */
.mode-tabs {
  display: flex;
  gap: 6px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 10px;
  padding: 4px;
}

.tab-btn {
  flex: 1;
  padding: 8px;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: #aaa;
  font-size: 0.88em;
  font-weight: 600;
  cursor: pointer;
  transition:
    background 0.15s,
    color 0.15s;
}

.tab-btn.active {
  background: rgba(198, 40, 40, 0.25);
  color: #ef9a9a;
}

.mode-hint {
  margin: 0;
  font-size: 0.75em;
  color: #666;
  text-align: center;
}

/* ── Cartes de stratégie rapide ── */
.quick-strategies {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.strategy-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.03);
  cursor: pointer;
  text-align: left;
  transition:
    border-color 0.15s,
    background 0.15s,
    transform 0.1s;
}

.strategy-card:hover:not(.disabled) {
  background: rgba(239, 83, 80, 0.1);
  border-color: rgba(239, 83, 80, 0.4);
  transform: translateY(-1px);
}

.strategy-card:active:not(.disabled) {
  transform: translateY(0);
}

.strategy-card.disabled {
  opacity: 0.38;
  cursor: default;
}

.strategy-top {
  display: flex;
  align-items: center;
  gap: 7px;
}

.strategy-icon {
  font-size: 1.2em;
  line-height: 1;
}

.strategy-label {
  font-size: 0.85em;
  font-weight: 700;
  color: #eee;
}

.strategy-reason {
  font-size: 0.7em;
  color: #f59e0b;
  font-style: italic;
}

/* ── Chips d'unités ── */
.strategy-unit-chips,
.summary-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.unit-chip {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 0.82em;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 999px;
  padding: 2px 8px;
  color: #ddd;
  white-space: nowrap;
}

.unit-chip strong {
  color: #fff;
  font-size: 1em;
}

.unit-chip--lg {
  font-size: 0.92em;
  padding: 4px 10px;
}

/* ── Stats compactes sous les cartes ── */
.strategy-meta,
.summary-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 0.72em;
  color: #90caf9;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  padding-top: 6px;
}

.has-siege {
  color: #ce93d8;
}

/* ── Récapitulatif mode custom ── */
.custom-summary {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  padding: 12px;
}

/* ── Mode personnalisé ── */
.custom-units {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.unit-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.02);
}

.unit-row.exhausted {
  opacity: 0.4;
}

.unit-icon {
  font-size: 1.1em;
  width: 24px;
  text-align: center;
}

.unit-type-label {
  flex: 1;
  font-size: 0.83em;
  color: #ccc;
}

.unit-controls {
  display: flex;
  align-items: center;
  gap: 4px;
}

.qty-btn {
  width: 26px;
  height: 26px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 5px;
  background: rgba(255, 255, 255, 0.06);
  color: #eee;
  font-size: 1em;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.12s;
}

.qty-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.12);
}

.qty-btn:disabled {
  opacity: 0.3;
  cursor: default;
}

.qty-input {
  width: 48px;
  text-align: center;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 5px;
  color: #fff;
  font-size: 0.88em;
  padding: 3px 4px;
}

.qty-all-btn {
  font-size: 0.68em;
  padding: 3px 7px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 5px;
  background: rgba(255, 255, 255, 0.04);
  color: #90caf9;
  cursor: pointer;
  transition: background 0.12s;
}

.qty-all-btn:hover {
  background: rgba(100, 181, 246, 0.15);
}

.unit-max {
  font-size: 0.75em;
  color: #666;
  min-width: 32px;
}

.unit-carry {
  font-size: 0.72em;
  color: #888;
  cursor: default;
}

/* ── Validation ── */
.validation-errors {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.validation-error {
  font-size: 0.78em;
  color: #ef5350;
  background: rgba(239, 83, 80, 0.1);
  border: 1px solid rgba(239, 83, 80, 0.2);
  border-radius: 6px;
  padding: 5px 9px;
  margin: 0;
}

/* ── Bouton confirmation (mode custom uniquement) ── */
.confirm-btn {
  padding: 11px;
  border: none;
  border-radius: 8px;
  background: linear-gradient(135deg, #c62828, #e53935);
  color: #fff;
  font-size: 0.9em;
  font-weight: 700;
  cursor: pointer;
  transition:
    opacity 0.15s,
    transform 0.1s;
}

.confirm-btn:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}
</style>
