import type { Meta, StoryObj } from '@storybook/vue3-vite'
import CountBadge from './CountBadge.vue'

const meta = {
  title: 'UI/CountBadge',
  component: CountBadge,
  tags: ['autodocs'],
  args: {
    count: 3,
    variant: 'default',
    position: 'top-right',
  },
  render: (args) => ({
    components: { CountBadge },
    setup: () => ({ args }),
    template: `
      <div style="position: relative; width: 40px; height: 40px; border-radius: 8px; background: rgba(255,255,255,0.08); display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">
        🔔
        <CountBadge v-bind="args" />
      </div>
    `,
  }),
} satisfies Meta<typeof CountBadge>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Active: Story = {
  args: { variant: 'active' },
}

export const BottomRight: Story = {
  args: { position: 'bottom-right' },
}

export const Hidden: Story = {
  args: { count: 0 },
}
