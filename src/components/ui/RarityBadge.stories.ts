import type { Meta, StoryObj } from '@storybook/vue3-vite'
import RarityBadge from './RarityBadge.vue'

const meta = {
  title: 'UI/RarityBadge',
  component: RarityBadge,
  tags: ['autodocs'],
} satisfies Meta<typeof RarityBadge>

export default meta
type Story = StoryObj<typeof meta>

export const Common: Story = {
  args: { rarity: 'common' },
}

export const Rare: Story = {
  args: { rarity: 'rare' },
}

export const Epic: Story = {
  args: { rarity: 'epic' },
}

export const Legendary: Story = {
  args: { rarity: 'legendary' },
}

export const AllRarities: Story = {
  args: { rarity: 'common' },
  render: () => ({
    components: { RarityBadge },
    template: `
      <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
        <RarityBadge rarity="common" />
        <RarityBadge rarity="rare" />
        <RarityBadge rarity="epic" />
        <RarityBadge rarity="legendary" />
      </div>
    `,
  }),
}
