<template>
  <div
    ref="rootEl"
    class="selectable-card"
    :class="{ 'selectable-card--selected': selected, 'selectable-card--disabled': disabled }"
    role="button"
    :aria-pressed="selected"
    :aria-disabled="disabled"
    :tabindex="disabled ? -1 : 0"
    @keydown.enter.prevent="activate"
    @keydown.space.prevent="activate"
  >
    <span v-if="$slots.badge" class="selectable-card-badge">
      <slot name="badge" />
    </span>
    <span v-if="$slots.icon" class="selectable-card-icon">
      <slot name="icon" />
    </span>
    <div class="selectable-card-body">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const props = withDefaults(
  defineProps<{
    selected?: boolean
    disabled?: boolean
  }>(),
  {
    selected: false,
    disabled: false,
  },
)

const rootEl = ref<HTMLDivElement | null>(null)

// La carte est un vrai contrôle clavier (role="button") : Entrée/Espace déclenchent
// le même @click natif que le consommateur écoute déjà sur le composant, sans lui
// imposer de logique supplémentaire.
function activate() {
  if (!props.disabled) rootEl.value?.click()
}
</script>

<style scoped>
.selectable-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1.25rem 1rem;
  border-radius: 12px;
  border: 1px solid rgba(var(--overlay-rgb), 0.15);
  background: var(--color-bg-surface);
  text-align: center;
  cursor: pointer;
  transition:
    transform 0.15s ease,
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}

.selectable-card:hover:not(.selectable-card--disabled) {
  transform: translateY(-2px);
  border-color: rgba(var(--color-accent-rgb), 0.4);
  box-shadow: 0 6px 16px rgba(var(--color-black-rgb), 0.08);
}

.selectable-card:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

.selectable-card--selected {
  border-color: var(--color-accent);
  /* Le fond doit rester opaque même sur un arrière-plan chargé (image de
     l'écran d'accueil) : on superpose la teinte accent à une base pleine
     plutôt que de s'appuyer sur une seule couleur semi-transparente. */
  background-color: var(--color-bg-surface);
  background-image: linear-gradient(
    rgba(var(--color-accent-rgb), 0.08),
    rgba(var(--color-accent-rgb), 0.08)
  );
}

.selectable-card--disabled {
  cursor: not-allowed;
}

/* On atténue seulement le contenu (icône/texte), pas la carte entière : elle
   reste opaque et lisible quel que soit ce qu'il y a derrière. */
.selectable-card--disabled .selectable-card-icon,
.selectable-card--disabled .selectable-card-body {
  opacity: 0.55;
}

.selectable-card-badge {
  position: absolute;
  top: -0.6rem;
  right: 0.75rem;
  background: var(--color-bg-surface);
  border-radius: 999px;
}

.selectable-card-icon {
  font-size: 2rem;
  line-height: 1;
}

.selectable-card-body {
  color: var(--color-text);
}
</style>
