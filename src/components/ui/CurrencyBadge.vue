<template>
  <span class="currency-badge">
    <span class="currency-badge-icon">{{ icon }}</span>
    <span class="currency-badge-amount">{{ displayAmount }}</span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { formatNumber } from '@/utils/formatNumber'

const props = withDefaults(
  defineProps<{
    amount: number
    icon?: string
  }>(),
  {
    icon: '🪙',
  },
)

const displayAmount = computed(() => formatNumber(Math.floor(props.amount)))
</script>

<style scoped>
.currency-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.35em;
  font-weight: 700;
}

.currency-badge-icon {
  line-height: 1;
}

.currency-badge-amount {
  color: var(--color-accent-ink);
  font-variant-numeric: tabular-nums;
}
</style>
