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
  background: rgba(255, 255, 255, 0.1);
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
