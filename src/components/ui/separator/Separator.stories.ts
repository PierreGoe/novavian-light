import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { Separator } from './index'

const meta = {
  title: 'UI/Separator',
  component: Separator,
  tags: ['autodocs'],
} satisfies Meta<typeof Separator>

export default meta
type Story = StoryObj<typeof meta>

export const Horizontal: Story = {
  args: { orientation: 'horizontal' },
  render: (args) => ({
    components: { Separator },
    setup: () => ({ args }),
    template: '<div style="width: 200px;"><Separator v-bind="args" /></div>',
  }),
}

export const Vertical: Story = {
  args: { orientation: 'vertical' },
  render: (args) => ({
    components: { Separator },
    setup: () => ({ args }),
    template: '<div style="height: 100px; display: flex;"><Separator v-bind="args" /></div>',
  }),
}
