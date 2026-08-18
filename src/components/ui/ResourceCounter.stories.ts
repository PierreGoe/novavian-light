import type { Meta, StoryObj } from '@storybook/vue3-vite'
import ResourceCounter from './ResourceCounter.vue'

const meta = {
  title: 'UI/ResourceCounter',
  component: ResourceCounter,
  tags: ['autodocs'],
  args: {
    value: 1250,
  },
} satisfies Meta<typeof ResourceCounter>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const LargeNumber: Story = {
  args: { value: 1_240_500 },
}

export const Zero: Story = {
  args: { value: 0 },
}
