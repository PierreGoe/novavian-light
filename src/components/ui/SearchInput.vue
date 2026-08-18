<template>
  <div class="search-input-wrap">
    <span class="search-input-icon">🔍</span>
    <input
      class="search-input"
      type="search"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    modelValue: string
    placeholder?: string
    disabled?: boolean
  }>(),
  {
    placeholder: 'Rechercher...',
  },
)

defineEmits<{
  'update:modelValue': [string]
}>()
</script>

<style scoped>
.search-input-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
  width: 100%;
}

.search-input-icon {
  position: absolute;
  left: 0.75rem;
  font-size: 0.85rem;
  opacity: 0.6;
  pointer-events: none;
}

.search-input {
  width: 100%;
  padding: 0.5rem 0.75rem 0.5rem 2.1rem;
  border-radius: 8px;
  /* Un champ de saisie a besoin d'un contour net pour se lire comme une
     zone cliquable — un liseré à 0.2 se fondait presque dans le blanc. */
  border: 1px solid rgba(var(--overlay-rgb), 0.3);
  background: var(--color-bg-surface);
  color: var(--color-text);
  font-size: 0.88rem;
  transition: border-color 0.15s;
}

.search-input::placeholder {
  color: var(--color-text-faint);
}

.search-input:hover:not(:disabled):not(:focus-visible) {
  border-color: rgba(var(--overlay-rgb), 0.45);
}

.search-input:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

.search-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
