import type { Meta, StoryObj } from '@storybook/vue3-vite'
import ToggleSwitch from './ToggleSwitch.vue'

const meta = {
  title: 'UI/ToggleSwitch',
  component: ToggleSwitch,
  tags: ['autodocs'],
  args: {
    modelValue: false,
    label: 'Activer le son',
  },
} satisfies Meta<typeof ToggleSwitch>

export default meta
type Story = StoryObj<typeof meta>

export const Off: Story = {}

export const On: Story = {
  args: { modelValue: true },
}

export const DisabledOff: Story = {
  args: { disabled: true },
}

export const DisabledOn: Story = {
  args: { modelValue: true, disabled: true },
}
