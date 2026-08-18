<template>
  <div
    role="separator"
    :class="['sep', orientation === 'vertical' ? 'sep--vertical' : 'sep--horizontal']"
  />
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    orientation?: 'horizontal' | 'vertical'
  }>(),
  { orientation: 'horizontal' },
)
</script>

<style scoped>
.sep {
  flex-shrink: 0;
  /* 0.15 plutôt que 0.1 — un liseré neutre à 0.1 se noie sur le fond blanc,
     même écart de lisibilité repéré sur les autres liserés discrets du
     système (ToggleSwitch, RangeSlider, SearchInput). */
  background: rgba(var(--overlay-rgb), 0.15);
}

.sep--horizontal {
  height: 1px;
  width: 100%;
}

.sep--vertical {
  width: 1px;
  height: 100%;
  align-self: stretch;
}
</style>
