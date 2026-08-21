<!--
  Carte Bento générique pour un bâtiment (QG + les 4 bâtiments de ressource).
  Purement présentationnelle : tout l'état (BuildingState, progression du
  chantier, libellé de statut) est calculé par VillagePlanView.vue, seule
  source de vérité — voir BarracksCard.vue pour la Caserne, dont le contenu
  riche (recrutement inline) est structurellement trop différent pour rester
  une variante de ce composant.
-->
<template>
  <div
    class="building-card"
    :class="[`building-card--${size}`, `state-${state}`, { selected }]"
    :style="{ '--tc': tcVar }"
    v-clickable
    @click="$emit('select')"
  >
    <div class="card-art" aria-hidden="true"><span class="card-art-glyph">{{ icon }}</span></div>

    <div class="card-content">
      <div class="card-top">
        <span
          class="card-icon"
          :class="{
            'card-icon--locked': state === 'locked',
            'card-icon--constructing': state === 'constructing',
          }"
          :title="description"
        >
          {{ icon }}
        </span>
        <span v-if="level > 0" class="level-badge" :class="{ 'level-badge--maxed': state === 'maxed' }">
          {{ level }}
        </span>
      </div>

      <div class="card-name" :title="description">{{ name }}</div>

      <!-- Anneau + texte côte à côte pendant le chantier — jamais superposé
           sur l'icône, jamais muet (voir TimersPanel.vue/MovementsPanel.vue). -->
      <div v-if="state === 'constructing'" class="card-timer-row">
        <TimerClock :size="size === 'lg' ? 28 : 22" :progress="constructionProgress / 100" />
        <span class="card-status" :title="statusDetail">{{ statusText }}</span>
      </div>
      <div v-else class="card-status" :title="statusDetail">{{ statusText }}</div>

      <div class="card-spacer" />

      <button
        v-if="state === 'upgradable' || state === 'available' || state === 'waiting'"
        class="quick-btn"
        :class="{ 'quick-btn--build': state === 'available' }"
        :disabled="!actionAffordable"
        :title="
          !actionAffordable
            ? missingResources
              ? `Ressources insuffisantes — ${missingResources}`
              : 'Ressources insuffisantes'
            : undefined
        "
        @click.stop="$emit('quickAction')"
      >
        {{ state === 'available' ? '+' : '▲' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { BuildingType } from '@/data/buildings'
import TimerClock from '@/components/ui/TimerClock.vue'

type BuildingState = 'locked' | 'available' | 'constructing' | 'upgradable' | 'waiting' | 'maxed'

const props = withDefaults(
  defineProps<{
    type: BuildingType
    icon: string
    name: string
    level: number
    state: BuildingState
    size?: 'sm' | 'lg'
    selected?: boolean
    statusText: string
    /** Phrase complète expliquant le statut condensé (title au survol) */
    statusDetail?: string
    /** Description du bâtiment (title sur l'icône et le nom) */
    description?: string
    constructionProgress?: number
    actionAffordable?: boolean
    /** Détail des ressources manquantes (title du bouton d'action désactivé) */
    missingResources?: string
  }>(),
  {
    size: 'sm',
    selected: false,
    statusDetail: undefined,
    description: undefined,
    constructionProgress: 0,
    actionAffordable: true,
    missingResources: undefined,
  },
)

defineEmits<{ select: []; quickAction: [] }>()

// Réinjecte le triplet rgb partagé (tokens.css) dans une variable locale --tc,
// pour garder le mécanisme `rgba(var(--tc), …)` utilisé dans tout ce style.
const tcVar = computed(() => `var(--building-${props.type}-rgb)`)
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

/* Encart illustration — dégradé + glyphe tiennent lieu d'aperçu tant qu'aucune
   vraie illustration de bâtiment n'existe ; il suffira de poser
   `background-image` sur .card-art pour la vraie image plus tard. */
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
  font-size: 3.4rem;
  line-height: 1;
  opacity: 0.14;
  transform: rotate(-6deg);
  transition: transform 0.3s ease;
}

.building-card--lg .card-art-glyph {
  font-size: 4.8rem;
}

.building-card:hover .card-art-glyph {
  transform: rotate(-6deg) scale(1.05);
}

.card-content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 0.6rem 0.55rem 0.5rem;
  gap: 0.15rem;
}

.card-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.card-icon {
  font-size: 1.6rem;
  line-height: 1;
  filter: drop-shadow(0 1px 3px rgba(var(--overlay-rgb), 0.25));
  transition: filter 0.2s;
}

.building-card--lg .card-icon {
  font-size: 2.1rem;
}

.card-icon--locked {
  filter: grayscale(1) opacity(0.5);
}

.card-icon--constructing {
  filter: grayscale(0.3) opacity(0.85);
}

.level-badge {
  font-size: 0.62rem;
  font-weight: 800;
  color: #fff;
  background: rgba(var(--tc), 0.92);
  border-radius: 999px;
  padding: 0.05rem 0.4rem;
  line-height: 1.4;
}

.level-badge--maxed {
  background: var(--rarity-epic);
}

.card-name {
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--color-text);
  margin-top: 0.15rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.building-card--lg .card-name {
  font-size: 0.94rem;
}

.card-status {
  font-size: 0.66rem;
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

.quick-btn {
  align-self: flex-end;
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

.quick-btn:active:not(:disabled) {
  transform: scale(0.95);
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

/* ---- États ---- */
.state-upgradable {
  border-color: rgba(var(--color-success-strong-rgb), 0.4);
}
.state-upgradable .card-status {
  color: var(--color-success-strong);
}

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

.state-waiting {
  border-color: rgba(var(--color-warning-rgb), 0.35);
}
.state-waiting .card-status {
  color: var(--color-warning);
}

.state-constructing {
  border-color: rgba(var(--color-accent-rgb), 0.4);
}
.state-constructing .card-status {
  color: var(--color-accent-ink);
}

.state-locked {
  cursor: default;
  opacity: 0.55;
  filter: grayscale(0.6);
}
.state-locked:hover {
  transform: none;
}
.state-locked .card-status {
  color: var(--rarity-common);
}

.state-maxed {
  border-color: rgba(var(--rarity-epic-rgb), 0.35);
}
.state-maxed .card-status {
  color: var(--rarity-epic);
}
</style>
