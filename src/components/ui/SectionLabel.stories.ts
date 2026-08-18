import type { Meta, StoryObj } from '@storybook/vue3-vite'
import SectionLabel from './SectionLabel.vue'

const meta = {
  title: 'UI/SectionLabel',
  component: SectionLabel,
  tags: ['autodocs'],
} satisfies Meta<typeof SectionLabel>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => ({
    components: { SectionLabel },
    setup: () => ({ args }),
    template: '<SectionLabel v-bind="args">Survivants</SectionLabel>',
  }),
}

export const Muted: Story = {
  args: { color: 'muted' },
  render: (args) => ({
    components: { SectionLabel },
    setup: () => ({ args }),
    template: '<SectionLabel v-bind="args">Pertes</SectionLabel>',
  }),
}

export const AboveContent: Story = {
  render: () => ({
    components: { SectionLabel },
    template: `
      <div style="display: flex; flex-direction: column; gap: 0.4rem; width: 220px;">
        <SectionLabel>Zone hostile</SectionLabel>
        <p style="margin: 0; color: var(--color-text); font-size: 0.9rem;">
          Forteresse (12, -4) — attaque dans 4m 12s
        </p>
      </div>
    `,
  }),
}
