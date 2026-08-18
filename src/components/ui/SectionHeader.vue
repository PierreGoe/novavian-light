<template>
  <div class="section-header">
    <div class="section-header-main">
      <span v-if="icon" class="section-header-icon">{{ icon }}</span>
      <h3 class="section-header-title">{{ title }}</h3>
      <slot />
    </div>
    <div v-if="$slots.badge" class="section-header-badge">
      <slot name="badge" />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  icon?: string
  title: string
}>()
</script>

<style scoped>
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.section-header-main {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.section-header-icon {
  font-size: 1.1rem;
  line-height: 1;
  flex-shrink: 0;
}

.section-header-title {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--color-text);
}

.section-header-badge {
  flex-shrink: 0;
}
</style>
