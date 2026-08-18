<template>
  <button
    ref="rootEl"
    class="btn"
    :class="[`btn--${variant}`, `btn--${size}`]"
    :type="type"
    :disabled="disabled"
  >
    <slot />
  </button>
</template>

<script setup lang="ts">
import { ref } from 'vue'

withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success'
    size?: 'sm' | 'md'
    disabled?: boolean
    /** 'button' par défaut — évite qu'un Button placé dans un <form> soumette
     * le formulaire par accident (comportement natif implicite du bouton). */
    type?: 'button' | 'submit' | 'reset'
  }>(),
  {
    variant: 'primary',
    size: 'md',
    disabled: false,
    type: 'button',
  },
)

const rootEl = ref<HTMLButtonElement | null>(null)

// Permet à un parent (ex: ConfirmDialog) de poser le focus clavier sur ce bouton
// précis au montage, sans dépendre de l'instance interne du composant.
defineExpose({
  focus: () => rootEl.value?.focus(),
})
</script>

<style scoped>
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid transparent;
  transition:
    background 0.15s,
    transform 0.1s;
}

.btn:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

.btn:active:not(:disabled) {
  transform: scale(0.97);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

/* Tailles */
.btn--md {
  padding: 0.55rem 1.1rem;
  font-size: 0.88rem;
}

.btn--sm {
  padding: 0.4rem 0.85rem;
  font-size: 0.75rem;
}

/* Variantes — le doré est réservé à l'action primaire, le reste reste neutre */
.btn--primary {
  background: linear-gradient(135deg, var(--color-accent), var(--color-accent-dark));
  color: var(--color-accent-contrast);
}

.btn--primary:hover:not(:disabled) {
  filter: brightness(1.1);
}

.btn--secondary {
  background: rgba(var(--overlay-rgb), 0.07);
  border-color: rgba(var(--overlay-rgb), 0.2);
  color: var(--color-text-subtle);
}

.btn--secondary:hover:not(:disabled) {
  background: rgba(var(--overlay-rgb), 0.13);
}

.btn--danger {
  background: linear-gradient(135deg, var(--color-danger), var(--color-danger-dark));
  color: #fff;
}

.btn--danger:hover:not(:disabled) {
  filter: brightness(1.1);
}

.btn--ghost {
  background: transparent;
  border-color: rgba(var(--overlay-rgb), 0.15);
  color: var(--color-text-muted);
}

.btn--ghost:hover:not(:disabled) {
  background: rgba(var(--overlay-rgb), 0.06);
}

.btn--success {
  background: linear-gradient(
    135deg,
    var(--color-success-strong),
    var(--color-success-strong-dark)
  );
  color: var(--color-accent-contrast);
}

.btn--success:hover:not(:disabled) {
  filter: brightness(1.1);
}
</style>
