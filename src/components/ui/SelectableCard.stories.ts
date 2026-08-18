import type { Meta, StoryObj } from '@storybook/vue3-vite'
import SelectableCard from './SelectableCard.vue'
import Badge from './Badge.vue'

const meta = {
  title: 'UI/SelectableCard',
  component: SelectableCard,
  tags: ['autodocs'],
} satisfies Meta<typeof SelectableCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => ({
    components: { SelectableCard },
    template: `
      <div style="width: 180px;">
        <SelectableCard>
          <template #icon>⚔️</template>
          Guerrier
        </SelectableCard>
      </div>
    `,
  }),
}

export const Selected: Story = {
  render: () => ({
    components: { SelectableCard },
    template: `
      <div style="width: 180px;">
        <SelectableCard selected>
          <template #icon>🛡️</template>
          Défenseur
        </SelectableCard>
      </div>
    `,
  }),
}

export const Disabled: Story = {
  render: () => ({
    components: { SelectableCard },
    template: `
      <div style="width: 180px;">
        <SelectableCard disabled>
          <template #icon>🏹</template>
          Archer (verrouillé)
        </SelectableCard>
      </div>
    `,
  }),
}

export const WithBadge: Story = {
  render: () => ({
    components: { SelectableCard, Badge },
    template: `
      <div style="width: 180px; padding-top: 0.75rem;">
        <SelectableCard>
          <template #icon>👑</template>
          <template #badge><Badge tone="accent">Recommandé</Badge></template>
          Chef de guerre
        </SelectableCard>
      </div>
    `,
  }),
}
