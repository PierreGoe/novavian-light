import type { Meta, StoryObj } from '@storybook/vue3-vite'
import StepDots from './StepDots.vue'

const meta = {
  title: 'UI/StepDots',
  component: StepDots,
  tags: ['autodocs'],
  args: {
    total: 5,
    current: 2,
  },
} satisfies Meta<typeof StepDots>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const FirstStep: Story = {
  args: { current: 0 },
}

export const LastStep: Story = {
  args: { current: 4 },
}
