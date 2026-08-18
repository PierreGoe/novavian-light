import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { fn } from 'storybook/test'
import QuantityStepper from './QuantityStepper.vue'

const meta = {
  title: 'UI/QuantityStepper',
  component: QuantityStepper,
  tags: ['autodocs'],
  args: {
    modelValue: 5,
    min: 0,
    'onUpdate:modelValue': fn(),
  },
} satisfies Meta<typeof QuantityStepper>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const AtMin: Story = {
  args: { modelValue: 0 },
}

export const AtMax: Story = {
  args: { modelValue: 20, max: 20 },
}

export const WithMaxButton: Story = {
  args: { modelValue: 5, max: 20 },
}
