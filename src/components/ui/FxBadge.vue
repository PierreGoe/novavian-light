<template>
  <span class="fx-badge" :class="[`fx-badge--${kind}`, `fx-badge--${variant}`]">
    <span class="fx-badge-icon">{{ icon }}</span>
    <slot />
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    kind: 'economy' | 'military' | 'defense' | 'resource'
    variant?: 'tag' | 'pill'
  }>(),
  {
    variant: 'tag',
  },
)

const ICONS: Record<typeof props.kind, string> = {
  economy: '📈',
  military: '⚔️',
  defense: '🛡️',
  resource: '🌾',
}

const icon = computed(() => ICONS[props.kind])
</script>

<style scoped>
.fx-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.3em;
  padding: 0.15rem 0.55rem;
  border: 1px solid transparent;
  font-size: 0.78rem;
  font-weight: 600;
  line-height: 1.4;
  white-space: nowrap;
}

.fx-badge-icon {
  line-height: 1;
}

.fx-badge--tag {
  border-radius: 4px;
}

.fx-badge--pill {
  border-radius: 999px;
}

/* Les tokens --fx-* sont calibrés comme couleurs d'accent (icône/fond/bordure),
   pas comme texte : à cette taille, aucun n'atteint 4.5:1 sur blanc (2.1 à
   3.8:1 selon la teinte). Le texte reste donc en encre neutre — l'icône et le
   fond teinté suffisent à porter l'identité du bonus ; les tokens --fx-*
   eux-mêmes sont partagés avec d'autres écrans hors design system et ne
   doivent pas être recalibrés ici. */
.fx-badge--economy {
  background: rgba(var(--fx-economy-rgb), 0.15);
  border-color: rgba(var(--fx-economy-rgb), 0.4);
  color: var(--color-text);
}

.fx-badge--military {
  background: rgba(var(--fx-military-rgb), 0.15);
  border-color: rgba(var(--fx-military-rgb), 0.4);
  color: var(--color-text);
}

.fx-badge--defense {
  background: rgba(var(--fx-defense-rgb), 0.15);
  border-color: rgba(var(--fx-defense-rgb), 0.4);
  color: var(--color-text);
}

.fx-badge--resource {
  background: rgba(var(--fx-resource-rgb), 0.15);
  border-color: rgba(var(--fx-resource-rgb), 0.4);
  color: var(--color-text);
}
</style>
