<template>
  <BaseDialog :open="open" role="alertdialog" :labelledby="titleId" @update:open="onUpdateOpen">
    <template #header>
      <h2 :id="titleId" class="confirm-title" :class="{ 'confirm-title--danger': danger }">
        {{ title }}
      </h2>
    </template>

    <p class="confirm-message">{{ message }}</p>

    <template #footer>
      <Button variant="secondary" @click="cancel">{{ cancelLabel }}</Button>
      <Button ref="confirmBtnRef" :variant="danger ? 'danger' : 'primary'" @click="confirm">
        {{ confirmLabel }}
      </Button>
    </template>
  </BaseDialog>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import BaseDialog from './BaseDialog.vue'
import Button from './Button.vue'

const props = withDefaults(
  defineProps<{
    open: boolean
    title: string
    message: string
    confirmLabel?: string
    cancelLabel?: string
    /** Style rouge/danger pour les actions destructives (vs. gold neutre par défaut) */
    danger?: boolean
  }>(),
  {
    confirmLabel: 'Confirmer',
    cancelLabel: 'Annuler',
    danger: false,
  },
)

const emit = defineEmits<{
  confirm: []
  cancel: []
  'update:open': [boolean]
}>()

// Identifiant stable par instance pour aria-labelledby
const titleId = `confirm-dialog-title-${Math.random().toString(36).slice(2, 9)}`
const confirmBtnRef = ref<{ focus: () => void } | null>(null)

function confirm() {
  emit('confirm')
  emit('update:open', false)
}

function cancel() {
  emit('cancel')
  emit('update:open', false)
}

// Fermeture via le backdrop/Esc de BaseDialog — équivaut à une annulation
function onUpdateOpen(value: boolean) {
  if (!value) cancel()
}

// Focus posé sur le bouton de confirmation à l'ouverture, pour la navigation clavier.
// Deux nextTick : le premier laisse BaseDialog poser son propre focus par défaut
// sur le panneau, le second nous laisse le reprendre sur le bouton de confirmation.
watch(
  () => props.open,
  async (isOpen) => {
    if (isOpen) {
      await nextTick()
      await nextTick()
      confirmBtnRef.value?.focus()
    }
  },
)
</script>

<style scoped>
.confirm-title {
  margin: 0;
  font-size: 1.1rem;
  color: var(--color-accent-ink);
}

.confirm-title--danger {
  color: var(--color-danger-light);
}

.confirm-message {
  margin: 0;
}
</style>
