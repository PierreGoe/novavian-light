<template>
  <div class="list-row">
    <span v-if="$slots.icon" class="list-row-icon">
      <slot name="icon" />
    </span>
    <div class="list-row-content">
      <slot />
    </div>
    <div v-if="$slots.actions" class="list-row-actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<script setup lang="ts"></script>

<style scoped>
.list-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.75rem 0.5rem;
  border-bottom: 1px solid rgba(var(--overlay-rgb), 0.1);
  transition: background 0.15s;
}

.list-row:hover {
  background: rgba(var(--overlay-rgb), 0.04);
}

.list-row:last-child {
  border-bottom: none;
}

.list-row-icon {
  flex-shrink: 0;
  font-size: 1.3rem;
  line-height: 1;
  display: flex;
  align-items: center;
}

.list-row-content {
  flex: 1;
  min-width: 0;
  color: var(--color-text);
}

.list-row-actions {
  flex-shrink: 0;
  display: flex;
  gap: 0.5rem;
  align-items: center;
}
</style>
