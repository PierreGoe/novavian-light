<template>
  <button
    type="button"
    role="switch"
    class="toggle-switch"
    :class="{ 'toggle-switch--on': modelValue }"
    :aria-checked="modelValue"
    :aria-label="label"
    :disabled="disabled"
    @click="$emit('update:modelValue', !modelValue)"
  >
    <span class="toggle-switch-thumb" />
  </button>
</template>

<script setup lang="ts">
defineProps<{
  modelValue: boolean
  label?: string
  disabled?: boolean
}>()

defineEmits<{
  'update:modelValue': [boolean]
}>()
</script>

<style scoped>
.toggle-switch {
  position: relative;
  display: inline-flex;
  align-items: center;
  width: 42px;
  height: 24px;
  flex-shrink: 0;
  padding: 0;
  /* Rail "off" volontairement plus marqué qu'un simple liseré de séparation :
     ce n'est pas une bordure décorative, c'est le seul indice visuel de
     l'état "désactivé" du switch — trop discret, il devient impossible à
     distinguer du fond blanc. */
  border: 1px solid rgba(var(--overlay-rgb), 0.35);
  border-radius: 24px;
  background: rgba(var(--overlay-rgb), 0.14);
  cursor: pointer;
  transition:
    background 0.2s,
    border-color 0.2s;
}

.toggle-switch:hover:not(:disabled):not(.toggle-switch--on) {
  border-color: rgba(var(--overlay-rgb), 0.5);
}

.toggle-switch:hover:not(:disabled).toggle-switch--on {
  background: var(--color-accent-dark);
}

.toggle-switch:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

.toggle-switch:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.toggle-switch--on {
  background: var(--color-accent);
  border-color: var(--color-accent-dark);
}

.toggle-switch-thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--color-bg-surface);
  box-shadow: 0 1px 2px rgba(var(--color-black-rgb), 0.25);
  transition: transform 0.2s;
}

.toggle-switch--on .toggle-switch-thumb {
  transform: translateX(18px);
}
</style>
