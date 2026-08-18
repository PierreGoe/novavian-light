import type { Meta, StoryObj } from '@storybook/vue3-vite'
import FloatingNumber from './FloatingNumber.vue'

const meta = {
  title: 'UI/FloatingNumber',
  component: FloatingNumber,
  tags: ['autodocs'],
  render: (args) => ({
    components: { FloatingNumber },
    setup: () => ({ args }),
    template:
      '<div style="position: relative; height: 40px;"><FloatingNumber v-bind="args" /></div>',
  }),
} satisfies Meta<typeof FloatingNumber>

export default meta
type Story = StoryObj<typeof meta>

export const Positive: Story = {
  args: { value: 150 },
}

export const Negative: Story = {
  args: { value: -50 },
}

export const Accent: Story = {
  args: { value: 1, tone: 'accent' },
}
