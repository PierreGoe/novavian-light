import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { fn } from 'storybook/test'
import BaseDialog from './BaseDialog.vue'
import Button from './Button.vue'

const meta = {
  title: 'UI/BaseDialog',
  component: BaseDialog,
  tags: ['autodocs'],
  args: {
    open: true,
    closeOnBackdrop: true,
    size: 'md',
    'onUpdate:open': fn(),
  },
} satisfies Meta<typeof BaseDialog>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => ({
    components: { BaseDialog, Button },
    setup: () => ({ args }),
    template: `
      <BaseDialog v-bind="args">
        <template #header><h2 style="margin:0; color: var(--color-text);">Titre de la boîte de dialogue</h2></template>
        Contenu libre passé dans le slot par défaut.
        <template #footer>
          <Button variant="secondary">Annuler</Button>
          <Button variant="primary">Confirmer</Button>
        </template>
      </BaseDialog>
    `,
  }),
}

export const Large: Story = {
  args: { size: 'lg' },
  render: (args) => ({
    components: { BaseDialog, Button },
    setup: () => ({ args }),
    template: `
      <BaseDialog v-bind="args">
        <template #header><h2 style="margin:0; color: var(--color-text);">Détail de l'objet</h2></template>
        Une boîte de dialogue plus large, pour du contenu riche (ex: détail d'un artefact).
        <template #footer>
          <Button variant="secondary">Fermer</Button>
        </template>
      </BaseDialog>
    `,
  }),
}

export const Small: Story = {
  args: { size: 'sm' },
  render: (args) => ({
    components: { BaseDialog, Button },
    setup: () => ({ args }),
    template: `
      <BaseDialog v-bind="args">
        <template #header><h2 style="margin:0; color: var(--color-text);">Passer ?</h2></template>
        Une boîte de dialogue compacte, pour une confirmation rapide.
        <template #footer>
          <Button variant="secondary" size="sm">Annuler</Button>
          <Button variant="primary" size="sm">Passer</Button>
        </template>
      </BaseDialog>
    `,
  }),
}

export const NoFooter: Story = {
  render: (args) => ({
    components: { BaseDialog },
    setup: () => ({ args }),
    template: `
      <BaseDialog v-bind="args">
        <template #header><h2 style="margin:0; color: var(--color-text);">Sans pied de page</h2></template>
        Utile pour de simples messages informatifs.
      </BaseDialog>
    `,
  }),
}
