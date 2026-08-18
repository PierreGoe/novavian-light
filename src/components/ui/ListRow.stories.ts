import type { Meta, StoryObj } from '@storybook/vue3-vite'
import ListRow from './ListRow.vue'
import Button from './Button.vue'

const meta = {
  title: 'UI/ListRow',
  component: ListRow,
  tags: ['autodocs'],
} satisfies Meta<typeof ListRow>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => ({
    components: { ListRow },
    template: `
      <ListRow>
        <template #icon>🪵</template>
        Bois — 1 250 disponibles
      </ListRow>
    `,
  }),
}

export const WithActions: Story = {
  render: () => ({
    components: { ListRow, Button },
    template: `
      <ListRow>
        <template #icon>⚔️</template>
        Attaque repoussée — Forteresse (12, 8)
        <template #actions>
          <Button variant="secondary" size="sm">Détails</Button>
        </template>
      </ListRow>
    `,
  }),
}
