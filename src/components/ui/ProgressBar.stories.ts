import type { Meta, StoryObj } from '@storybook/vue3-vite'
import ProgressBar from './ProgressBar.vue'

const meta = {
  title: 'UI/ProgressBar',
  component: ProgressBar,
  tags: ['autodocs'],
  args: {
    value: 50,
  },
} satisfies Meta<typeof ProgressBar>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Empty: Story = {
  args: { value: 0 },
}

export const Full: Story = {
  args: { value: 100 },
}

export const Danger: Story = {
  args: { value: 75, tone: 'danger' },
}

export const Warning: Story = {
  args: { value: 60, tone: 'warning' },
}

export const Done: Story = {
  args: { value: 100, done: true },
}
