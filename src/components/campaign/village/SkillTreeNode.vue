<!--
  Nœud générique de l'arbre du village (VillageSkillTree.vue) : le hub (QG)
  et les 6 bâtiments-branches l'utilisent tous les deux, avec des tailles
  différentes. Porte l'anneau de "pips" (un point par niveau jusqu'à
  maxLevel — rempli = niveau acquis), l'anneau d'état (couleur = state) et
  le halo de sélection. Purement présentationnel, comme BuildingCard.vue
  avant lui : tout l'état vient de VillagePlanView.vue.
-->
<template>
  <g class="node-group" :class="[state, { selected }]" @click="$emit('select')">
    <g aria-hidden="true">
      <circle
        v-for="(pip, i) in pips"
        :key="i"
        class="pip"
        :class="state === 'locked' ? 'locked-pip' : pip.filled ? 'filled' : 'empty'"
        :cx="pip.x"
        :cy="pip.y"
        :r="pipRadius"
      />
    </g>

    <circle aria-hidden="true" class="select-halo" :cx="cx" :cy="cy" :r="r + 2.4" />
    <circle aria-hidden="true" class="notable-ring" :cx="cx" :cy="cy" :r="r" />
    <text class="notable-icon" :x="cx" :y="cy" :font-size="iconSize">
      {{ state === 'locked' ? '🔒' : icon }}
    </text>
    <text v-if="showName" class="notable-name" :x="cx" :y="cy + r + 9" font-size="3.4">
      {{ name }}
    </text>

    <!-- Rôle/focus clavier posés ICI (pas sur le <g>) : sa boîte englobante
         reste celle du cercle cliquable, pas celle de tout l'anneau de pips
         + texte — sinon le contour de focus standard de l'appli
         ([role='button']:focus-visible, App.vue) devient un énorme rectangle. -->
    <circle class="notable-hit" v-clickable :aria-label="ariaLabel" :cx="cx" :cy="cy" :r="r + 2">
      <title>{{ name }} — {{ statusDetail }}</title>
    </circle>
  </g>
</template>

<script setup lang="ts">
import { computed } from 'vue'

type BuildingState = 'locked' | 'available' | 'constructing' | 'upgradable' | 'waiting' | 'maxed'

const props = defineProps<{
  cx: number
  cy: number
  r: number
  iconSize: number
  pipGap: number
  showName?: boolean
  icon: string
  name: string
  level: number
  maxLevel: number
  state: BuildingState
  selected: boolean
  statusDetail?: string
}>()

defineEmits<{ select: [] }>()

const STATE_LABEL: Record<BuildingState, string> = {
  locked: 'verrouillé',
  available: 'emplacement libre',
  constructing: 'chantier en cours',
  upgradable: 'amélioration possible',
  waiting: 'ressources insuffisantes',
  maxed: 'niveau maximum',
}

const ariaLabel = computed(
  () => `${props.name}, niveau ${props.level} sur ${props.maxLevel}, ${STATE_LABEL[props.state]}`,
)

// Anneau de pips : un point par niveau, réparti régulièrement autour du nœud
// (même formule que la maquette validée) — rayon réduit au-delà de 14 pour
// éviter tout chevauchement quand maxLevel atteint 20.
const pipRadius = computed(() => (props.maxLevel > 14 ? 0.85 : 1.05))

const pips = computed(() => {
  const ringR = props.r + props.pipGap
  return Array.from({ length: props.maxLevel }, (_, i) => {
    const a = (i / props.maxLevel) * Math.PI * 2 - Math.PI / 2
    return {
      x: props.cx + ringR * Math.cos(a),
      y: props.cy + ringR * Math.sin(a),
      filled: i < props.level,
    }
  })
})
</script>

<style scoped>
.pip {
  stroke-width: 0.35;
}
.pip.empty {
  fill: var(--color-bg-surface);
  stroke: rgba(var(--overlay-rgb), 0.3);
}
.pip.filled {
  fill: var(--color-accent);
  stroke: none;
}
.pip.locked-pip {
  fill: var(--color-bg-surface);
  stroke: rgba(var(--overlay-rgb), 0.12);
}

.notable-ring {
  fill: var(--color-bg-surface);
  stroke: rgba(var(--overlay-rgb), 0.18);
  stroke-width: 0.5;
  transition: filter 0.15s ease;
}
.node-group:hover .notable-ring {
  filter: brightness(0.97);
}

.notable-hit {
  fill: transparent;
  cursor: pointer;
  /* Chrome/Safari peignent sinon une tache bleue translucide au clic/tap
     (surbrillance tactile par défaut). */
  -webkit-tap-highlight-color: transparent;
  /* Focus désactivé sur l'arbre : le contour standard de l'appli
     ([role='button']:focus-visible, App.vue) reste trop voyant ici — le clic
     ouvre déjà le panneau de détails, qui sert de retour visuel.
     !important nécessaire : cette règle globale a la même spécificité. */
  outline: none !important;
}

.notable-icon {
  text-anchor: middle;
  dominant-baseline: central;
  pointer-events: none;
}
.notable-name {
  text-anchor: middle;
  fill: var(--color-text-muted);
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  font-weight: 600;
  pointer-events: none;
}

.node-group.locked .notable-ring {
  fill: rgba(var(--rarity-common-rgb), 0.08);
}
.node-group.locked .notable-icon,
.node-group.locked .notable-name {
  fill: var(--rarity-common);
  opacity: 0.7;
}
.node-group.locked .notable-hit {
  cursor: not-allowed;
}

.node-group.available .notable-ring {
  fill: rgba(var(--color-info-rgb), 0.08);
  stroke: rgba(var(--color-info-rgb), 0.65);
  stroke-width: 0.6;
  stroke-dasharray: 1.4 1;
}

.node-group.constructing .notable-ring {
  stroke: var(--color-accent);
  stroke-width: 0.7;
}
.node-group.upgradable .notable-ring {
  stroke: var(--color-success-strong);
  stroke-width: 0.6;
}
.node-group.waiting .notable-ring {
  stroke: var(--color-warning);
  stroke-width: 0.6;
}
.node-group.maxed .notable-ring {
  stroke: var(--rarity-epic);
  stroke-width: 0.8;
}
.node-group.maxed .notable-icon {
  filter: drop-shadow(0 0 3px rgba(var(--rarity-epic-rgb), 0.8));
}

.select-halo {
  fill: none;
  stroke: var(--color-accent-dark);
  stroke-width: 0.5;
  opacity: 0;
  transition: opacity 0.15s ease;
}
.node-group.selected .select-halo {
  opacity: 1;
}
</style>
