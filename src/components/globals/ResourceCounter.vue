<template>
  <span class="resource-counter">{{ displayValue }}</span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  value: number
}>()

const displayValue = computed(() => Math.floor(props.value))
</script>
