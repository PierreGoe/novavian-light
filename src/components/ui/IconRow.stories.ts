import type { Meta, StoryObj } from '@storybook/vue3-vite'
import IconRow from './IconRow.vue'

const meta = {
  title: 'UI/IconRow',
  component: IconRow,
  tags: ['autodocs'],
  args: {
    icon: '🌾',
    label: 'Céréales',
  },
} satisfies Meta<typeof IconRow>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => ({
    components: { IconRow },
    setup: () => ({ args }),
    template: '<IconRow v-bind="args">1 240</IconRow>',
  }),
}

export const WithSublabel: Story = {
  args: {
    icon: '🏹',
    label: 'Archers',
    sublabel: 'Unité à distance',
  },
  render: (args) => ({
    components: { IconRow },
    setup: () => ({ args }),
    template: '<IconRow v-bind="args">12</IconRow>',
  }),
}

export const SuccessTone: Story = {
  args: {
    icon: '⚒️',
    label: 'Production / heure',
    tone: 'success',
  },
  render: (args) => ({
    components: { IconRow },
    setup: () => ({ args }),
    template: '<IconRow v-bind="args">+320</IconRow>',
  }),
}

export const ResourceList: Story = {
  render: () => ({
    components: { IconRow },
    template: `
      <div style="display: flex; flex-direction: column; gap: 0.6rem; width: 260px;">
        <IconRow icon="🌾" label="Céréales">1 240</IconRow>
        <IconRow icon="🪵" label="Bois" sublabel="Plafond 5 000">3 800</IconRow>
        <IconRow icon="🪙" label="Or" tone="accent">560</IconRow>
        <IconRow icon="⚔️" label="Pertes récentes" tone="danger">-42</IconRow>
      </div>
    `,
  }),
}

export const LongLabelTruncation: Story = {
  render: () => ({
    components: { IconRow },
    template: `
      <div style="display: flex; flex-direction: column; gap: 0.6rem; width: 220px;">
        <IconRow icon="🏛️" label="Bâtiment Principal du village fortifié" sublabel="Amélioration en cours vers le niveau supérieur">
          niv. 12
        </IconRow>
      </div>
    `,
  }),
}
