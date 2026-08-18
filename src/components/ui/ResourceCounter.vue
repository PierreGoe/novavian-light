<template>
  <span class="resource-counter">{{ displayValue }}</span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { formatNumber } from '@/utils/formatNumber'

const props = defineProps<{
  value: number
}>()

const displayValue = computed(() => formatNumber(Math.floor(props.value)))
</script>

<style scoped>
.resource-counter {
  /* Chiffres alignés en largeur fixe — évite que l'affichage tressaute
     visuellement quand un compteur de production incrémente en continu. */
  font-variant-numeric: tabular-nums;
}
</style>
