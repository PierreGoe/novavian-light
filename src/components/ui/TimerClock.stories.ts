import type { Meta, StoryObj } from '@storybook/vue3-vite'
import TimerClock from './TimerClock.vue'

const meta = {
  title: 'UI/TimerClock',
  component: TimerClock,
  tags: ['autodocs'],
  args: {
    size: 60,
  },
} satisfies Meta<typeof TimerClock>

export default meta
type Story = StoryObj<typeof meta>

export const InProgress: Story = {
  args: {
    progress: 0.4,
    icon: '⚔️',
  },
}

export const WithRemainingTime: Story = {
  args: {
    progress: 0.65,
    remainingMs: 5 * 60 * 1000 + 30 * 1000,
    icon: '🏗️',
  },
}

export const Dashed: Story = {
  args: {
    dashed: true,
    icon: '🛡️',
    countBadge: 3,
  },
}

export const Done: Story = {
  args: {
    done: true,
    icon: '✅',
  },
  render: (args) => ({
    components: { TimerClock },
    setup: () => ({ args }),
    template: '<TimerClock v-bind="args"><span>Terminé</span></TimerClock>',
  }),
}

export const CustomColor: Story = {
  args: {
    progress: 0.8,
    icon: '⚔️',
    progressColor: 'var(--color-danger)',
  },
}
