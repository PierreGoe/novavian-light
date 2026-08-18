<template>
  <Badge :tone="tone">{{ label }}</Badge>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import Badge from './Badge.vue'

const props = defineProps<{
  durability: 'single-use' | 'uses-limited' | 'permanent'
  usesRemaining?: number
  maxUses?: number
}>()

const TONES = {
  'single-use': 'danger',
  'uses-limited': 'warning',
  permanent: 'success',
} as const

const tone = computed(() => TONES[props.durability])

const label = computed(() => {
  if (props.durability === 'single-use') return 'Usage unique'
  if (props.durability === 'permanent') return 'Permanent'
  return props.usesRemaining !== undefined && props.maxUses !== undefined
    ? `${props.usesRemaining}/${props.maxUses} usages`
    : 'Usages limités'
})
</script>
