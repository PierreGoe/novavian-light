import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { fn } from 'storybook/test'
import ConfirmDialog from './ConfirmDialog.vue'

const meta = {
  title: 'UI/ConfirmDialog',
  component: ConfirmDialog,
  tags: ['autodocs'],
  args: {
    open: true,
    title: 'Réinitialiser les paramètres ?',
    message: 'Tous les réglages reviendront à leurs valeurs par défaut.',
    danger: false,
    onConfirm: fn(),
    onCancel: fn(),
    'onUpdate:open': fn(),
  },
} satisfies Meta<typeof ConfirmDialog>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Danger: Story = {
  args: {
    title: 'Supprimer cet objet ?',
    message: 'Cette action est irréversible.',
    confirmLabel: 'Supprimer',
    danger: true,
  },
}

export const Closed: Story = {
  args: { open: false },
}

export const LongMessage: Story = {
  args: {
    title: 'Abandonner cette expédition ?',
    message:
      'Vos troupes sont actuellement à mi-chemin de leur destination. Les rappeler maintenant leur fera perdre la moitié du temps de trajet déjà écoulé, et elles reviendront sans avoir combattu ni pillé quoi que ce soit sur place.',
  },
}
