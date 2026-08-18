import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { fn } from 'storybook/test'
import SegmentedControl from './SegmentedControl.vue'

const meta = {
  title: 'UI/SegmentedControl',
  component: SegmentedControl,
  tags: ['autodocs'],
  args: {
    'onUpdate:modelValue': fn(),
  },
} satisfies Meta<typeof SegmentedControl>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    modelValue: 'near',
    options: [
      { label: 'Proche', value: 'near' },
      { label: 'Normal', value: 'normal' },
      { label: 'Loin', value: 'far' },
    ],
  },
}

export const WithIconsAndBadges: Story = {
  args: {
    modelValue: 'units',
    options: [
      { label: 'Unités', value: 'units', icon: '⚔️', badge: 3 },
      { label: 'Production', value: 'production', icon: '🏭' },
      { label: 'Stockage', value: 'storage', icon: '📦', badge: 12 },
    ],
  },
}
