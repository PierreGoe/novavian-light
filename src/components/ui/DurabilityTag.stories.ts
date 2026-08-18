import type { Meta, StoryObj } from '@storybook/vue3-vite'
import DurabilityTag from './DurabilityTag.vue'

const meta = {
  title: 'UI/DurabilityTag',
  component: DurabilityTag,
  tags: ['autodocs'],
} satisfies Meta<typeof DurabilityTag>

export default meta
type Story = StoryObj<typeof meta>

export const SingleUse: Story = {
  args: { durability: 'single-use' },
}

export const UsesLimited: Story = {
  args: { durability: 'uses-limited', usesRemaining: 2, maxUses: 5 },
}

export const Permanent: Story = {
  args: { durability: 'permanent' },
}

export const AllDurabilities: Story = {
  args: { durability: 'single-use' },
  render: () => ({
    components: { DurabilityTag },
    template: `
      <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
        <DurabilityTag durability="single-use" />
        <DurabilityTag durability="uses-limited" :uses-remaining="2" :max-uses="5" />
        <DurabilityTag durability="permanent" />
      </div>
    `,
  }),
}
