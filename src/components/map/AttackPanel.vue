<template>
  <div class="ap">
    <!-- En-tête : titre + onglets -->
    <div class="ap-header">
      <span class="ap-title">⚔️ Attaque</span>
      <div class="ap-tabs">
        <button
          class="ap-tab"
          :class="{ active: activeTab === 'quick' }"
          @click="activeTab = 'quick'"
        >
          ⚡ Rapide
        </button>
        <button
          class="ap-tab"
          :class="{ active: activeTab === 'custom' }"
          @click="activeTab = 'custom'"
        >
          ⚙️ Custom
        </button>
      </div>
    </div>

    <div class="ap-sep" />

    <!-- ── Mode Rapide ── -->
    <div v-if="activeTab === 'quick'" class="ap-quick">
      <button
        v-for="(strategy, mode) in QUICK_ATTACK_STRATEGIES"
        :key="mode"
        class="ap-strat"
        :class="{ 'ap-strat--disabled': !canUseMode(mode) || sendingQuick !== null }"
        :disabled="!canUseMode(mode) || sendingQuick !== null"
        @click="launchQuick(mode)"
      >
        <!-- Ligne titre -->
        <div class="ap-strat-head">
          <span class="ap-strat-icon">{{ strategy.icon }}</span>
          <span class="ap-strat-label">{{ strategy.label }}</span>
          <span v-if="canUseMode(mode) && quickPlanFor(mode)" class="ap-strat-meta">
            ⏱ {{ travelLabel(quickPlanFor(mode)!.units) }}
          </span>
        </div>
        <!-- add margin up and down -->
        <Separator class="ap-sep" />
        <!-- Avatars unités (max 3 + count) -->
        <div v-if="canUseMode(mode) && quickPlanFor(mode)" class="ap-avatars">
          <span
            v-for="u in quickPlanFor(mode)!.units.slice(0, 3)"
            :key="u.type"
            class="ap-avatar"
            :title="unitLabel(u.type)"
          >
            <span class="ap-avatar-icon">{{ unitIcon(u.type) }}</span>
            <span class="ap-badge">{{ u.count }}</span>
          </span>
          <span
            v-if="quickPlanFor(mode)!.units.length > 3"
            class="ap-avatar ap-avatar--more"
            :title="
              quickPlanFor(mode)!
                .units.slice(3)
                .map((u) => unitLabel(u.type))
                .join(', ')
            "
          >
            <span class="ap-avatar-icon ap-avatar-more-count"
              >+{{ quickPlanFor(mode)!.units.length - 3 }}</span
            >
          </span>
        </div>
        <span v-else-if="!canUseMode(mode)" class="ap-strat-reason">{{
          disabledReason(mode)
        }}</span>
      </button>
    </div>

    <!-- ── Mode Personnalisé ── -->
    <div v-if="activeTab === 'custom'" class="ap-custom">
      <!-- Avatars cliquables avec +/- -->
      <div class="ap-unit-grid">
        <div
          v-for="unit in availableUnits"
          :key="unit.type"
          class="ap-unit"
          :class="{ 'ap-unit--empty': unit.count === 0 }"
        >
          <div
            class="ap-avatar ap-avatar--lg"
            :class="{ 'ap-avatar--active': (composition[unit.type] ?? 0) > 0 }"
          >
            <span class="ap-avatar-icon">{{ unitIcon(unit.type) }}</span>
            <span v-if="(composition[unit.type] ?? 0) > 0" class="ap-badge ap-badge--active">
              {{ composition[unit.type] }}
            </span>
          </div>
          <span class="ap-unit-label">{{ unitLabel(unit.type) }}</span>
          <span class="ap-unit-max">/ {{ unit.count }}</span>
          <div class="ap-unit-controls">
            <button
              class="ap-qty-btn"
              @click="decrement(unit.type)"
              :disabled="(composition[unit.type] ?? 0) <= 0"
            >
              −
            </button>
            <button
              class="ap-qty-btn"
              @click="increment(unit.type)"
              :disabled="(composition[unit.type] ?? 0) >= unit.count"
            >
              +
            </button>
            <button
              class="ap-qty-max"
              @click="setCount(unit.type, unit.count)"
              :disabled="unit.count === 0"
            >
              max
            </button>
          </div>
        </div>
      </div>

      <!-- Erreurs -->
      <div v-if="validationErrors.length" class="ap-errors">
        <span v-for="e in validationErrors" :key="e.field" class="ap-error">{{ e.message }}</span>
      </div>

      <!-- Récap + bouton envoi -->
      <div v-if="customPlan" class="ap-confirm-row">
        <div class="ap-avatars ap-avatars--sm">
          <span
            v-for="u in customPlan.units"
            :key="u.type"
            class="ap-avatar"
            :title="unitLabel(u.type)"
          >
            <span class="ap-avatar-icon">{{ unitIcon(u.type) }}</span>
            <span class="ap-badge ap-badge--active">{{ u.count }}</span>
          </span>
        </div>
        <div class="ap-confirm-meta">
          <span>⏱ {{ travelLabel(customPlan.units) }}</span>
          <span>🎒 {{ customPlan.carryCapacity }}</span>
          <span v-if="customPlan.hasSiege" class="ap-siege">🏰</span>
        </div>
        <button class="ap-send-btn" @click="confirm">⚔️ Envoyer</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { MovementUnit } from '../../stores/mapStore'
import { UNIT_DEFINITIONS } from '../../stores/missionStore'
import { useToastStore } from '../../stores/toastStore'
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
import { Separator } from '@/components/ui/separator'

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

const toastStore = useToastStore()

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

const unitIcon = (type: string) =>
  UNIT_DEFINITIONS[type as keyof typeof UNIT_DEFINITIONS]?.icon ?? '🪖'
const unitLabel = (type: string) =>
  UNIT_DEFINITIONS[type as keyof typeof UNIT_DEFINITIONS]?.name ?? type

/** Formate le temps de trajet estimé pour un jeu d'unités */
const travelLabel = (units: MovementUnit[]): string => {
  const ms = props.computeTravelMs(units)
  const s = Math.ceil(ms / 1000)
  return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`
}

// ------------------------------------
// Confirmation
// ------------------------------------

/** true pendant le court instant qui suit un clic, pour éviter un double-envoi */
const sendingQuick = ref<QuickAttackMode | null>(null)

/** Mode rapide : envoi immédiat au clic sur la carte */
const launchQuick = (mode: QuickAttackMode) => {
  if (sendingQuick.value) return
  const plan = quickPlanFor(mode)
  if (!plan) return

  sendingQuick.value = mode
  emit('confirm', plan.units)
  toastStore.showSuccess(`⚔️ ${QUICK_ATTACK_STRATEGIES[mode].label} envoyée !`, { duration: 2000 })

  // Le panneau disparaît généralement de lui-même (troupes engagées côté parent) ;
  // ce court verrou protège seulement contre un double-clic dans le même instant.
  requestAnimationFrame(() => {
    sendingQuick.value = null
  })
}

/** Mode custom : envoi via le bouton */
const confirm = () => {
  if (!customPlan.value) return
  emit('confirm', customPlan.value.units)
}
</script>

<style scoped>
/* ── Conteneur principal ── */
.ap {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* ── En-tête ── */
.ap-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.ap-title {
  font-size: 0.8em;
  font-weight: 700;
  color: #ef9a9a;
  text-transform: uppercase;
  letter-spacing: 0.07em;
}

.ap-tabs {
  display: flex;
  gap: 3px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 7px;
  padding: 3px;
}

.ap-tab {
  padding: 4px 10px;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: #888;
  font-size: 0.72em;
  font-weight: 600;
  cursor: pointer;
  transition:
    background 0.12s,
    color 0.12s;
  white-space: nowrap;
}

.ap-tab.active {
  background: rgba(198, 40, 40, 0.3);
  color: #ef9a9a;
}

/* ── Mode Rapide : 4 boutons sur une ligne ── */
.ap-quick {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 5px;
}

.ap-strat {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 7px 8px;
  border: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.03);
  cursor: pointer;
  text-align: left;
  transition:
    border-color 0.13s,
    background 0.13s,
    transform 0.1s;
}

.ap-strat:hover:not(.ap-strat--disabled) {
  border-color: rgba(239, 83, 80, 0.45);
  background: rgba(239, 83, 80, 0.08);
  transform: translateY(-1px);
}

.ap-strat--disabled {
  opacity: 0.35;
  cursor: default;
}

.ap-strat-head {
  display: flex;
  align-items: center;
  gap: 5px;
}

.ap-strat-icon {
  font-size: 0.95em;
  line-height: 1;
}

.ap-strat-label {
  flex: 1;
  font-size: 0.76em;
  font-weight: 700;
  color: #eee;
}

.ap-strat-meta {
  font-size: 0.65em;
  color: #90caf9;
}

.ap-strat-reason {
  font-size: 0.65em;
  color: #f59e0b;
  font-style: italic;
}

/* ── Avatars (ShadCN-style) ── */
.ap-avatars {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.ap-avatar {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid rgba(255, 255, 255, 0.13);
  flex-shrink: 0;
}

.ap-avatar--lg {
  width: 38px;
  height: 38px;
}

.ap-avatar--active {
  border-color: rgba(239, 83, 80, 0.5);
  background: rgba(239, 83, 80, 0.12);
}

.ap-avatar-icon {
  font-size: 0.9em;
  line-height: 1;
  user-select: none;
}

/* Badge ShadCN */
.ap-badge {
  position: absolute;
  top: -5px;
  right: -6px;
  min-width: 16px;
  height: 16px;
  padding: 0 3px;
  border-radius: 999px;
  background: rgba(60, 60, 80, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.18);
  color: #ccc;
  font-size: 0.6em;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.ap-badge--active {
  background: #c62828;
  border-color: rgba(255, 255, 255, 0.25);
  color: #fff;
}

/* AvatarGroupCount */
.ap-avatar--more {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
}

.ap-avatar-more-count {
  font-size: 0.62em !important;
  font-weight: 700;
  color: #ccc;
}

/* ── Mode Custom ── */
.ap-custom {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.ap-unit-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(70px, 1fr));
  gap: 6px;
}

.ap-unit {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
}

.ap-unit--empty .ap-avatar {
  opacity: 0.35;
}

.ap-unit-label {
  font-size: 0.63em;
  color: #aaa;
  text-align: center;
  line-height: 1.2;
}

.ap-unit-max {
  font-size: 0.6em;
  color: #555;
}

.ap-unit-controls {
  display: flex;
  gap: 2px;
}

.ap-qty-btn {
  width: 20px;
  height: 20px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.05);
  color: #ddd;
  font-size: 0.85em;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.1s;
}

.ap-qty-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.12);
}

.ap-qty-btn:disabled {
  opacity: 0.25;
  cursor: default;
}

.ap-qty-max {
  padding: 0 5px;
  height: 20px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.04);
  color: #90caf9;
  font-size: 0.6em;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.1s;
}

.ap-qty-max:hover:not(:disabled) {
  background: rgba(100, 181, 246, 0.15);
}

.ap-qty-max:disabled {
  opacity: 0.25;
  cursor: default;
}

/* ── Erreurs ── */
.ap-errors {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.ap-error {
  font-size: 0.7em;
  color: #ef5350;
  background: rgba(239, 83, 80, 0.1);
  border: 1px solid rgba(239, 83, 80, 0.2);
  border-radius: 5px;
  padding: 3px 7px;
}

/* ── Ligne confirmation ── */
.ap-confirm-row {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 6px 8px;
  border: 1px solid rgba(239, 83, 80, 0.2);
  border-radius: 8px;
  background: rgba(239, 83, 80, 0.05);
  flex-wrap: wrap;
}

.ap-confirm-meta {
  display: flex;
  gap: 7px;
  font-size: 0.67em;
  color: #90caf9;
  flex: 1;
  flex-wrap: wrap;
}

.ap-siege {
  color: #ce93d8;
}

.ap-send-btn {
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  background: linear-gradient(135deg, #c62828, #e53935);
  color: #fff;
  font-size: 0.76em;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  transition:
    opacity 0.13s,
    transform 0.1s;
}

.ap-send-btn:hover {
  opacity: 0.88;
  transform: translateY(-1px);
}

/* ── Séparateur ── */
.ap-sep {
  height: 1px;
  background: rgba(255, 255, 255, 0.08);
  border: none;
  margin: 4px 0;
}
</style>
