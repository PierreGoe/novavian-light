import type { Meta, StoryObj } from '@storybook/vue3-vite'
import AvatarGroup from './AvatarGroup.vue'

const meta = {
  title: 'UI/AvatarGroup',
  component: AvatarGroup,
  tags: ['autodocs'],
} satisfies Meta<typeof AvatarGroup>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    items: ['⚔️', '🛡️', '🏹', '🐎', '🔥'],
    max: 5,
  },
}

export const WithOverflow: Story = {
  args: {
    items: ['⚔️', '🛡️', '🏹', '🐎', '🔥', '💣', '🪓', '🗡️'],
    max: 4,
  },
}

export const Small: Story = {
  args: {
    items: ['⚔️', '🛡️', '🏹'],
    size: 'sm',
  },
}

export const Large: Story = {
  args: {
    items: ['⚔️', '🛡️', '🏹'],
    size: 'lg',
  },
}
