import type { Meta, StoryObj } from '@storybook/vue3-vite'
import RangeSlider from './RangeSlider.vue'

const meta = {
  title: 'UI/RangeSlider',
  component: RangeSlider,
  tags: ['autodocs'],
  args: {
    modelValue: 50,
    min: 0,
    max: 100,
  },
} satisfies Meta<typeof RangeSlider>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithFormattedValue: Story = {
  args: {
    modelValue: 2,
    min: 1,
    max: 4,
    step: 1,
    formatValue: (v: number) => `×${v}`,
  },
}

export const AtMin: Story = {
  args: { modelValue: 0 },
}

export const AtMax: Story = {
  args: { modelValue: 100 },
}

export const Disabled: Story = {
  args: { disabled: true },
}
