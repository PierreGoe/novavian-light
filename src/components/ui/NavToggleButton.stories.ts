import type { Meta, StoryObj } from '@storybook/vue3-vite'
import NavToggleButton from './NavToggleButton.vue'

const meta = {
  title: 'UI/NavToggleButton',
  component: NavToggleButton,
  tags: ['autodocs'],
  args: {
    collapsed: false,
    side: 'left',
  },
} satisfies Meta<typeof NavToggleButton>

export default meta
type Story = StoryObj<typeof meta>

export const Expanded: Story = {}

export const Collapsed: Story = {
  args: { collapsed: true },
}

export const CollapsedWithBadge: Story = {
  args: { collapsed: true, badge: 3 },
}

export const RightSide: Story = {
  args: { side: 'right', collapsed: true },
}
