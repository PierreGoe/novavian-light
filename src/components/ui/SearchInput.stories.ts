import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { fn } from 'storybook/test'
import SearchInput from './SearchInput.vue'

const meta = {
  title: 'UI/SearchInput',
  component: SearchInput,
  tags: ['autodocs'],
  args: {
    modelValue: '',
    'onUpdate:modelValue': fn(),
  },
} satisfies Meta<typeof SearchInput>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithValue: Story = {
  args: { modelValue: 'artefact légendaire' },
}

export const Disabled: Story = {
  args: { disabled: true, modelValue: '' },
}
