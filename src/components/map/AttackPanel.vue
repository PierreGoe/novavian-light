<template>
  <div class="ap">
    <!-- En-tête : titre + onglets -->
    <div class="ap-header">
      <SectionLabel>⚔️ Attaque</SectionLabel>
      <SegmentedControl
        :options="[
          { value: 'quick', label: '⚡ Rapide' },
          { value: 'custom', label: '⚙️ Custom' },
        ]"
        :model-value="activeTab"
        @update:model-value="activeTab = $event as 'quick' | 'custom'"
      />
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
            <CountBadge :count="u.count" />
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
            <CountBadge :count="composition[unit.type] ?? 0" variant="active" />
          </div>
          <span class="ap-unit-label">{{ unitLabel(unit.type) }}</span>
          <span class="ap-unit-max">/ {{ unit.count }}</span>
          <QuantityStepper
            :model-value="composition[unit.type] ?? 0"
            :min="0"
            :max="unit.count"
            @update:model-value="(v) => setCount(unit.type, v)"
          />
        </div>
      </div>

      <!-- Erreurs -->
      <div v-if="validationErrors.length" class="ap-errors">
        <NoticeBox v-for="e in validationErrors" :key="e.field" variant="danger">{{
          e.message
        }}</NoticeBox>
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
            <CountBadge :count="u.count" variant="active" />
          </span>
        </div>
        <div class="ap-confirm-meta">
          <span>⏱ {{ travelLabel(customPlan.units) }}</span>
          <span>🎒 {{ customPlan.carryCapacity }}</span>
          <span v-if="customPlan.hasSiege" class="ap-siege">🏰</span>
        </div>
        <Button variant="danger" size="sm" @click="confirm">⚔️ Envoyer</Button>
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
import SectionLabel from '@/components/ui/SectionLabel.vue'
import SegmentedControl from '@/components/ui/SegmentedControl.vue'
import CountBadge from '@/components/ui/CountBadge.vue'
import QuantityStepper from '@/components/ui/QuantityStepper.vue'
import NoticeBox from '@/components/ui/NoticeBox.vue'
import Button from '@/components/ui/Button.vue'

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

/* ── Mode Rapide : 4 boutons sur une ligne ── */
.ap-quick {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 5px;
}

/* Custom volontaire : carte de stratégie composée (en-tête icône+libellé+ETA,
   séparateur, rangée d'avatars d'unités OU raison de blocage) — plus riche que
   les 3 slots de `SelectableCard`. Compose déjà `Separator`/`CountBadge`. */
.ap-strat {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 7px 8px;
  border: 1px solid rgba(var(--overlay-rgb), 0.09);
  border-radius: 8px;
  background: rgba(var(--overlay-rgb), 0.03);
  cursor: pointer;
  text-align: left;
  transition:
    border-color 0.13s,
    background 0.13s,
    transform 0.1s;
}

.ap-strat:hover:not(.ap-strat--disabled) {
  border-color: rgba(var(--color-danger-rgb), 0.45);
  background: rgba(var(--color-danger-rgb), 0.08);
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
  color: var(--color-text);
}

.ap-strat-meta {
  font-size: 0.65em;
  color: var(--color-info);
}

.ap-strat-reason {
  font-size: 0.65em;
  color: var(--color-warning);
  font-style: italic;
}

/* ── Avatars ── */
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
  background: rgba(var(--overlay-rgb), 0.07);
  border: 1px solid rgba(var(--overlay-rgb), 0.13);
  flex-shrink: 0;
}

.ap-avatar--lg {
  width: 38px;
  height: 38px;
}

.ap-avatar--active {
  border-color: rgba(var(--color-danger-rgb), 0.5);
  background: rgba(var(--color-danger-rgb), 0.12);
}

.ap-avatar-icon {
  font-size: 0.9em;
  line-height: 1;
  user-select: none;
}

.ap-avatar--more {
  background: rgba(var(--overlay-rgb), 0.1);
  border-color: rgba(var(--overlay-rgb), 0.2);
}

.ap-avatar-more-count {
  font-size: 0.62em !important;
  font-weight: 700;
  color: var(--color-text-muted);
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
  color: var(--color-text-faint);
  text-align: center;
  line-height: 1.2;
}

.ap-unit-max {
  font-size: 0.6em;
  color: var(--color-text-disabled);
}

/* ── Erreurs ── */
.ap-errors {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

/* ── Ligne confirmation ── */
.ap-confirm-row {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 6px 8px;
  border: 1px solid rgba(var(--color-danger-rgb), 0.2);
  border-radius: 8px;
  background: rgba(var(--color-danger-rgb), 0.05);
  flex-wrap: wrap;
}

.ap-confirm-meta {
  display: flex;
  gap: 7px;
  font-size: 0.67em;
  color: var(--color-info);
  flex: 1;
  flex-wrap: wrap;
}

.ap-siege {
  color: var(--rarity-epic);
}

/* ── Séparateur ── */
.ap-sep {
  height: 1px;
  background: rgba(var(--overlay-rgb), 0.08);
  border: none;
  margin: 4px 0;
}

/* ── Responsive ── */
@media (max-width: 480px) {
  .ap-quick {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
