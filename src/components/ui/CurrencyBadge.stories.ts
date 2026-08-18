import type { Meta, StoryObj } from '@storybook/vue3-vite'
import CurrencyBadge from './CurrencyBadge.vue'

const meta = {
  title: 'UI/CurrencyBadge',
  component: CurrencyBadge,
  tags: ['autodocs'],
  args: {
    amount: 1250,
  },
} satisfies Meta<typeof CurrencyBadge>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const LargeAmount: Story = {
  args: { amount: 2_450_000 },
}

export const CustomIcon: Story = {
  args: { amount: 500, icon: '💰' },
}
