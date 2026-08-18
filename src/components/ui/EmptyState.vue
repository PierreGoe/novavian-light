<template>
  <div class="empty-state">
    <span v-if="icon" class="empty-state-icon">{{ icon }}</span>
    <p class="empty-state-message">{{ message }}</p>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  message: string
  icon?: string
}>()
</script>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 2rem 1rem;
  text-align: center;
}

.empty-state-icon {
  font-size: 1.5rem;
  opacity: 0.5;
}

.empty-state-message {
  margin: 0;
  color: var(--color-text-faint);
  font-style: italic;
  font-size: 0.88rem;
}
</style>
