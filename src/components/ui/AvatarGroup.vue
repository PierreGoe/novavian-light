<template>
  <div class="avatar-group">
    <span
      v-for="(item, index) in visibleItems"
      :key="index"
      class="avatar"
      :class="`avatar--${size}`"
      :style="{ zIndex: visibleItems.length - index }"
      :title="item"
    >
      {{ item }}
    </span>
    <span
      v-if="overflowCount > 0"
      class="avatar avatar--more"
      :class="`avatar--${size}`"
      :style="{ zIndex: 0 }"
      :title="`+${overflowCount}`"
    >
      +{{ overflowCount }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    items: string[]
    max?: number
    size?: 'sm' | 'md' | 'lg'
  }>(),
  {
    max: 5,
    size: 'md',
  },
)

const visibleItems = computed(() => props.items.slice(0, props.max))
const overflowCount = computed(() => Math.max(0, props.items.length - props.max))
</script>

<style scoped>
.avatar-group {
  display: flex;
  align-items: center;
}

.avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--color-bg-surface);
  border: 2px solid var(--color-bg-surface);
  box-shadow: 0 0 0 1px rgba(var(--overlay-rgb), 0.15);
  color: var(--color-text);
  font-weight: 600;
  line-height: 1;
}

.avatar:not(:first-child) {
  margin-left: -0.5rem;
}

.avatar--sm {
  width: 24px;
  height: 24px;
  font-size: 0.7rem;
}

.avatar--md {
  width: 32px;
  height: 32px;
  font-size: 0.9rem;
}

.avatar--lg {
  width: 42px;
  height: 42px;
  font-size: 1.1rem;
}

.avatar--more {
  background: rgba(var(--overlay-rgb), 0.08);
  color: var(--color-text-muted);
  font-size: 0.68em;
}
</style>
