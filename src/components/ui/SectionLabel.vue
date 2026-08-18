<template>
  <span class="section-label" :class="`section-label--${color}`"><slot /></span>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    color?: 'default' | 'muted'
  }>(),
  {
    color: 'muted',
  },
)
</script>

<style scoped>
.section-label {
  display: inline-block;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-size: 0.72rem;
  font-weight: 600;
}

.section-label--muted {
  color: var(--color-text-faint);
}

.section-label--default {
  color: var(--color-text-muted);
}
</style>
