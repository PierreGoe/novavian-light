import type { Meta, StoryObj } from '@storybook/vue3-vite'
import IconActionButton from './IconActionButton.vue'

const meta = {
  title: 'UI/IconActionButton',
  component: IconActionButton,
  tags: ['autodocs'],
  args: {
    icon: '🔄',
    title: 'Rejouer',
    subtitle: 'Recommencer une nouvelle partie',
  },
} satisfies Meta<typeof IconActionButton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithoutSubtitle: Story = {
  args: { subtitle: undefined },
}

export const Disabled: Story = {
  args: { disabled: true },
}
