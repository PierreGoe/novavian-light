<template>
  <span class="resource-counter" :title="exactTitle">{{ displayValue }}</span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { formatNumber } from '@/utils/formatNumber'

const props = defineProps<{
  value: number
}>()

const floored = computed(() => Math.floor(props.value))
const displayValue = computed(() => formatNumber(floored.value))
/** Valeur exacte au survol quand l'affichage est abrégé en K/M */
const exactTitle = computed(() =>
  floored.value >= 1_000 ? floored.value.toLocaleString('fr-FR') : undefined,
)
</script>

<style scoped>
.resource-counter {
  /* Chiffres alignés en largeur fixe — évite que l'affichage tressaute
     visuellement quand un compteur de production incrémente en continu. */
  font-variant-numeric: tabular-nums;
}
</style>
