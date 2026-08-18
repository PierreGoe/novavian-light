<template>
  <Badge tone="neutral" :class="`rarity-badge--${rarity}`">
    <slot>{{ label }}</slot>
  </Badge>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import Badge from './Badge.vue'

const props = defineProps<{
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
}>()

const LABELS: Record<typeof props.rarity, string> = {
  common: 'Commun',
  rare: 'Rare',
  epic: 'Épique',
  legendary: 'Légendaire',
}

const label = computed(() => LABELS[props.rarity])
</script>

<style scoped>
/* Compose la forme (padding/radius/taille) de Badge.vue — ne redéfinit que la
   teinte par rareté. Le sélecteur `span.rarity-badge--x` (au lieu de la classe
   seule) prime volontairement sur `.badge--neutral` posé par Badge.vue,
   peu importe l'ordre de chargement des feuilles de style scoped. */
span.rarity-badge--common {
  background: rgba(var(--rarity-common-rgb), 0.15);
  border-color: rgba(var(--rarity-common-rgb), 0.4);
  color: var(--rarity-common);
}

span.rarity-badge--rare {
  background: rgba(var(--rarity-rare-rgb), 0.15);
  border-color: rgba(var(--rarity-rare-rgb), 0.4);
  color: var(--rarity-rare);
}

span.rarity-badge--epic {
  background: rgba(var(--rarity-epic-rgb), 0.15);
  border-color: rgba(var(--rarity-epic-rgb), 0.4);
  color: var(--rarity-epic);
}

span.rarity-badge--legendary {
  background: rgba(var(--rarity-legendary-rgb), 0.15);
  border-color: rgba(var(--rarity-legendary-rgb), 0.4);
  color: var(--rarity-legendary);
}
</style>
