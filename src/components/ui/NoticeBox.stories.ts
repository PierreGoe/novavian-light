import type { Meta, StoryObj } from '@storybook/vue3-vite'
import NoticeBox from './NoticeBox.vue'

const meta = {
  title: 'UI/NoticeBox',
  component: NoticeBox,
  tags: ['autodocs'],
} satisfies Meta<typeof NoticeBox>

export default meta
type Story = StoryObj<typeof meta>

export const Success: Story = {
  args: { variant: 'success' },
  render: (args) => ({
    components: { NoticeBox },
    setup: () => ({ args }),
    template:
      '<NoticeBox v-bind="args">Renfort arrivé — la garnison est de nouveau au complet.</NoticeBox>',
  }),
}

export const Warning: Story = {
  args: { variant: 'warning' },
  render: (args) => ({
    components: { NoticeBox },
    setup: () => ({ args }),
    template:
      '<NoticeBox v-bind="args">Vos troupes ont atteint leur capacité de pillage maximale.</NoticeBox>',
  }),
}

export const Danger: Story = {
  args: { variant: 'danger' },
  render: (args) => ({
    components: { NoticeBox },
    setup: () => ({ args }),
    template:
      '<NoticeBox v-bind="args">Cette forteresse est hostile — un raid est imminent.</NoticeBox>',
  }),
}

export const Info: Story = {
  args: { variant: 'info' },
  render: (args) => ({
    components: { NoticeBox },
    setup: () => ({ args }),
    template:
      '<NoticeBox v-bind="args">Un fragment de carte est disponible sur ce cadran.</NoticeBox>',
  }),
}

export const Neutral: Story = {
  args: { variant: 'neutral' },
  render: (args) => ({
    components: { NoticeBox },
    setup: () => ({ args }),
    template: '<NoticeBox v-bind="args">Aucune troupe en transit vers cette case.</NoticeBox>',
  }),
}
