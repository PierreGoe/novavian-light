<template>
  <div class="step-dots" role="img" :aria-label="`Étape ${current + 1} sur ${total}`">
    <span
      v-for="index in total"
      :key="index"
      class="step-dot"
      :class="{ 'step-dot--active': index - 1 === current }"
      aria-hidden="true"
    />
  </div>
</template>

<script setup lang="ts">
defineProps<{
  total: number
  current: number
}>()
</script>

<style scoped>
.step-dots {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.step-dot {
  flex-shrink: 0;
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: rgba(var(--overlay-rgb), 0.2);
  transition:
    background-color 0.2s ease,
    width 0.2s ease;
}

.step-dot--active {
  width: 18px;
  background: var(--color-accent);
}
</style>
