import type { Meta, StoryObj } from '@storybook/vue3-vite'
import Badge from './Badge.vue'

const meta = {
  title: 'UI/Badge',
  component: Badge,
  tags: ['autodocs'],
  args: {
    tone: 'neutral',
  },
  render: (args) => ({
    components: { Badge },
    setup: () => ({ args }),
    template: '<Badge v-bind="args">Libellé</Badge>',
  }),
} satisfies Meta<typeof Badge>

export default meta
type Story = StoryObj<typeof meta>

export const Neutral: Story = {}

export const Accent: Story = {
  args: { tone: 'accent' },
}

export const Success: Story = {
  args: { tone: 'success', icon: '✅' },
}

export const Danger: Story = {
  args: { tone: 'danger' },
}

export const Info: Story = {
  args: { tone: 'info' },
}

export const Warning: Story = {
  args: { tone: 'warning' },
}

export const Epic: Story = {
  args: { tone: 'epic' },
}

export const AllTones: Story = {
  render: () => ({
    components: { Badge },
    template: `
      <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
        <Badge tone="neutral">Neutre</Badge>
        <Badge tone="accent">Accent</Badge>
        <Badge tone="success" icon="✅">Succès</Badge>
        <Badge tone="danger">Danger</Badge>
        <Badge tone="info">Info</Badge>
        <Badge tone="warning">Avertissement</Badge>
        <Badge tone="epic">Épique</Badge>
      </div>
    `,
  }),
}
