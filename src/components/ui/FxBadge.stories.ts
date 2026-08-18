import type { Meta, StoryObj } from '@storybook/vue3-vite'
import FxBadge from './FxBadge.vue'

const meta = {
  title: 'UI/FxBadge',
  component: FxBadge,
  tags: ['autodocs'],
  args: {
    variant: 'tag',
  },
} satisfies Meta<typeof FxBadge>

export default meta
type Story = StoryObj<typeof meta>

export const Economy: Story = {
  args: { kind: 'economy' },
  render: (args) => ({
    components: { FxBadge },
    setup: () => ({ args }),
    template: '<FxBadge v-bind="args">+15% Éco</FxBadge>',
  }),
}

export const Military: Story = {
  args: { kind: 'military' },
  render: (args) => ({
    components: { FxBadge },
    setup: () => ({ args }),
    template: '<FxBadge v-bind="args">+10% Mil</FxBadge>',
  }),
}

export const Defense: Story = {
  args: { kind: 'defense' },
  render: (args) => ({
    components: { FxBadge },
    setup: () => ({ args }),
    template: '<FxBadge v-bind="args">+20% Déf</FxBadge>',
  }),
}

export const Resource: Story = {
  args: { kind: 'resource' },
  render: (args) => ({
    components: { FxBadge },
    setup: () => ({ args }),
    template: '<FxBadge v-bind="args">+5% Céréales</FxBadge>',
  }),
}

export const AllKinds: Story = {
  args: { kind: 'economy' },
  render: () => ({
    components: { FxBadge },
    template: `
      <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
        <FxBadge kind="economy">+15% Éco</FxBadge>
        <FxBadge kind="military">+10% Mil</FxBadge>
        <FxBadge kind="defense">+20% Déf</FxBadge>
        <FxBadge kind="resource">+5% Céréales</FxBadge>
      </div>
    `,
  }),
}

export const TagVsPill: Story = {
  args: { kind: 'economy' },
  render: () => ({
    components: { FxBadge },
    template: `
      <div style="display: flex; gap: 0.5rem; align-items: center;">
        <FxBadge kind="economy" variant="tag">+15% Éco</FxBadge>
        <FxBadge kind="economy" variant="pill">+15% Éco</FxBadge>
      </div>
    `,
  }),
}
