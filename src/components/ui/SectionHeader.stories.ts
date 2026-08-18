import type { Meta, StoryObj } from '@storybook/vue3-vite'
import SectionHeader from './SectionHeader.vue'

const meta = {
  title: 'UI/SectionHeader',
  component: SectionHeader,
  tags: ['autodocs'],
  args: {
    icon: '🏹',
    title: 'Caserne',
  },
} satisfies Meta<typeof SectionHeader>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithBadge: Story = {
  render: (args) => ({
    components: { SectionHeader },
    setup: () => ({ args }),
    template: `
      <SectionHeader v-bind="args">
        <template #badge>
          <span
            style="font-size: 0.75rem; font-weight: 600; color: var(--color-text-faint); font-variant-numeric: tabular-nums;"
          >3 / 5</span>
        </template>
      </SectionHeader>
    `,
  }),
}
