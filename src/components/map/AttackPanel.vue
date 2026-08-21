<template>
  <div class="ap">
    <!-- En-tête : titre + onglets (l'exploration n'a pas de stratégies rapides) -->
    <div class="ap-header">
      <SectionLabel>{{ isExplore ? '🗺️ Expédition' : '⚔️ Attaque' }}</SectionLabel>
      <SegmentedControl
        v-if="!isExplore"
        :options="[
          { value: 'quick', label: '⚡ Rapide' },
          { value: 'custom', label: '⚙️ Custom' },
        ]"
        :model-value="activeTab"
        @update:model-value="activeTab = $event as 'quick' | 'custom'"
      />
    </div>

    <!-- ── Mode Rapide : cliquer une stratégie la SÉLECTIONNE (l'envoi passe
         par le CTA partagé plus bas — même niveau d'engagement que le mode
         custom, pas d'attaque irréversible sur un simple clic) ── -->
    <div v-if="activeTab === 'quick'" class="ap-quick">
      <button
        v-for="(strategy, mode) in QUICK_ATTACK_STRATEGIES"
        :key="mode"
        class="ap-strat"
        :class="{
          'ap-strat--disabled': !canUseMode(mode),
          'ap-strat--selected': selectedMode === mode,
        }"
        :disabled="!canUseMode(mode)"
        :title="!canUseMode(mode) ? disabledReason(mode) : strategy.description"
        @click="selectedMode = mode"
      >
        <div class="ap-strat-head">
          <span class="ap-strat-icon">{{ strategy.icon }}</span>
          <span class="ap-strat-label">{{ strategy.label }}</span>
        </div>
        <p class="ap-strat-desc">{{ strategy.description }}</p>

        <!-- Pied : avatars unités (max 3 + count) + ETA -->
        <div v-if="canUseMode(mode) && quickPlanFor(mode)" class="ap-strat-foot">
          <div class="ap-avatars">
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
          <span class="ap-strat-meta" :title="arrivalTitle(quickPlanFor(mode)!.units)"
            >⏱ {{ travelLabel(quickPlanFor(mode)!.units) }}</span
          >
        </div>
        <span v-else class="ap-strat-reason">{{ disabledReason(mode) }}</span>
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
    </div>

    <!-- ── Récap + CTA partagés (rapide ET custom) : LE bouton de la page ── -->
    <div v-if="activePlan" class="ap-confirm-row">
      <div class="ap-avatars ap-avatars--sm">
        <span
          v-for="u in activePlan.units"
          :key="u.type"
          class="ap-avatar"
          :title="unitLabel(u.type)"
        >
          <span class="ap-avatar-icon">{{ unitIcon(u.type) }}</span>
          <CountBadge :count="u.count" variant="active" />
        </span>
      </div>
      <div class="ap-confirm-meta">
        <span v-if="targetLabel" class="ap-target">→ {{ targetLabel }}</span>
        <span :title="arrivalTitle(activePlan.units)">⏱ {{ travelLabel(activePlan.units) }}</span>
        <span>🎒 {{ activePlan.carryCapacity }}</span>
        <span v-if="activePlan.hasSiege" class="ap-siege" title="Armes de siège incluses">🏰</span>
      </div>
      <Button :variant="isExplore ? 'primary' : 'danger'" :disabled="sending" @click="confirm">
        {{ isExplore ? '🗺️ Explorer les ruines' : "⚔️ Lancer l'attaque" }}
      </Button>
    </div>

    <!-- Avertissement siège : contextuel au plan sélectionné, jamais permanent -->
    <p v-if="!isExplore && activePlan && !activePlan.hasSiege" class="ap-siege-hint">
      ⚠️ Sans arme de siège, le village ne sera pas détruit après la victoire
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { MovementUnit } from '../../stores/mapStore'
import { UNIT_DEFINITIONS } from '../../stores/missionStore'
import { getUnitRole } from '@/combat/roles'
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
  /** Rappel de la cible dans la ligne de confirmation (ex : « Forteresse (12, 8) ») */
  targetLabel?: string
  /**
   * 'attack' (défaut) : combat avec stratégies rapides et avertissement siège.
   * 'explore' : expédition sans combat (fouille de ruines) — composition custom uniquement.
   */
  mode?: 'attack' | 'explore'
}

const props = defineProps<Props>()

const isExplore = computed(() => props.mode === 'explore')

const emit = defineEmits<{
  /** Émis quand le joueur confirme l'attaque avec les unités choisies */
  confirm: [units: MovementUnit[]]
}>()

// ------------------------------------
// État local
// ------------------------------------

const activeTab = ref<'quick' | 'custom'>(props.mode === 'explore' ? 'custom' : 'quick')

/** Stratégie rapide sélectionnée (l'envoi se fait via le CTA, pas au clic) */
const selectedMode = ref<QuickAttackMode | null>(null)

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

/** Plan actif selon l'onglet — alimente le récap et le CTA partagés */
const activePlan = computed<AttackPlan | null>(() => {
  if (activeTab.value === 'quick') {
    return selectedMode.value ? quickPlanFor(selectedMode.value) : null
  }
  return customPlan.value
})

// ------------------------------------
// Guards des modes rapides
// ------------------------------------

const hasSiegeUnits = computed(() =>
  props.availableUnits.some((u) => getUnitRole(u.type) === 'siege' && u.count > 0),
)
const hasNonSiegeUnits = computed(() =>
  props.availableUnits.some((u) => getUnitRole(u.type) !== 'siege' && u.count > 0),
)
const hasCavalry = computed(() =>
  props.availableUnits.some((u) => getUnitRole(u.type) === 'cavalry' && u.count > 0),
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

// Présélectionner la première stratégie utilisable pour que le CTA soit
// visible d'emblée (déclaré après canUseMode — le watch est immédiat).
watch(
  () => props.availableUnits,
  () => {
    if (!selectedMode.value || !canUseMode(selectedMode.value)) {
      const modes = Object.keys(QUICK_ATTACK_STRATEGIES) as QuickAttackMode[]
      selectedMode.value = modes.find((m) => canUseMode(m)) ?? null
    }
  },
  { immediate: true },
)

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

/** Heure d'arrivée locale estimée (tooltip du ⏱) — recalculée à chaque rendu */
const arrivalTitle = (units: MovementUnit[]): string => {
  const eta = new Date(Date.now() + props.computeTravelMs(units))
  return `Arrivée estimée à ${eta.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })}`
}

// ------------------------------------
// Confirmation
// ------------------------------------

/** true pendant le court instant qui suit un clic, pour éviter un double-envoi */
const sending = ref(false)

/** Envoi unique via le CTA — le parent affiche son propre toast de départ */
const confirm = () => {
  if (sending.value || !activePlan.value) return
  sending.value = true
  emit('confirm', activePlan.value.units)

  // Le panneau disparaît généralement de lui-même (troupes engagées côté parent) ;
  // ce court verrou protège seulement contre un double-clic dans le même instant.
  requestAnimationFrame(() => {
    sending.value = false
  })
}
</script>

<style scoped>
/* ── Conteneur principal ── */
.ap {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* ── En-tête ── */
.ap-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

/* ── Mode Rapide : 4 cartes de stratégie sélectionnables ── */
.ap-quick {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

/* Vraie carte cliquable calibrée sur BuildingCard : padding 12, radius 12,
   hover levé + ombre, sélection par outline — l'action n°1 du jeu doit avoir
   au moins l'affordance d'une carte de bâtiment. */
.ap-strat {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
  border: 1px solid rgba(var(--overlay-rgb), 0.15);
  border-radius: 12px;
  background: var(--color-bg-surface);
  cursor: pointer;
  text-align: left;
  transition:
    border-color 0.15s,
    background 0.15s,
    transform 0.15s,
    box-shadow 0.15s;
}

.ap-strat:hover:not(.ap-strat--disabled) {
  transform: translateY(-2px);
  border-color: rgba(var(--color-danger-rgb), 0.45);
  background: rgba(var(--color-danger-rgb), 0.04);
  box-shadow:
    0 2px 4px rgba(var(--overlay-rgb), 0.08),
    0 10px 20px -10px rgba(var(--overlay-rgb), 0.25);
}

.ap-strat--selected {
  outline: 2px solid rgba(var(--color-danger-rgb), 0.85);
  outline-offset: 2px;
  border-color: rgba(var(--color-danger-rgb), 0.4);
  background: rgba(var(--color-danger-rgb), 0.06);
}

.ap-strat--disabled {
  opacity: 0.4;
  cursor: default;
}

.ap-strat-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ap-strat-icon {
  font-size: 1.5rem;
  line-height: 1;
}

.ap-strat-label {
  flex: 1;
  font-size: 0.85em;
  font-weight: 700;
  color: var(--color-text);
}

/* La description vend le fantasme de jeu de la stratégie — c'est elle qui
   rend la carte désirable, pas le nom technique du mode. */
.ap-strat-desc {
  margin: 0;
  flex: 1;
  font-size: 0.7em;
  line-height: 1.35;
  color: var(--color-text-faint);
}

.ap-strat-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding-top: 8px;
  border-top: 1px solid rgba(var(--overlay-rgb), 0.08);
}

.ap-strat-meta {
  font-size: 0.68em;
  font-variant-numeric: tabular-nums;
  color: var(--color-info);
  white-space: nowrap;
}

.ap-strat-reason {
  font-size: 0.68em;
  color: var(--color-warning);
  font-style: italic;
  padding-top: 8px;
  border-top: 1px solid rgba(var(--overlay-rgb), 0.08);
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
  gap: 8px;
}

.ap-unit-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(70px, 1fr));
  gap: 8px;
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
  gap: 4px;
}

/* ── Récap + CTA partagés ── */
.ap-confirm-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: 1px solid rgba(var(--color-danger-rgb), 0.2);
  border-radius: 12px;
  background: rgba(var(--color-danger-rgb), 0.05);
  flex-wrap: wrap;
}

.ap-avatars--sm {
  flex: 0 1 auto;
}

.ap-confirm-meta {
  display: flex;
  gap: 8px;
  font-size: 0.72em;
  color: var(--color-info);
  flex: 1;
  flex-wrap: wrap;
  font-variant-numeric: tabular-nums;
}

.ap-siege {
  color: var(--rarity-epic);
}

/* Rappel de la cible dans la ligne de confirmation */
.ap-target {
  color: var(--color-text-muted);
  font-weight: 700;
}

/* Avertissement contextuel : qualifie le plan choisi, une ligne, sans écraser
   le CTA comme le faisait le NoticeBox permanent. */
.ap-siege-hint {
  margin: 0;
  font-size: 0.75em;
  font-style: italic;
  color: var(--color-warning);
}

/* ── Responsive ── */
@media (max-width: 640px) {
  .ap-quick {
    grid-template-columns: repeat(2, 1fr);
  }

  .ap-confirm-row > .btn {
    width: 100%;
  }
}
</style>
