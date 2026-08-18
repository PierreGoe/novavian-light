import type { Meta, StoryObj } from '@storybook/vue3-vite'
import FilterTabs from './FilterTabs.vue'

const meta = {
  title: 'UI/FilterTabs',
  component: FilterTabs,
  tags: ['autodocs'],
  args: {
    items: [
      { label: 'Toutes', value: 'all', count: 12 },
      { label: 'Armes', value: 'weapon', count: 5 },
      { label: 'Armures', value: 'armor', count: 4 },
      { label: 'Relique', value: 'relic' },
    ],
    modelValue: 'all',
  },
} satisfies Meta<typeof FilterTabs>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const SecondTabActive: Story = {
  args: { modelValue: 'weapon' },
}
